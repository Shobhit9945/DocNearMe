import { RequestHandler } from "express";
import crypto from "crypto";
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
import { validateClinicClosureDates } from "../lib/clinic-closures";
import { isValidNotificationEmail } from "../lib/clinic-validation";

const getClinicJwtSecret = () => {
  const secret = process.env.CLINIC_JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET;
  if (!secret || secret === "dev-secret-change-me") {
    throw new Error("CLINIC_JWT_SECRET (or AUTH_JWT_SECRET/JWT_SECRET) must be configured.");
  }
  return secret;
};
const jwtExpiry = process.env.CLINIC_JWT_EXPIRES_IN ?? "7d";

const loginSchema = z.object({
  userId: z.string().trim().min(3),
  password: z.string().min(6),
});

const clinicUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  location: z.string().trim().min(2).max(200).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  email: z.string().trim().email().optional(),
  googlePlaceId: z.string().trim().min(2).max(120).optional(),
  image: z.string().trim().min(5).optional(),
  nextAvailability: z.string().trim().min(2).max(80).optional(),
  immediateWoundCare: z.boolean().optional(),
  bookingEnabled: z.boolean().optional(),
  notificationEmailEnabled: z.boolean().optional(),
  notificationPhoneEnabled: z.boolean().optional(),
  notificationLineEnabled: z.boolean().optional(),
  notification_email_enabled: z.boolean().optional(),
  notification_phone_enabled: z.boolean().optional(),
  notification_line_enabled: z.boolean().optional(),
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
        endDate: z.string().trim().min(10).max(10).optional(),
        startTime: z.string().trim().min(4).max(10).optional(),
        endTime: z.string().trim().min(4).max(10).optional(),
        reason: z.string().trim().max(200).optional(),
        id: z.string().trim().min(8).max(80).optional(),
        createdAt: z.date().optional().or(z.string().optional()),
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

const availabilitySlotSchema = z.object({
  days: z.array(z.string().trim().min(2).max(10)).min(1),
  startTime: z.string().trim().min(4).max(10),
  endTime: z.string().trim().min(4).max(10),
});

const weekdayOrder = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const normalizeDay = (day: string) => day.trim().slice(0, 3).toLowerCase();

