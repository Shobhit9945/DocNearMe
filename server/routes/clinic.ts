import { RequestHandler } from "express";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  getClinicAccountsCollection,
  getClinicDoctorsCollection,
  getClinicInfoCollection,
  getAppointmentsCollection,
} from "../db";
import {
  applyBookingClosuresToSlots,
  buildNextAvailabilityLabel,
  buildSlotsForDate,
  getDateKey,
  getSlotDateTime,
  isClinicClosedOnDate,
  normalizeClinicHours,
} from "../lib/scheduling";
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
  nextAvailability: z.string().trim().min(2).max(80).optional(),
  hours: z
    .object({
      weekdays: z
        .object({
          start: z.string().trim().min(4).max(10),
          end: z.string().trim().min(4).max(10),
        })
        .or(z.string().trim().min(2).max(80)),
      weekend: z
        .object({
          start: z.string().trim().min(4).max(10),
          end: z.string().trim().min(4).max(10),
        })
        .or(z.string().trim().min(2).max(80)),
      closedDays: z.array(z.string().trim().min(2).max(20)).or(z.string().trim().max(120)),
      slotMinutes: z.number().min(10).max(120).optional(),
    })
    .optional(),
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

const collectClinicSpecializations = (doctors: any[]) => {
  const specializations = new Set<string>();

  doctors.forEach((doctor) => {
    const specialization = typeof doctor.specialization === "string" ? doctor.specialization.trim() : "";
    if (specialization) {
      specializations.add(specialization);
    }
  });

  return Array.from(specializations).sort((a, b) => a.localeCompare(b));
};

