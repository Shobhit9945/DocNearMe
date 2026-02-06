import { RequestHandler } from "express";
import { resolveMx } from "node:dns/promises";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getEmailOtpsCollection, getMedicalConsentsCollection, getPatientsCollection } from "../db";
import { EmailOtp, MedicalConsent, PatientUser } from "../types";
import {
  AuthResponse,
  CheckEmailRequest,
  CheckEmailResponse,
  LoginRequest,
  OtpResponse,
  PhoneOtpResponse,
  RequestPhoneOtpRequest,
  RequestOtpRequest,
  RequestPasswordResetRequest,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SignupRequest,
  VerifyOtpRequest,
  VerifyPhoneOtpRequest,
} from "@shared/api";
import { buildOtpEmail, generateOtpCode, getOtpTtlMinutes, hashOtp, verifyOtp } from "../services/otp";
import { sendEmail } from "../services/mailer";
import { checkPhoneVerification, requestPhoneVerification } from "../services/twilio";

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(8).max(128);
const nameSchema = z.string().trim().min(2).max(80);
const dateOfBirthSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date of birth.");
const nationalitySchema = z.string().trim().min(2).max(80);
const visaTypeSchema = z.string().trim().min(2).max(80);
const consentAcceptedSchema = z.literal(true);
const phoneSchema = z.string().trim().regex(/^\+\d{7,15}$/);
const phoneProofSchema = z.string().trim().min(1);
const photoSchema = z
  .object({
    dataUrl: z.string().min(20),
    fileName: z.string().trim().min(1).max(200),
    fileType: z.string().trim().min(3).max(80),
    size: z.number().int().positive().max(5 * 1024 * 1024),
  })
  .nullable()
  .optional();

const SIGNUP_CONSENT_VERSION = "signup-2024-09-01";
const SIGNUP_CONSENT_TEXT =
  "I consent to the collection, use, and secure storage of my personal information, including " +
  "health-related data, in accordance with Japan's Act on the Protection of Personal Information (APPI). " +
  "I understand DocNearMe will use this information to create my account, coordinate care, and protect my data.";

const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  dateOfBirth: dateOfBirthSchema,
  nationality: nationalitySchema,
  visaType: visaTypeSchema,
  phone: phoneSchema,
  phoneProofToken: phoneProofSchema,
  photo: photoSchema,
  consentAccepted: consentAcceptedSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const requestOtpSchema = z.object({
  email: emailSchema,
  captchaProofToken: z.string().trim().min(1),
});

const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

const checkEmailSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().trim().min(1),
});

const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().length(6),
});

const requestPhoneOtpSchema = z.object({
  phone: phoneSchema,
});

const verifyPhoneOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().trim().length(6),
});

const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().length(6),
  password: passwordSchema,
});

const jwtSecret = process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET ?? "dev-secret-change-me";
const jwtExpiry = process.env.AUTH_JWT_EXPIRES_IN ?? "7d";
const captchaProofExpiry = process.env.CAPTCHA_PROOF_EXPIRES_IN ?? "5m";
const disposableEmailDomains = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "coswz.com",
  "dispostable.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "temp-mail.org",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
]);
const disposableLookupUrl = process.env.DISPOSABLE_EMAIL_LOOKUP_URL ?? "https://open.kickbox.com/v1/disposable";
const disposableLookupTimeoutMs = Number(process.env.DISPOSABLE_EMAIL_LOOKUP_TIMEOUT_MS ?? "2000");
const extraDisposableDomains = (process.env.DISPOSABLE_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);
extraDisposableDomains.forEach((domain) => disposableEmailDomains.add(domain));

// LOAD_TEST_BYPASS_START
const loadTestBypassEnabled = process.env.LOAD_TEST_BYPASS === "true";
const loadTestBypassKey = process.env.LOAD_TEST_BYPASS_KEY ?? "";

const isLoadTestBypass = (req: Parameters<RequestHandler>[0], email: string) => {
  if (!loadTestBypassEnabled || !loadTestBypassKey) return false;
  const headerKey = req.get("x-load-test-key") ?? "";
  if (headerKey !== loadTestBypassKey) return false;
  return email.endsWith("@example.com");
};
// LOAD_TEST_BYPASS_END

const getUserId = (user: PatientUser) => {
  if (user._id instanceof ObjectId) return user._id.toString();
  return String(user._id ?? "");
};

