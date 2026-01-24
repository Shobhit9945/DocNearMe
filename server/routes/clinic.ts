import { RequestHandler } from "express";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  getClinicAccountsCollection,
  getClinicDoctorsCollection,
  getClinicInfoCollection,
} from "../db";
import {
  ClinicCredentialsResponse,
  ClinicDoctorsResponse,
  ClinicDoctorsUpdateRequest,
  ClinicListResponse,
  ClinicLoginRequest,
  ClinicLoginResponse,
  ClinicProfileResponse,
  ClinicProfileUpdateRequest,
} from "@shared/api";

const jwtSecret =
  process.env.CLINIC_JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET ?? "dev-secret-change-me";
const jwtExpiry = process.env.CLINIC_JWT_EXPIRES_IN ?? "7d";

const loginSchema = z.object({
  userId: z.string().trim().min(3),
  password: z.string().min(6),
});

const clinicUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  location: z.string().trim().min(2).max(200).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  image: z.string().trim().min(5).optional(),
  specializations: z.array(z.string().trim().min(2).max(80)).optional(),
  nextAvailability: z.string().trim().min(2).max(80).optional(),
  hours: z
    .object({
      weekdays: z.string().trim().min(2).max(80),
      weekend: z.string().trim().min(2).max(80),
      closedDays: z.string().trim().min(2).max(120),
    })
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