const buildClinicProfile = (clinic: any, specializations?: string[], nextAvailability?: string) => ({
  id: clinic.clinicId ?? clinic.id,
  name: clinic.name,
  type: clinic.type,
  rating: clinic.rating,
  patients: clinic.patients,
  distance: clinic.distance,
  location: clinic.location,
  image: clinic.image,
  specializations: specializations ?? [],
  nextAvailability: nextAvailability ?? clinic.nextAvailability,
  googlePlaceId: clinic.googlePlaceId,
  phone: clinic.phone,
  hours: clinic.hours,
  bookingClosures: clinic.bookingClosures,
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

const buildBookedSlotMap = (appointments: any[]) => {
  const bookedByDate = new Map<string, Set<string>>();
  appointments
    .filter((appt) => !appt.status || appt.status === "CONFIRMED")
    .forEach((appt) => {
      const dateKey = appt.dateKey ?? (typeof appt.date === "string" ? appt.date.split("T")[0] : "");
      if (!dateKey || !appt.slot) return;
      const existing = bookedByDate.get(dateKey) ?? new Set<string>();
      existing.add(appt.slot);
      bookedByDate.set(dateKey, existing);
    });
  return bookedByDate;
};

const computeNextAvailability = (clinic: any, appointments: any[]) => {
  const hours = normalizeClinicHours(clinic.hours);
  const bookedByDate = buildBookedSlotMap(appointments);
  const now = new Date();
  const todayKey = getDateKey(now);
  const maxDays = 14;

  for (let offset = 0; offset < maxDays; offset += 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);

    const closureCheck = isClinicClosedOnDate(date, hours, clinic.bookingClosures);
    if (closureCheck.closed) continue;

    let slots = buildSlotsForDate(date, hours);
    const closureSlots = applyBookingClosuresToSlots(date, slots, clinic.bookingClosures);
    if (closureSlots.isClosed) continue;
    slots = closureSlots.slots;
    const dateKey = getDateKey(date);
    const bookedSlots = bookedByDate.get(dateKey) ?? new Set<string>();
    slots = slots.filter((slot) => !bookedSlots.has(slot));
    if (dateKey === todayKey) {
      slots = slots.filter((slot) => {
        const slotDate = getSlotDateTime(date, slot);
        return slotDate ? slotDate.getTime() > now.getTime() : false;
      });
    }
    if (slots.length > 0) {
      return buildNextAvailabilityLabel(date, slots[0]);
    }
  }

  return "No availability";
};

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

export const handleClinicCredentials: RequestHandler = async (_req, res, next) => {
  try {
    const accounts = await getClinicAccountsCollection();
    const clinics = await getClinicInfoCollection();
    const clinicList = await clinics.find({}).toArray();
    const clinicMap = new Map(clinicList.map((clinic) => [clinic.clinicId ?? clinic.id, clinic.name]));

    const accountList = await accounts.find({}).toArray();
    const response: ClinicCredentialsResponse = {
      credentials: accountList.map((account) => ({
        clinicId: account.clinicId,
        clinicName: clinicMap.get(account.clinicId) ?? account.clinicId,
        userId: account.userId,
        password: account.tempPassword ?? "Use existing password",
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
    const doctors = await getClinicDoctorsCollection();
    const doctorList = await doctors.find({}).toArray();
    const appointments = await getAppointmentsCollection();
    const appointmentList = await appointments.find({}).toArray();
    const appointmentsByClinic = new Map<string, any[]>();
    appointmentList.forEach((appointment) => {
      const clinicId = appointment.clinicId ?? appointment.clinic_id;
      if (!clinicId) return;
      const existing = appointmentsByClinic.get(clinicId) ?? [];
      existing.push(appointment);
      appointmentsByClinic.set(clinicId, existing);
    });
    const specializationsByClinic = new Map<string, Set<string>>();

    doctorList.forEach((doctor) => {
      const clinicId = doctor.clinicId ?? doctor.clinic_id;
      if (!clinicId) return;
      const specialization = typeof doctor.specialization === "string" ? doctor.specialization.trim() : "";
      if (specialization) {
        const existing = specializationsByClinic.get(clinicId) ?? new Set<string>();
        existing.add(specialization);
        specializationsByClinic.set(clinicId, existing);
      }
    });

    const response: ClinicListResponse = {
      clinics: list.map((clinic) => {
        const clinicId = clinic.clinicId ?? clinic.id;
        const specializations = Array.from(specializationsByClinic.get(clinicId) ?? []).sort((a, b) =>
          a.localeCompare(b),
        );
        const nextAvailability = computeNextAvailability(clinic, appointmentsByClinic.get(clinicId) ?? []);
        return buildClinicProfile(clinic, specializations, nextAvailability);
      }),
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
    const doctors = await getClinicDoctorsCollection();
    const doctorList = await doctors.find({ clinicId }).toArray();
    const appointments = await getAppointmentsCollection();
    const appointmentList = await appointments.find({ clinicId }).toArray();
    const nextAvailability = computeNextAvailability(clinic, appointmentList);
    const response: ClinicProfileResponse = {
      clinic: buildClinicProfile(clinic, collectClinicSpecializations(doctorList), nextAvailability),
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
    const doctors = await getClinicDoctorsCollection();
    const doctorList = await doctors.find({ clinicId }).toArray();
    const appointments = await getAppointmentsCollection();
    const appointmentList = await appointments.find({ clinicId }).toArray();
    const nextAvailability = computeNextAvailability(refreshed ?? existing, appointmentList);
    const response: ClinicProfileResponse = {
      clinic: buildClinicProfile(
        refreshed ?? existing,
        collectClinicSpecializations(doctorList),
        nextAvailability,
      ),
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

    await Promise.all(
      payload.doctors.map(async (doctor) => {
        const existingDoctor = await doctors.findOne({ doctorId: doctor.id });
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
          await doctors.updateOne({ doctorId: doctor.id }, { $set: record });
        } else {
          await doctors.insertOne(record);
        }
      }),
    );

    const refreshed = await doctors.find({ clinicId }).toArray();
    const response: ClinicDoctorsResponse = {
      doctors: refreshed.map(buildDoctor),
    };
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};