const toAuthResponse = (user: PatientUser): AuthResponse["user"] => ({
  id: getUserId(user),
  name: user.name,
  email: user.email,
  createdAt: new Date(user.createdAt).toISOString(),
});

const signToken = (user: PatientUser) =>
  jwt.sign(
    {
      sub: getUserId(user),
      email: user.email,
      name: user.name,
    },
    jwtSecret,
    { expiresIn: jwtExpiry },
  );

const signCaptchaProof = (email: string) =>
  jwt.sign(
    {
      sub: email,
      scope: "captcha",
    },
    jwtSecret,
    { expiresIn: captchaProofExpiry },
  );

const verifyCaptchaProof = (token: string, email: string) => {
  try {
    const payload = jwt.verify(token, jwtSecret) as { sub?: string; scope?: string };
    return payload.sub === email && payload.scope === "captcha";
  } catch {
    return false;
  }
};

const signPhoneProof = (phone: string) =>
  jwt.sign(
    {
      sub: phone,
      scope: "phone",
    },
    jwtSecret,
    { expiresIn: captchaProofExpiry },
  );

const verifyPhoneProof = (token: string, phone: string) => {
  try {
    const payload = jwt.verify(token, jwtSecret) as { sub?: string; scope?: string };
    return payload.sub === phone && payload.scope === "phone";
  } catch {
    return false;
  }
};

const getEmailDomain = (email: string) => {
  const [, domain] = email.split("@");
  return domain?.trim().toLowerCase() ?? "";
};

const isDisposableDomain = (domain: string) =>
  disposableEmailDomains.has(domain) || Array.from(disposableEmailDomains).some(item => domain.endsWith(`.${item}`));

const hasMxRecord = async (domain: string) => {
  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
};

const checkDisposableEmailProvider = async (email: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), disposableLookupTimeoutMs);
  try {
    const response = await fetch(`${disposableLookupUrl}/${encodeURIComponent(email)}`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { disposable?: boolean };
    if (typeof data.disposable === "boolean") {
      return data.disposable;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const validateEmailForSignup = async (email: string) => {
  const domain = getEmailDomain(email);
  if (!domain) {
    return { valid: false, message: "Invalid email address." };
  }
  if (isDisposableDomain(domain)) {
    return { valid: false, message: "Temporary email addresses are not allowed." };
  }
  const disposableLookup = await checkDisposableEmailProvider(email);
  if (disposableLookup === true) {
    return { valid: false, message: "Temporary email addresses are not allowed." };
  }
  const mxOk = await hasMxRecord(domain);
  if (!mxOk) {
    return { valid: false, message: "Please enter a valid email address." };
  }
  return { valid: true };
};

const parseRequestBody = (body: unknown): unknown => {
  if (body instanceof Buffer) {
    return parseRequestBody(body.toString("utf8"));
  }
  if (body instanceof Uint8Array) {
    return parseRequestBody(Buffer.from(body).toString("utf8"));
  }
  if (body && typeof body === "object") return body;
  if (typeof body !== "string") return {};

  const trimmed = body.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    const params = new URLSearchParams(trimmed);
    const payload: Record<string, string> = {};
    params.forEach((value, key) => {
      payload[key] = value;
    });
    return payload;
  }
};

const verifyRecaptcha = async (token: string, remoteIp?: string) => {
  const secret = process.env.CAPTCHA;
  if (!secret) {
    return {
      success: false,
      message: "Captcha configuration missing. Please try again later.",
    };
  }

  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set("remoteip", remoteIp);

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    return {
      success: false,
      message: "Unable to verify captcha. Please try again.",
    };
  }

  const data = (await response.json()) as { success: boolean; "error-codes"?: string[] };
  if (!data.success) {
    return {
      success: false,
      message: "Captcha verification failed. Please try again.",
    };
  }

  return { success: true };
};

const getLatestOtp = async (email: string, purpose: "signup" | "password_reset") => {
  const otps = await getEmailOtpsCollection();
  const query =
    purpose === "signup"
      ? { email, $or: [{ purpose: "signup" }, { purpose: { $exists: false } }] }
      : { email, purpose };
  const list = await otps.find(query).sort({ createdAt: -1 }).toArray();
  return list[0] ?? null;
};

export const handleRequestOtp: RequestHandler = async (req, res, next) => {
  try {
    const parsed = requestOtpSchema.safeParse(parseRequestBody(req.body));
    if (!parsed.success) {
      const hasCaptchaIssue = parsed.error.issues.some(issue => issue.path.includes("captchaProofToken"));
      const hasEmailIssue = parsed.error.issues.some(issue => issue.path.includes("email"));
      const message = hasCaptchaIssue
        ? "Captcha verification expired. Please check your email again."
        : hasEmailIssue
          ? "Invalid email address."
          : "Invalid request. Please try again.";
      return res.status(400).json({
        success: false,
        message,
      } satisfies OtpResponse);
    }
    const payload = parsed.data as RequestOtpRequest;
    const normalizedEmail = payload.email.toLowerCase();
    const emailValidation = await validateEmailForSignup(normalizedEmail);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.message ?? "Invalid email address.",
      } satisfies OtpResponse);
    }
    const captchaProofValid = verifyCaptchaProof(payload.captchaProofToken, normalizedEmail);
    if (!captchaProofValid) {
      return res.status(400).json({
        success: false,
        message: "Captcha verification expired. Please check your email again.",
      } satisfies OtpResponse);
    }

    const patients = await getPatientsCollection();
    const existing = await patients.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with that email already exists.",
      } satisfies OtpResponse);
    }

    const recentOtp = await getLatestOtp(normalizedEmail, "signup");
    if (recentOtp && Date.now() - recentOtp.createdAt.getTime() < 60 * 1000) {
      return res.status(429).json({
        success: false,
        message: "Please wait 1 minute before requesting another code.",
      } satisfies OtpResponse);
    }

    const otpCode = generateOtpCode();
    const otpHash = await hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + getOtpTtlMinutes() * 60 * 1000);

    const otps = await getEmailOtpsCollection();
    const record: EmailOtp = {
      email: normalizedEmail,
      otpHash,
      createdAt: new Date(),
      expiresAt,
      purpose: "signup",
    };
    await otps.insertOne(record);

    const emailContent = buildOtpEmail(otpCode);
    const sent = await sendEmail({
      to: normalizedEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    if (!sent) {
      return res.status(500).json({
        success: false,
        message: "Unable to send verification email. Please try again later.",
      } satisfies OtpResponse);
    }

    const response: OtpResponse = {
      success: true,
      message: "Verification code sent to your email.",
    };

    if (process.env.OTP_DEV_MODE === "true") {
      response.debugOtp = otpCode;
    }

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address.",
      } satisfies OtpResponse);
    }
    return next(error);
  }
};