const doctorsUpdateSchema = z.object({
  doctors: z.array(
    z.object({
      id: z.string().trim().min(2).max(80),
      clinicId: z.string().trim().min(2).max(80),
      name: z.string().trim().min(2).max(120),
      specialization: z.string().trim().min(2).max(120),
      languages: z.array(z.string().trim().min(2).max(60)),
      rating: z.number().min(0).max(5),
      nextAvailable: z.string().trim().min(2).max(80),
      availability: z.string().trim().min(1).max(120).optional(),
    }),
  ),
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

const buildClinicProfile = (clinic: any) => ({
  id: clinic.clinicId ?? clinic.id,
  name: clinic.name,
  type: clinic.type,
  rating: clinic.rating,
  patients: clinic.patients,
  distance: clinic.distance,
  location: clinic.location,
  image: clinic.image,
  specializations: clinic.specializations ?? [],
  nextAvailability: clinic.nextAvailability,
  googlePlaceId: clinic.googlePlaceId,
  phone: clinic.phone,
  hours: clinic.hours,
  pricing: clinic.pricing,
  photos: clinic.photos,
});

const buildDoctor = (doctor: any) => ({
  id: doctor.doctorId ?? doctor.id,
  clinicId: doctor.clinicId,
  name: doctor.name,
  specialization: doctor.specialization,
  languages: doctor.languages ?? [],
  rating: doctor.rating ?? 0,
  nextAvailable: doctor.nextAvailable ?? doctor.next_available ?? "Schedule TBD",
  availability: doctor.availability,
});

export const handleClinicLogin: RequestHandler = async (req, res, next) => {
  try {
    const payload = loginSchema.parse(parseRequestBody(req.body)) as ClinicLoginRequest;
    const accounts = await getClinicAccountsCollection();
    const account = await accounts.findOne({ userId: payload.userId });

    if (!account) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const matches = await bcryptjs.compare(payload.password, account.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    await accounts.updateOne(
      { userId: account.userId },
      { $set: { lastLoginAt: new Date() } },
    );

    const token = jwt.sign(
      {
        sub: account.userId,
        clinicId: account.clinicId,
        userId: account.userId,
      },
      jwtSecret,
      { expiresIn: jwtExpiry },
    );

    const response: ClinicLoginResponse = {
      token,
      clinicId: account.clinicId,
    };

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const handleClinicCredentials: RequestHandler = async (req, res, next) => {
  try {
    if (!req.clinicAuth?.clinicId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const clinicId = req.clinicAuth.clinicId;
    const accounts = await getClinicAccountsCollection();
    const clinics = await getClinicInfoCollection();
    const clinic = await clinics.findOne({ clinicId });
    const accountList = await accounts.find({ clinicId }).toArray();
    const response: ClinicCredentialsResponse = {
      credentials: accountList.map((account) => ({
        clinicId: account.clinicId,
        clinicName: clinic?.name ?? account.clinicId,
        userId: account.userId,
      })),
    };

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const handleClinicList: RequestHandler = async (_req, res, next) => {
  try {
    const clinics = await getClinicInfoCollection();
    const list = await clinics.find({}).sort({ name: 1 }).toArray();
    const response: ClinicListResponse = {
      clinics: list.map(buildClinicProfile),
    };
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const handleClinicProfile: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.params.clinicId;
    const clinics = await getClinicInfoCollection();
    const clinic = await clinics.findOne({ clinicId });
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found." });
    }
    const response: ClinicProfileResponse = {
      clinic: buildClinicProfile(clinic),
    };
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const handleClinicDoctors: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.params.clinicId;
    const doctors = await getClinicDoctorsCollection();
    const list = await doctors.find({ clinicId }).toArray();
    const response: ClinicDoctorsResponse = {
      doctors: list.map(buildDoctor),
    };
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const handleClinicDoctorsAll: RequestHandler = async (_req, res, next) => {
  try {
    const doctors = await getClinicDoctorsCollection();
    const list = await doctors.find({}).toArray();
    const response: ClinicDoctorsResponse = {
      doctors: list.map(buildDoctor),
    };
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const handleUpdateClinicProfile: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.params.clinicId;
    if (req.clinicAuth?.clinicId !== clinicId) {
      return res.status(403).json({ error: "Not authorized to update this clinic." });
    }

    const payload = clinicUpdateSchema.parse(parseRequestBody(req.body)) as ClinicProfileUpdateRequest;
    const clinics = await getClinicInfoCollection();
    const existing = await clinics.findOne({ clinicId });
    if (!existing) {
      return res.status(404).json({ error: "Clinic not found." });
    }

    await clinics.updateOne(
      { clinicId },
      {
        $set: {
          ...payload,
          updatedAt: new Date(),
        },
      },
    );

    const refreshed = await clinics.findOne({ clinicId });
    const response: ClinicProfileResponse = {
      clinic: buildClinicProfile(refreshed ?? existing),
    };
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const handleUpdateClinicDoctors: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.params.clinicId;
    if (req.clinicAuth?.clinicId !== clinicId) {
      return res.status(403).json({ error: "Not authorized to update this clinic." });
    }

    const payload = doctorsUpdateSchema.parse(parseRequestBody(req.body)) as ClinicDoctorsUpdateRequest;
    const doctors = await getClinicDoctorsCollection();
    const existing = await doctors.find({ clinicId }).toArray();
    const incomingIds = new Set(payload.doctors.map((doctor) => doctor.id));

    for (const record of existing) {
      const recordId = record.doctorId ?? record.id;
      if (recordId && !incomingIds.has(recordId)) {
        await doctors.deleteOne({ clinicId, doctorId: recordId });
      }
    }

    for (const doctor of payload.doctors) {
      if (doctor.clinicId !== clinicId) {
        return res.status(400).json({ error: "Doctor clinicId does not match authenticated clinic." });
      }
      const conflictingDoctor = await doctors.findOne({
        doctorId: doctor.id,
        clinicId: { $ne: clinicId },
      });
      if (conflictingDoctor) {
        return res.status(409).json({ error: "Doctor ID already belongs to another clinic." });
      }
    }

    for (const doctor of payload.doctors) {
      const existingDoctor = await doctors.findOne({ clinicId, doctorId: doctor.id });
      const record = {
        clinicId,
        doctorId: doctor.id,
        name: doctor.name,
        specialization: doctor.specialization,
        languages: doctor.languages,
        rating: doctor.rating,
        nextAvailable: doctor.nextAvailable,
        availability: doctor.availability,
        updatedAt: new Date(),
      };

      if (existingDoctor) {
        await doctors.updateOne({ clinicId, doctorId: doctor.id }, { $set: record });
      } else {
        await doctors.insertOne(record);
      }
    }

    const refreshed = await doctors.find({ clinicId }).toArray();
    const response: ClinicDoctorsResponse = {
      doctors: refreshed.map(buildDoctor),
    };
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};