const normalizeClinicPhone = (value?: string) => {
  if (!value) return value;
  const compact = value.replace(/[\s\-()]/g, "");
  if (!compact) return "";
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\D/g, "")}`;
  }
  const digits = compact.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `+81${digits}` : "";
};

const isValidE164 = (value?: string) => (!value ? true : /^\+\d{7,15}$/.test(value));

const parseTimeMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const formatSlotLabel = (time: string) => {
  const minutes = parseTimeMinutes(time);
  if (minutes === null) return null;
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
};

export const computeDoctorNextAvailability = (availability?: { days: string[]; startTime: string }[]) => {
  if (!availability || availability.length === 0) return null;
  const now = new Date();
  const todayMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const dayLabel = normalizeDay(weekdayOrder[date.getDay()]);

    const slots = availability
      .filter((slot) => slot.days?.some((day) => normalizeDay(day) === dayLabel))
      .map((slot) => parseTimeMinutes(slot.startTime))
      .filter((minutes): minutes is number => typeof minutes === "number")
      .sort((a, b) => a - b);

    const nextMinutes = slots.find((minutes) => offset > 0 || minutes > todayMinutes);
    if (nextMinutes !== undefined) {
      const hours = String(Math.floor(nextMinutes / 60)).padStart(2, "0");
      const minutes = String(nextMinutes % 60).padStart(2, "0");
      const slotLabel = formatSlotLabel(`${hours}:${minutes}`);
      if (slotLabel) {
        return buildNextAvailabilityLabel(date, slotLabel);
      }
    }
  }

  return null;
};

const doctorsUpdateSchema = z.object({
  doctors: z.array(
    z.object({
      id: z.string().trim().min(2).max(80),
      clinicId: z.string().trim().min(2).max(80),
      name: z.string().trim().min(2).max(120),
      specialization: z.string().trim().min(2).max(120),
      languages: z.array(z.string().trim().min(2).max(60)),
      rating: z.number().min(0).max(5),
      nextAvailable: z.string().trim().min(2).max(80).optional(),
      availability: z.array(availabilitySlotSchema).optional(),
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

export const buildClinicProfile = (clinic: any, specializations?: string[], nextAvailability?: string) => ({
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
  immediateWoundCare: Boolean(clinic.immediateWoundCare),
  bookingEnabled: clinic.bookingEnabled !== false,
  googlePlaceId: clinic.googlePlaceId,
  phone: clinic.phone,
  email: clinic.email,
  notificationEmailEnabled: clinic.notificationEmailEnabled ?? clinic.notification_email_enabled ?? true,
  notificationPhoneEnabled: Boolean(clinic.notificationPhoneEnabled ?? clinic.notification_phone_enabled),
  notificationLineEnabled: Boolean(clinic.notificationLineEnabled ?? clinic.notification_line_enabled),
  notification_email_enabled: clinic.notificationEmailEnabled ?? clinic.notification_email_enabled ?? true,
  notification_phone_enabled: Boolean(clinic.notificationPhoneEnabled ?? clinic.notification_phone_enabled),
  notification_line_enabled: Boolean(clinic.notificationLineEnabled ?? clinic.notification_line_enabled),
  hours: clinic.hours,
  bookingClosures: clinic.bookingClosures,
  pricing: clinic.pricing,
  photos: clinic.photos,
});

const buildDoctor = (doctor: any) => {
  const availability = Array.isArray(doctor.availability) ? doctor.availability : [];
  return {
    id: doctor.doctorId ?? doctor.id,
    clinicId: doctor.clinicId,
    name: doctor.name,
    specialization: doctor.specialization,
    languages: doctor.languages ?? [],
    rating: doctor.rating ?? 0,
    nextAvailable:
      computeDoctorNextAvailability(availability) ??
      doctor.nextAvailable ??
      doctor.next_available ??
      "Schedule TBD",
    availability,
  };
};

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
      getClinicJwtSecret(),
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

export const handleClinicMe: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.clinicAuth?.clinicId;
    if (!clinicId) {
      return res.status(401).json({ error: "Authentication required." });
    }
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
    const normalizedPhone = normalizeClinicPhone(payload.phone);
    if (!isValidE164(normalizedPhone)) {
      return res.status(400).json({ error: "Phone number must be in E.164 format." });
    }
    const enforcedPayload: ClinicProfileUpdateRequest = {
      ...payload,
      phone: normalizedPhone,
      notificationEmailEnabled: true,
      notification_email_enabled: true,
    };
    const clinics = await getClinicInfoCollection();
    const existing = await clinics.findOne({ clinicId });
    if (!existing) {
      return res.status(404).json({ error: "Clinic not found." });
    }

    await clinics.updateOne(
      { clinicId },
      {
        $set: {
          ...enforcedPayload,
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

export const handlePatchClinicMe: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.clinicAuth?.clinicId;
    if (!clinicId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = clinicUpdateSchema.parse(parseRequestBody(req.body)) as ClinicProfileUpdateRequest;
    const normalizedPhone = normalizeClinicPhone(payload.phone);
    if (!isValidE164(normalizedPhone)) {
      return res.status(400).json({ error: "Phone number must be in E.164 format." });
    }
    if (payload.email && !isValidNotificationEmail(payload.email)) {
      return res.status(400).json({ error: "Invalid notification email." });
    }

    const enforcedPayload: ClinicProfileUpdateRequest = {
      ...payload,
      phone: normalizedPhone,
      notificationEmailEnabled: true,
      notification_email_enabled: true,
    };

    const clinics = await getClinicInfoCollection();
    const existing = await clinics.findOne({ clinicId });
    if (!existing) {
      return res.status(404).json({ error: "Clinic not found." });
    }

    await clinics.updateOne(
      { clinicId },
      {
        $set: {
          ...enforcedPayload,
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
      clinic: buildClinicProfile(refreshed ?? existing, collectClinicSpecializations(doctorList), nextAvailability),
    };
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const handleAddClinicClosure: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.clinicAuth?.clinicId;
    if (!clinicId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const payload = parseRequestBody(req.body) as any;
    const result = validateClinicClosureDates(payload);
    if (!result.ok) {
      return res.status(400).json({ error: "Invalid closure dates." });
    }

    const reason = typeof payload?.reason === "string" ? payload.reason.trim() : "";
    const closure = {
      id: crypto.randomUUID(),
      startDate: result.startDate,
      endDate: result.endDate,
      startTime: result.startTime,
      endTime: result.endTime,
      reason: reason || undefined,
      createdAt: new Date(),
    };

    const clinics = await getClinicInfoCollection();
    const clinic = await clinics.findOne({ clinicId });
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found." });
    }

    const nextClosures = [...(clinic.bookingClosures ?? []), closure];
    await clinics.updateOne(
      { clinicId },
      {
        $set: {
          bookingClosures: nextClosures,
          updatedAt: new Date(),
        },
      },
    );

    const refreshed = await clinics.findOne({ clinicId });
    const doctors = await getClinicDoctorsCollection();
    const doctorList = await doctors.find({ clinicId }).toArray();
    const appointments = await getAppointmentsCollection();
    const appointmentList = await appointments.find({ clinicId }).toArray();
    const nextAvailability = computeNextAvailability(refreshed ?? clinic, appointmentList);
    const response: ClinicProfileResponse = {
      clinic: buildClinicProfile(refreshed ?? clinic, collectClinicSpecializations(doctorList), nextAvailability),
    };
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const handleDeleteClinicClosure: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.clinicAuth?.clinicId;
    if (!clinicId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const closureId = req.params.closureId;
    const clinics = await getClinicInfoCollection();
    const clinic = await clinics.findOne({ clinicId });
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found." });
    }

    const nextClosures = (clinic.bookingClosures ?? []).filter((entry) => entry.id !== closureId);
    await clinics.updateOne(
      { clinicId },
      {
        $set: {
          bookingClosures: nextClosures,
          updatedAt: new Date(),
        },
      },
    );

    const refreshed = await clinics.findOne({ clinicId });
    const doctors = await getClinicDoctorsCollection();
    const doctorList = await doctors.find({ clinicId }).toArray();
    const appointments = await getAppointmentsCollection();
    const appointmentList = await appointments.find({ clinicId }).toArray();
    const nextAvailability = computeNextAvailability(refreshed ?? clinic, appointmentList);
    const response: ClinicProfileResponse = {
      clinic: buildClinicProfile(refreshed ?? clinic, collectClinicSpecializations(doctorList), nextAvailability),
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
    if (incomingIds.size !== payload.doctors.length) {
      return res.status(400).json({ error: "Doctor IDs must be unique per clinic." });
    }

    for (const record of existing) {
      const recordId = record.doctorId ?? record.id;
      if (recordId && !incomingIds.has(recordId)) {
        await doctors.deleteOne({ clinicId, doctorId: recordId });
      }
    }

    await Promise.all(
      payload.doctors.map(async (doctor) => {
        const existingDoctor = await doctors.findOne({ clinicId, doctorId: doctor.id });
        const computedNextAvailable =
          computeDoctorNextAvailability(doctor.availability) ??
          doctor.nextAvailable ??
          "Schedule TBD";
        const record = {
          clinicId,
          doctorId: doctor.id,
          name: doctor.name,
          specialization: doctor.specialization,
          languages: doctor.languages,
          rating: doctor.rating,
          nextAvailable: computedNextAvailable,
          availability: doctor.availability,
          updatedAt: new Date(),
        };

        if (existingDoctor) {
          await doctors.updateOne({ clinicId, doctorId: doctor.id }, { $set: record });
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