export const handleCheckEmail: RequestHandler = async (req, res, next) => {
  try {
    const payload = checkEmailSchema.parse(parseRequestBody(req.body)) as CheckEmailRequest;
    const normalizedEmail = payload.email.toLowerCase();
    const emailValidation = await validateEmailForSignup(normalizedEmail);
    if (!emailValidation.valid) {
      return res.status(400).json({
        exists: false,
        message: emailValidation.message ?? "Invalid email address.",
      } satisfies CheckEmailResponse);
    }
    const captchaCheck = await verifyRecaptcha(payload.captchaToken, req.ip);
    if (!captchaCheck.success) {
      return res.status(400).json({
        exists: false,
        message: captchaCheck.message ?? "Captcha verification failed. Please try again.",
      } satisfies CheckEmailResponse);
    }
    const patients = await getPatientsCollection();
    const existing = await patients.findOne({ email: normalizedEmail });

    const response: CheckEmailResponse = existing
      ? { exists: true, message: "An account with that email already exists." }
      : {
          exists: false,
          message: "Email is available for signup.",
          captchaProofToken: signCaptchaProof(normalizedEmail),
        };

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        exists: false,
        message: "Invalid email address.",
      } satisfies CheckEmailResponse);
    }
    return next(error);
  }
};

export const handleVerifyOtp: RequestHandler = async (req, res, next) => {
  try {
    const payload = verifyOtpSchema.parse(parseRequestBody(req.body)) as VerifyOtpRequest;
    const normalizedEmail = payload.email.toLowerCase();
    const otpRecord = await getLatestOtp(normalizedEmail, "signup");

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Verification code not found. Please request a new code.",
      } satisfies OtpResponse);
    }

    if (otpRecord.usedAt) {
      return res.status(400).json({
        success: false,
        message: "Verification code has already been used.",
      } satisfies OtpResponse);
    }

    if (otpRecord.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new one.",
      } satisfies OtpResponse);
    }

    const otpOk = await verifyOtp(payload.otp, otpRecord.otpHash);
    if (!otpOk) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      } satisfies OtpResponse);
    }

    const otps = await getEmailOtpsCollection();
    await otps.updateOne(
      { _id: otpRecord._id },
      {
        $set: {
          verifiedAt: new Date(),
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    } satisfies OtpResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification payload.",
      } satisfies OtpResponse);
    }
    return next(error);
  }
};

