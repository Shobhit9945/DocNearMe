import { RequestHandler } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import jwt from "jsonwebtoken";
import { getEmailOtpsCollection, getPatientsCollection } from "../db";
import { buildOtpEmail, generateOtpCode, getOtpTtlMinutes, hashOtp, verifyOtp } from "../services/otp";
import { sendEmail } from "../services/mailer";
import { checkPhoneVerification, requestPhoneVerification, sendPhoneSecurityAlert } from "../services/twilio";
import type {
  OtpResponse,
  PatientProfile,
  PatientProfileResponse,
  PatientProfileUpdateRequest,
  ProfileEmailChangeRequest,
  ProfileEmailChangeVerifyRequest,
  ProfileEmailChangeVerifyResponse,
  ProfilePhoneChangeRequest,
  ProfilePhoneChangeVerifyRequest,
  ProfilePhoneChangeVerifyResponse,
  VisaType,
} from "@shared/api";
import type { EmailOtp } from "../types";

const visaTypes: VisaType[] = [
  "tourist",
  "resident-work",
  "resident-student",
  "resident-family",
  "resident-permanent",
  "resident-long-term",
  "resident-other",
  "japanese-national",
];

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  phone: z.string().trim().max(40).optional(),
  emailProofToken: z.string().trim().min(1).optional(),
  phoneProofToken: z.string().trim().min(1).optional(),
  address: z.string().trim().max(200).optional(),
  visaType: z.enum(visaTypes).optional(),
  emergencyContact: z.string().trim().max(120).optional(),
  preferredLanguage: z.string().trim().max(40).optional(),
  notificationsEnabled: z.boolean().optional(),
});

const emailChangeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

const emailChangeVerifySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  otp: z.string().trim().length(6),
});

const phoneChangeRequestSchema = z.object({
  phone: z.string().trim().min(7).max(40),
});

const phoneChangeVerifySchema = z.object({
  phone: z.string().trim().min(7).max(40),
  otp: z.string().trim().length(6),
});

const jwtSecret = process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET ?? "dev-secret-change-me";
const profileChangeProofExpiry = process.env.PROFILE_CHANGE_PROOF_EXPIRES_IN ?? "15m";

const normalizePhone = (value: string) => {
  const compact = value.replace(/[\s\-()]/g, "");
  if (!compact) return "";
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\D/g, "")}`;
  }
  const digits = compact.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};

const isValidE164 = (value: string) => /^\+[1-9]\d{6,14}$/.test(value);

const signProfileEmailProof = (email: string) =>
  jwt.sign(
    {
      sub: email,
      scope: "profile_email_change",
    },
    jwtSecret,
    { expiresIn: profileChangeProofExpiry },
  );

const verifyProfileEmailProof = (token: string, email: string) => {
  try {
    const payload = jwt.verify(token, jwtSecret) as { sub?: string; scope?: string };
    return payload.sub === email && payload.scope === "profile_email_change";
  } catch {
    return false;
  }
};

const signProfilePhoneProof = (phone: string) =>
  jwt.sign(
    {
      sub: phone,
      scope: "profile_phone_change",
    },
    jwtSecret,
    { expiresIn: profileChangeProofExpiry },
  );

const verifyProfilePhoneProof = (token: string, phone: string) => {
  try {
    const payload = jwt.verify(token, jwtSecret) as { sub?: string; scope?: string };
    return payload.sub === phone && payload.scope === "profile_phone_change";
  } catch {
    return false;
  }
};

const getLatestEmailChangeOtp = async (email: string) => {
  const otps = await getEmailOtpsCollection();
  const list = await otps
    .find({ email, purpose: "profile_email_change" })
    .sort({ createdAt: -1 })
    .toArray();
  return (list[0] as EmailOtp | null) ?? null;
};

const sendProfileChangeAlertToOldEmail = async (
  previousEmail: string,
  changes: { nextEmail?: string; nextPhone?: string },
) => {
  if (!previousEmail) return;
  const lines: string[] = [
    "Your DocNearMe profile contact details were updated.",
    "",
  ];
  if (changes.nextEmail) {
    lines.push(`New email: ${changes.nextEmail}`);
  }
  if (changes.nextPhone) {
    lines.push(`New phone: ${changes.nextPhone}`);
  }
  lines.push("");
  lines.push("If this was not you, contact support immediately.");

  await sendEmail({
    to: previousEmail,
    subject: "DocNearMe profile contact updated",
    text: lines.join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Profile contact update</h2>
        <p>Your DocNearMe profile contact details were updated.</p>
        ${changes.nextEmail ? `<p><strong>New email:</strong> ${changes.nextEmail}</p>` : ""}
        ${changes.nextPhone ? `<p><strong>New phone:</strong> ${changes.nextPhone}</p>` : ""}
        <p>If this was not you, contact support immediately.</p>
      </div>
    `,
  });
};

