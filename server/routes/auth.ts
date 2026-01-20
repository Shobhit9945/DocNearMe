import { RequestHandler } from "express";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getEmailOtpsCollection, getPatientsCollection } from "../db";
import { EmailOtp, PatientUser } from "../types";
import { AuthResponse, LoginRequest, OtpResponse, RequestOtpRequest, SignupRequest, VerifyOtpRequest } from "@shared/api";
import { buildOtpEmail, generateOtpCode, getOtpTtlMinutes, hashOtp, verifyOtp } from "../services/otp";
import { sendEmail } from "../services/mailer";

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(8).max(128);
const nameSchema = z.string().trim().min(2).max(80);

const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const requestOtpSchema = z.object({
  email: emailSchema,
});

const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().length(6),
});

const jwtSecret = process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET ?? "dev-secret-change-me";
const jwtExpiry = process.env.AUTH_JWT_EXPIRES_IN ?? "7d";

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

const getLatestOtp = async (email: string) => {
  const otps = await getEmailOtpsCollection();
  const list = await otps.find({ email }).sort({ createdAt: -1 }).toArray();
  return list[0] ?? null;
};

export const handleRequestOtp: RequestHandler = async (req, res, next) => {
  try {
    const payload = requestOtpSchema.parse(parseRequestBody(req.body)) as RequestOtpRequest;
    const normalizedEmail = payload.email.toLowerCase();

    const patients = await getPatientsCollection();
    const existing = await patients.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with that email already exists.",
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

export const handleVerifyOtp: RequestHandler = async (req, res, next) => {
  try {
    const payload = verifyOtpSchema.parse(parseRequestBody(req.body)) as VerifyOtpRequest;
    const normalizedEmail = payload.email.toLowerCase();
    const otpRecord = await getLatestOtp(normalizedEmail);

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

export const handleSignup: RequestHandler = async (req, res, next) => {
  try {
    const payload = signupSchema.parse(parseRequestBody(req.body)) as SignupRequest;
    const patients = await getPatientsCollection();
    const normalizedEmail = payload.email.toLowerCase();

    const existing = await patients.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        error: "An account with that email already exists.",
        detail: "email_exists",
      });
    }

    const otpRecord = await getLatestOtp(normalizedEmail);
    if (!otpRecord || !otpRecord.verifiedAt || otpRecord.usedAt || otpRecord.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        error: "Email verification required before signup.",
        detail: "otp_required",
      });
    }

    const passwordHash = await bcryptjs.hash(payload.password, 12);
    const user: PatientUser = {
      name: payload.name,
      email: normalizedEmail,
      passwordHash,
      appointments: [],
      createdAt: new Date(),
    };

    const result = await patients.insertOne(user);
    const userWithId: PatientUser = { ...user, _id: result.insertedId };
    const token = signToken(userWithId);

    const response: AuthResponse = {
      token,
      user: toAuthResponse(userWithId),
    };

    const otps = await getEmailOtpsCollection();
    await otps.updateOne(
      { _id: otpRecord._id },
      {
        $set: {
          usedAt: new Date(),
        },
      },
    );

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