export const handleRequestPhoneOtp: RequestHandler = async (req, res, next) => {
  try {
    const payload = requestPhoneOtpSchema.parse(parseRequestBody(req.body)) as RequestPhoneOtpRequest;
    const status = await requestPhoneVerification(payload.phone);
    if (status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Unable to send verification code. Please try again.",
      } satisfies OtpResponse);
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your phone.",
    } satisfies OtpResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number.",
      } satisfies OtpResponse);
    }
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Unable to send verification code.",
      } satisfies OtpResponse);
    }
    return next(error);
  }
};

export const handleVerifyPhoneOtp: RequestHandler = async (req, res, next) => {
  try {
    const payload = verifyPhoneOtpSchema.parse(parseRequestBody(req.body)) as VerifyPhoneOtpRequest;
    const status = await checkPhoneVerification(payload.phone, payload.otp);
    if (status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      } satisfies PhoneOtpResponse);
    }

    return res.status(200).json({
      success: true,
      message: "Phone number verified successfully.",
      phoneProofToken: signPhoneProof(payload.phone),
    } satisfies PhoneOtpResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone verification payload.",
      } satisfies PhoneOtpResponse);
    }
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Verification failed.",
      } satisfies PhoneOtpResponse);
    }
    return next(error);
  }
};

export const handleSignup: RequestHandler = async (req, res, next) => {
  try {
    const payload = signupSchema.parse(parseRequestBody(req.body)) as SignupRequest;
    const patients = await getPatientsCollection();
    const normalizedEmail = payload.email.toLowerCase();
    // LOAD_TEST_BYPASS_START
    const bypassOtpChecks = isLoadTestBypass(req, normalizedEmail);
    // LOAD_TEST_BYPASS_END
    // LOAD_TEST_BYPASS_START
    if (!bypassOtpChecks) {
      const phoneProofValid = verifyPhoneProof(payload.phoneProofToken, payload.phone);
      if (!phoneProofValid) {
        return res.status(400).json({
          error: "Phone verification required before signup.",
          detail: "phone_verification_required",
        });
      }
    }
    // LOAD_TEST_BYPASS_END

    const existing = await patients.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        error: "An account with that email already exists.",
        detail: "email_exists",
      });
    }

    const otpRecord = await getLatestOtp(normalizedEmail, "signup");
    // LOAD_TEST_BYPASS_START
    if (!bypassOtpChecks) {
      if (!otpRecord || !otpRecord.verifiedAt || otpRecord.usedAt || otpRecord.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({
          error: "Email verification required before signup.",
          detail: "otp_required",
        });
      }
    }
    // LOAD_TEST_BYPASS_END

    const passwordHash = await bcryptjs.hash(payload.password, 12);
    const user: PatientUser = {
      name: payload.name,
      email: normalizedEmail,
      passwordHash,
      phone: payload.phone,
      dateOfBirth: payload.dateOfBirth,
      nationality: payload.nationality,
      visaType: payload.visaType,
      preferredLanguage: "Japanese",
      notificationsEnabled: true,
      photo: payload.photo ?? null,
      appointments: [],
      createdAt: new Date(),
    };

    const result = await patients.insertOne(user);
    const userWithId: PatientUser = { ...user, _id: result.insertedId };
    const patientId = getUserId(userWithId);
    const consents = await getMedicalConsentsCollection();
    const consentRecord: MedicalConsent = {
      patientId,
      consentVersion: SIGNUP_CONSENT_VERSION,
      consentText: SIGNUP_CONSENT_TEXT,
      consentedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    };
    await consents.insertOne(consentRecord);
    const token = signToken(userWithId);

    const response: AuthResponse = {
      token,
      user: toAuthResponse(userWithId),
    };

    // LOAD_TEST_BYPASS_START
    if (!bypassOtpChecks && otpRecord) {
      const otps = await getEmailOtpsCollection();
      await otps.updateOne(
        { _id: otpRecord._id },
        {
          $set: {
            usedAt: new Date(),
          },
        },
      );
    }
    // LOAD_TEST_BYPASS_END

    return res.status(201).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(issue => {
        const path = issue.path.join(".");
        return `${path}: ${issue.message}`;
      }).join(", ");

      return res.status(400).json({
        error: `Invalid signup data: ${messages}`,
        detail: "invalid_payload",
        issues: error.issues,
      });
    }
    return next(error);
  }
};