const sendProfileChangeAlertToOldPhone = async (
  previousPhone: string,
  changes: { nextEmail?: string; nextPhone?: string },
) => {
  if (!previousPhone || !isValidE164(previousPhone)) return;
  const summaryParts: string[] = [];
  if (changes.nextEmail) summaryParts.push(`email -> ${changes.nextEmail}`);
  if (changes.nextPhone) summaryParts.push(`phone -> ${changes.nextPhone}`);
  const summary = summaryParts.join(", ");
  const message =
    summary.length > 0
      ? `DocNearMe alert: your profile contact was updated (${summary}). If this wasn't you, contact support immediately.`
      : "DocNearMe alert: your profile contact was updated. If this wasn't you, contact support immediately.";
  await sendPhoneSecurityAlert(previousPhone, message);
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

const toProfile = (patient: {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  visaType?: string;
  emergencyContact?: string;
  preferredLanguage?: string;
  notificationsEnabled?: boolean;
}): PatientProfile => ({
  name: patient.name,
  email: patient.email,
  phone: patient.phone ?? "",
  address: patient.address ?? "",
  visaType: patient.visaType as VisaType | undefined,
  emergencyContact: patient.emergencyContact ?? "",
  preferredLanguage: patient.preferredLanguage ?? "Japanese",
  notificationsEnabled: patient.notificationsEnabled ?? true,
});

export const handleGetProfile: RequestHandler = async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const patients = await getPatientsCollection();
    const lookupId = ObjectId.isValid(req.auth.id) ? new ObjectId(req.auth.id) : req.auth.id;
    const patient = await patients.findOne({ _id: lookupId });
    if (!patient) {
      return res.status(404).json({ error: "Profile not found." });
    }

    const response: PatientProfileResponse = {
      profile: toProfile(patient),
    };

    return res.json(response);
  } catch (error) {
    console.error("Profile fetch failed", error);
    return res.status(500).json({ error: "Failed to load profile." });
  }
};

export const handleRequestProfileEmailChangeOtp: RequestHandler = async (req, res, next) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = emailChangeRequestSchema.parse(parseRequestBody(req.body)) as ProfileEmailChangeRequest;
    const nextEmail = payload.email.toLowerCase();
    if (nextEmail === req.auth.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a different email address.",
      } satisfies OtpResponse);
    }

    const patients = await getPatientsCollection();
    const existing = await patients.findOne({ email: nextEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Email address already in use.",
      } satisfies OtpResponse);
    }

    const recentOtp = await getLatestEmailChangeOtp(nextEmail);
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
      email: nextEmail,
      otpHash,
      createdAt: new Date(),
      expiresAt,
      purpose: "profile_email_change",
    };
    await otps.insertOne(record);

    const emailContent = buildOtpEmail(otpCode);
    const sent = await sendEmail({
      to: nextEmail,
      subject: "Confirm your new DocNearMe email address",
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
      message: "Verification code sent to your new email.",
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

export const handleVerifyProfileEmailChangeOtp: RequestHandler = async (req, res, next) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = emailChangeVerifySchema.parse(parseRequestBody(req.body)) as ProfileEmailChangeVerifyRequest;
    const nextEmail = payload.email.toLowerCase();
    const otpRecord = await getLatestEmailChangeOtp(nextEmail);
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Verification code not found. Please request a new code.",
      } satisfies ProfileEmailChangeVerifyResponse);
    }
    if (otpRecord.usedAt) {
      return res.status(400).json({
        success: false,
        message: "Verification code has already been used.",
      } satisfies ProfileEmailChangeVerifyResponse);
    }
    if (otpRecord.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new one.",
      } satisfies ProfileEmailChangeVerifyResponse);
    }

    const otpOk = await verifyOtp(payload.otp, otpRecord.otpHash);
    if (!otpOk) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      } satisfies ProfileEmailChangeVerifyResponse);
    }

    const otps = await getEmailOtpsCollection();
    await otps.updateOne(
      { _id: otpRecord._id },
      {
        $set: {
          verifiedAt: new Date(),
          usedAt: new Date(),
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      emailProofToken: signProfileEmailProof(nextEmail),
    } satisfies ProfileEmailChangeVerifyResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification payload.",
      } satisfies ProfileEmailChangeVerifyResponse);
    }
    return next(error);
  }
};

export const handleRequestProfilePhoneChangeOtp: RequestHandler = async (req, res, next) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = phoneChangeRequestSchema.parse(parseRequestBody(req.body)) as ProfilePhoneChangeRequest;
    const normalizedPhone = normalizePhone(payload.phone);
    if (!isValidE164(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be in international format (e.g. +819012345678).",
      } satisfies OtpResponse);
    }

    const patients = await getPatientsCollection();
    const lookupId = ObjectId.isValid(req.auth.id) ? new ObjectId(req.auth.id) : req.auth.id;
    const patient = await patients.findOne({ _id: lookupId });
    const currentPhone = normalizePhone(patient?.phone ?? "");
    if (normalizedPhone === currentPhone) {
      return res.status(400).json({
        success: false,
        message: "Please provide a different phone number.",
      } satisfies OtpResponse);
    }

    const status = await requestPhoneVerification(normalizedPhone);
    if (status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Unable to send verification code. Please try again.",
      } satisfies OtpResponse);
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your new phone number.",
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

