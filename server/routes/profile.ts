import { RequestHandler } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getPatientsCollection } from "../db";
import type { PatientProfile, PatientProfileResponse, PatientProfileUpdateRequest, VisaType } from "@shared/api";

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
  address: z.string().trim().max(200).optional(),
  visaType: z.enum(visaTypes).optional(),
  emergencyContact: z.string().trim().max(120).optional(),
  preferredLanguage: z.string().trim().max(40).optional(),
  notificationsEnabled: z.boolean().optional(),
});

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

    if (payload.email && payload.email !== patient.email) {
      const existing = await patients.findOne({ email: payload.email });
      if (existing) {
        return res.status(409).json({ error: "Email address already in use." });
      }
    }

    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.email !== undefined) updates.email = payload.email.trim().toLowerCase();
    if (payload.phone !== undefined) updates.phone = payload.phone.trim();
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

    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid profile data.", issues: error.issues });
    }
    console.error("Profile update failed", error);
    return res.status(500).json({ error: "Failed to update profile." });
  }
};