export const handleLogin: RequestHandler = async (req, res, next) => {
  try {
    const payload = loginSchema.parse(parseRequestBody(req.body)) as LoginRequest;
    const patients = await getPatientsCollection();
    const normalizedEmail = payload.email.toLowerCase();

    const existing = await patients.findOne({ email: normalizedEmail });
    if (!existing) {
      return res.status(401).json({
        error: "Invalid email or password.",
        detail: "invalid_credentials",
      });
    }

    const passwordOk = await bcryptjs.compare(payload.password, existing.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({
        error: "Invalid email or password.",
        detail: "invalid_credentials",
      });
    }

    const token = signToken(existing);
    const response: AuthResponse = {
      token,
      user: toAuthResponse(existing),
    };

    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid login payload.",
        detail: "invalid_payload",
        issues: error.issues,
      });
    }
    return next(error);
  }
};

export const handleRequestPasswordReset: RequestHandler = async (req, res, next) => {
  try {
    const payload = requestPasswordResetSchema.parse(parseRequestBody(req.body)) as RequestPasswordResetRequest;
    const normalizedEmail = payload.email.toLowerCase();

    const patients = await getPatientsCollection();
    const existing = await patients.findOne({ email: normalizedEmail });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "No account found for that email.",
      } satisfies OtpResponse);
    }

    const recentOtp = await getLatestOtp(normalizedEmail, "password_reset");
    if (recentOtp && Date.now() - recentOtp.createdAt.getTime() < 60 * 1000) {
      return res.status(429).json({
        success: false,
        message: "Please wait 1 minute before requesting another code.",
      } satisfies OtpResponse);
    }

    const otpCode = generateOtpCode();
    const otpHash = await hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + getOtpTtlMinutes() * 60 * 1000);

    const otps = await getEmailOtpsCollection();
    const record: EmailOtp = {
      email: normalizedEmail,
      otpHash,
      createdAt: new Date(),
      expiresAt,
      purpose: "password_reset",
    };
    await otps.insertOne(record);

    const emailContent = buildOtpEmail(otpCode);
    const sent = await sendEmail({
      to: normalizedEmail,
      subject: "Reset your DocNearMe password",
      text: emailContent.text,
      html: emailContent.html,
    });

    if (!sent) {
      return res.status(500).json({
        success: false,
        message: "Unable to send reset code. Please try again later.",
      } satisfies OtpResponse);
    }

    const response: OtpResponse = {
      success: true,
      message: "Password reset code sent to your email.",
    };

    if (process.env.OTP_DEV_MODE === "true") {
      response.debugOtp = otpCode;
    }

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address.",
      } satisfies OtpResponse);
    }
    return next(error);
  }
};

export const handleResetPassword: RequestHandler = async (req, res, next) => {
  try {
    const payload = resetPasswordSchema.parse(parseRequestBody(req.body)) as ResetPasswordRequest;
    const normalizedEmail = payload.email.toLowerCase();

    const patients = await getPatientsCollection();
    const existing = await patients.findOne({ email: normalizedEmail });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "No account found for that email.",
      } satisfies ResetPasswordResponse);
    }

    const otpRecord = await getLatestOtp(normalizedEmail, "password_reset");
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Reset code not found. Please request a new code.",
      } satisfies ResetPasswordResponse);
    }

    if (otpRecord.usedAt) {
      return res.status(400).json({
        success: false,
        message: "Reset code has already been used.",
      } satisfies ResetPasswordResponse);
    }

    if (otpRecord.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Reset code has expired. Please request a new one.",
      } satisfies ResetPasswordResponse);
    }

    const otpOk = await verifyOtp(payload.otp, otpRecord.otpHash);
    if (!otpOk) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset code.",
      } satisfies ResetPasswordResponse);
    }

    const passwordHash = await bcryptjs.hash(payload.password, 12);
    await patients.updateOne({ _id: existing._id }, { $set: { passwordHash } });

    const otps = await getEmailOtpsCollection();
    await otps.updateOne(
      { _id: otpRecord._id },
      {
        $set: {
          usedAt: new Date(),
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully.",
    } satisfies ResetPasswordResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset payload.",
      } satisfies ResetPasswordResponse);
    }
    return next(error);
  }
};
