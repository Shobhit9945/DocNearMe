import { RequestHandler } from "express";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import {
  getClinicAccountsCollection,
  getClinicDoctorsCollection,
  getClinicInfoCollection,
} from "../db";
import type {
  AdminAuthCheckResponse,
  AdminCreateClinicRequest,
  AdminCreateClinicResponse,
  ClinicDoctor,
  ClinicProfile,
} from "@shared/api";

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

const clinicHoursSchema = z.object({
  weekdays: z.object({ start: z.string().trim().min(1), end: z.string().trim().min(1) }),
  weekend: z.object({ start: z.string().trim().min(1), end: z.string().trim().min(1) }),
  closedDays: z.array(z.string().trim().min(1)),
  slotMinutes: z.number().min(10).max(120).optional(),
});

const clinicSchema = z.object({
  id: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["Hospital", "Clinic"]),
  rating: z.number().min(0).max(5),
  patients: z.string().trim().min(1).max(120),
  distance: z.string().trim().min(1).max(120),
  location: z.string().trim().min(2).max(200),
  image: z.string().trim().min(5).max(500),
  specializations: z.array(z.string().trim().min(2).max(120)),
  nextAvailability: z.string().trim().min(2).max(80),
  googlePlaceId: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  hours: clinicHoursSchema.optional(),
  bookingClosures: z
    .array(
      z.object({
        startDate: z.string().trim().min(10).max(10),
        endDate: z.string().trim().min(10).max(10),
        startTime: z.string().trim().min(4).max(10).optional(),
        endTime: z.string().trim().min(4).max(10).optional(),
        reason: z.string().trim().max(200).optional(),
      }),
    )
    .optional(),
  pricing: z
    .object({
      firstVisit: z.string().trim().min(1).max(40),
      followUp: z.string().trim().min(1).max(40),
      otherServices: z.string().trim().min(1).max(200),
    })
    .optional(),
  photos: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        url: z.string().trim().min(5).max(500),
      }),
    )
    .optional(),
});

const doctorSchema = z.object({
  id: z.string().trim().min(2).max(80),
  clinicId: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  specialization: z.string().trim().min(2).max(120),
  languages: z.array(z.string().trim().min(2).max(60)),
  rating: z.number().min(0).max(5),
  nextAvailable: z.string().trim().min(2).max(80),
  availability: z.string().trim().min(1).max(120).optional(),
});

const adminCreateClinicSchema = z.object({
  clinic: clinicSchema,
  doctors: z.array(doctorSchema).optional(),
  adminUserId: z.string().trim().min(3).max(120).optional(),
  adminPassword: z.string().trim().min(6).max(120).optional(),
});

const resolveSpecializations = (clinic: ClinicProfile, doctors: ClinicDoctor[] = []) => {
  if (clinic.specializations.length) return clinic.specializations;
  const collected = new Set<string>();
  doctors.forEach((doctor) => {
    const specialization = doctor.specialization.trim();
    if (specialization) collected.add(specialization);
  });
  return Array.from(collected);
};

export const handleAdminAuthCheck: RequestHandler = (_req, res) => {
  const response: AdminAuthCheckResponse = { ok: true };
  return res.json(response);
};

export const handleAdminCreateClinic: RequestHandler = async (req, res, next) => {
  try {
    const payload = adminCreateClinicSchema.parse(parseRequestBody(req.body)) as AdminCreateClinicRequest;
    const clinicPayload = payload.clinic;
    const clinicId = clinicPayload.id.trim();
    const adminUserId = payload.adminUserId?.trim() || `${clinicId}-admin`;
    const adminPassword = payload.adminPassword?.trim() || `clinic-${clinicId}-2024`;

    const clinics = await getClinicInfoCollection();
    const existingClinic = await clinics.findOne({ clinicId });
    if (existingClinic) {
      return res.status(409).json({ error: "Clinic already exists." });
    }

    const accounts = await getClinicAccountsCollection();
    const existingAccount = await accounts.findOne({ userId: adminUserId });
    if (existingAccount) {
      return res.status(409).json({ error: "Clinic admin user already exists." });
    }

    const doctors = payload.doctors?.map((doctor) => ({
      ...doctor,
      clinicId: clinicId,
    }));

    const clinic: ClinicProfile = {
      ...clinicPayload,
      id: clinicId,
      specializations: resolveSpecializations(clinicPayload, doctors),
    };

    await clinics.insertOne({
      ...clinic,
      clinicId,
      updatedAt: new Date(),
    });

    if (doctors?.length) {
      const clinicDoctors = await getClinicDoctorsCollection();
      await Promise.all(
        doctors.map((doctor) =>
          clinicDoctors.insertOne({
            clinicId: clinicId,
            doctorId: doctor.id,
            name: doctor.name,
            specialization: doctor.specialization,
            languages: doctor.languages,
            rating: doctor.rating,
            nextAvailable: doctor.nextAvailable,
            availability: doctor.availability,
            updatedAt: new Date(),
          }),
        ),
      );
    }

    const passwordHash = await bcryptjs.hash(adminPassword, 10);
    await accounts.insertOne({
      clinicId,
      userId: adminUserId,
      passwordHash,
      tempPassword: adminPassword,
      createdAt: new Date(),
    });

    const response: AdminCreateClinicResponse = {
      clinicId,
      clinicName: clinic.name,
      adminUserId,
      adminPassword,
    };
    return res.status(201).json(response);
  } catch (error) {
    return next(error);
  }
};