export const handleVerifyProfilePhoneChangeOtp: RequestHandler = async (req, res, next) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = phoneChangeVerifySchema.parse(parseRequestBody(req.body)) as ProfilePhoneChangeVerifyRequest;
    const normalizedPhone = normalizePhone(payload.phone);
    if (!isValidE164(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be in international format (e.g. +819012345678).",
      } satisfies ProfilePhoneChangeVerifyResponse);
    }

    const status = await checkPhoneVerification(normalizedPhone, payload.otp);
    if (status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code.",
      } satisfies ProfilePhoneChangeVerifyResponse);
    }

    return res.status(200).json({
      success: true,
      message: "Phone number verified successfully.",
      phoneProofToken: signProfilePhoneProof(normalizedPhone),
    } satisfies ProfilePhoneChangeVerifyResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone verification payload.",
      } satisfies ProfilePhoneChangeVerifyResponse);
    }
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Verification failed.",
      } satisfies ProfilePhoneChangeVerifyResponse);
    }
    return next(error);
  }
};

export const handleUpdateProfile: RequestHandler = async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = profileSchema.parse(parseRequestBody(req.body)) as PatientProfileUpdateRequest;
    const patients = await getPatientsCollection();
    const lookupId = ObjectId.isValid(req.auth.id) ? new ObjectId(req.auth.id) : req.auth.id;
    const patient = await patients.findOne({ _id: lookupId });
    if (!patient) {
      return res.status(404).json({ error: "Profile not found." });
    }

    const currentEmail = patient.email.trim().toLowerCase();
    const nextEmail = payload.email !== undefined ? payload.email.trim().toLowerCase() : undefined;
    const emailChanged = nextEmail !== undefined && nextEmail !== currentEmail;
    const currentPhone = normalizePhone(patient.phone ?? "");
    const nextPhone = payload.phone !== undefined ? normalizePhone(payload.phone) : undefined;
    const phoneChanged = nextPhone !== undefined && nextPhone !== currentPhone;

    if (emailChanged && nextEmail) {
      const existing = await patients.findOne({ email: nextEmail });
      if (existing) {
        return res.status(409).json({ error: "Email address already in use." });
      }
      if (!payload.emailProofToken || !verifyProfileEmailProof(payload.emailProofToken, nextEmail)) {
        return res.status(400).json({ error: "Please verify your new email address before saving." });
      }
    }

    if (phoneChanged && nextPhone) {
      if (!isValidE164(nextPhone)) {
        return res.status(400).json({ error: "Phone number must be in international format (e.g. +819012345678)." });
      }
      if (!payload.phoneProofToken || !verifyProfilePhoneProof(payload.phoneProofToken, nextPhone)) {
        return res.status(400).json({ error: "Please verify your new phone number before saving." });
      }
    }

    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.email !== undefined) updates.email = nextEmail;
    if (payload.phone !== undefined) {
      updates.phone = phoneChanged ? nextPhone : payload.phone.trim();
    }
    if (payload.address !== undefined) updates.address = payload.address.trim();
    if (payload.visaType !== undefined) updates.visaType = payload.visaType;
    if (payload.emergencyContact !== undefined) updates.emergencyContact = payload.emergencyContact.trim();
    if (payload.preferredLanguage !== undefined) updates.preferredLanguage = payload.preferredLanguage.trim();
    if (payload.notificationsEnabled !== undefined) updates.notificationsEnabled = payload.notificationsEnabled;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No profile updates provided." });
    }

    await patients.updateOne({ _id: lookupId }, { $set: updates });
    const updated = { ...patient, ...updates };

    const response: PatientProfileResponse = {
      profile: toProfile(updated),
    };

    if (emailChanged || phoneChanged) {
      try {
        await sendProfileChangeAlertToOldEmail(currentEmail, {
          nextEmail: emailChanged ? nextEmail : undefined,
          nextPhone: phoneChanged ? nextPhone : undefined,
        });
      } catch (error) {
        console.warn("Failed to send profile change email alert", error);
      }

      try {
        await sendProfileChangeAlertToOldPhone(currentPhone, {
          nextEmail: emailChanged ? nextEmail : undefined,
          nextPhone: phoneChanged ? nextPhone : undefined,
        });
      } catch (error) {
        console.warn("Failed to send profile change SMS alert", error);
      }
    }

    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid profile data.", issues: error.issues });
    }
    console.error("Profile update failed", error);
    return res.status(500).json({ error: "Failed to update profile." });
  }
};
