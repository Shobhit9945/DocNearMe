import { RequestHandler } from "express";
import crypto from "crypto";
import { ZodError, z } from "zod";
import bcryptjs from "bcryptjs";
import {
  getClinicAccountsCollection,
  getClinicDoctorsCollection,
  getClinicInfoCollection,
  getCustomLabelsCollection,
} from "../db";
import { computeDoctorNextAvailability } from "./clinic";
import { getAuditRequestMeta, listAuditLogs, logAuditEvent } from "../services/audit-log";
import { getResolvedCallSettings, saveCallSettings } from "../services/call-settings";
import type {
  AdminAuditLogsResponse,
  AdminAuthCheckResponse,
  AdminCallSettingsResponse,
  AdminCallSettingsUpdateRequest,
  AdminCreateClinicRequest,
  AdminCreateClinicResponse,
  AuditAction,
  AuditActorRole,
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
  rating: z.number().min(0).max(5).optional(),
  patients: z.string().trim().min(1).max(120).optional(),
  distance: z.string().trim().min(1).max(120).optional(),
  location: z.string().trim().min(2).max(200),
  image: z.string().trim().min(5).max(500),
  description: z.string().trim().max(2000).optional(),
  nextAvailability: z.string().trim().min(2).max(80).optional(),
  googlePlaceId: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  email: z.string().trim().email().optional(),
  notificationEmailEnabled: z.boolean().optional(),
  notificationPhoneEnabled: z.boolean().optional(),
  notificationLineEnabled: z.boolean().optional(),
  notification_email_enabled: z.boolean().optional(),
  notification_phone_enabled: z.boolean().optional(),
  notification_line_enabled: z.boolean().optional(),
  bookingEnabled: z.boolean().optional(),
  immediateWoundCare: z.boolean().optional(),
  customLabelIds: z.array(z.string().trim().min(1).max(80)).optional(),
  hours: clinicHoursSchema.optional(),
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

const doctorSchema = z.object({
  id: z.string().trim().min(2).max(80),
  clinicId: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  specialization: z.string().trim().min(2).max(120),
  languages: z.array(z.string().trim().min(2).max(60)),
  rating: z.number().min(0).max(5),
  nextAvailable: z.string().trim().min(2).max(80).optional(),
  availability: z.array(availabilitySlotSchema).optional(),
});

const adminCreateClinicSchema = z.object({
  clinic: clinicSchema,
  doctors: z.array(doctorSchema).optional(),
  adminUserId: z.string().trim().min(3).max(120).optional(),
  adminPassword: z.string().trim().min(12).max(120).optional(),
});

const generateStrongAdminPassword = () => crypto.randomBytes(18).toString("base64url");

const auditActions: AuditAction[] = [
  "patient_account_created",
  "clinic_account_created",
  "appointment_booked",
  "appointment_confirmed",
  "appointment_declined",
  "appointment_cancelled_by_patient",
  "appointment_cancelled_by_clinic",
  "appointment_reschedule_requested",
  "appointment_completed",
  "appointment_deleted_by_clinic",
  "admin_change",
];

const auditActorRoles: AuditActorRole[] = ["patient", "clinic", "admin", "system"];

const adminAuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  action: z.enum(auditActions as [AuditAction, ...AuditAction[]]).optional(),
  actorRole: z.enum(auditActorRoles as [AuditActorRole, ...AuditActorRole[]]).optional(),
  clinicId: z.string().trim().min(1).max(120).optional(),
  patientId: z.string().trim().min(1).max(120).optional(),
  appointmentId: z.string().trim().min(1).max(120).optional(),
});

const adminCallSettingsSchema = z.object({
  provider: z.enum(["twilio", "elevenlabs"]),
  fallbackToTwilio: z.boolean(),
});


/**
 * Auth-check endpoint that validates credentials inline (without WWW-Authenticate header)
 * so the browser never shows a native Basic-Auth dialog.
 */
export const handleAdminAuthCheck: RequestHandler = (req, res) => {
  const adminUsername = process.env.ADMIN_USERNAME ?? process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) {
    return res.status(500).json({ ok: false, error: "Admin authentication is not configured." });
  }

  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res.status(401).json({ ok: false, error: "Missing credentials." });
  }
  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) {
    return res.status(401).json({ ok: false, error: "Invalid credentials." });
  }
  let parsedUsername = "";
  let parsedPassword = "";
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return res.status(401).json({ ok: false, error: "Invalid credentials." });
    parsedUsername = decoded.slice(0, idx);
    parsedPassword = decoded.slice(idx + 1);
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid credentials." });
  }

  const uBuf = Buffer.from(parsedUsername);
  const pBuf = Buffer.from(parsedPassword);
  const euBuf = Buffer.from(adminUsername);
  const epBuf = Buffer.from(adminPassword);
  const userOk = uBuf.length === euBuf.length && crypto.timingSafeEqual(uBuf, euBuf);
  const passOk = pBuf.length === epBuf.length && crypto.timingSafeEqual(pBuf, epBuf);
  if (!userOk || !passOk) {
    return res.status(401).json({ ok: false, error: "Invalid credentials." });
  }

  req.adminAuth = { username: parsedUsername };
  const response: AdminAuthCheckResponse = { ok: true };
  return res.json(response);
};

export const handleAdminClinicList: RequestHandler = async (_req, res, next) => {
  try {
    const clinics = await getClinicInfoCollection();
    const list = await clinics.find({}).toArray();
    return res.json({ clinics: list });
  } catch (error) {
    return next(error);
  }
};

export const handleAdminCreateClinic: RequestHandler = async (req, res, next) => {
  try {
    const payload = adminCreateClinicSchema.parse(parseRequestBody(req.body)) as AdminCreateClinicRequest;
    const clinicPayload = payload.clinic;
    const clinicId = clinicPayload.id.trim();
    const adminUserId = payload.adminUserId?.trim() || `${clinicId}-admin`;
    const adminPassword = payload.adminPassword?.trim() || generateStrongAdminPassword();

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
      rating: clinicPayload.rating ?? 0,
      patients: clinicPayload.patients ?? "",
      distance: clinicPayload.distance ?? "",
      nextAvailability: clinicPayload.nextAvailability ?? "",
      specializations: [],
    };

    await clinics.insertOne({
      ...clinic,
      clinicId,
      notificationEmailEnabled: clinic.notificationEmailEnabled ?? clinic.notification_email_enabled ?? true,
      notificationPhoneEnabled: clinic.notificationPhoneEnabled ?? clinic.notification_phone_enabled ?? false,
      notificationLineEnabled: clinic.notificationLineEnabled ?? clinic.notification_line_enabled ?? false,
      notification_email_enabled: clinic.notificationEmailEnabled ?? clinic.notification_email_enabled ?? true,
      notification_phone_enabled: clinic.notificationPhoneEnabled ?? clinic.notification_phone_enabled ?? false,
      notification_line_enabled: clinic.notificationLineEnabled ?? clinic.notification_line_enabled ?? false,
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
            nextAvailable: computeDoctorNextAvailability(doctor.availability) ?? doctor.nextAvailable ?? "Schedule TBD",
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
      createdAt: new Date(),
    });

    const adminUsername = req.adminAuth?.username ?? "admin";
    const requestMeta = getAuditRequestMeta(req);
    await logAuditEvent({
      action: "clinic_account_created",
      actorRole: "admin",
      actorId: adminUsername,
      actorLabel: adminUsername,
      clinicId,
      targetType: "clinic_account",
      targetId: adminUserId,
      details: {
        clinicName: clinic.name,
      },
      ...requestMeta,
    });
    await logAuditEvent({
      action: "admin_change",
      actorRole: "admin",
      actorId: adminUsername,
      actorLabel: adminUsername,
      clinicId,
      targetType: "clinic",
      targetId: clinicId,
      details: {
        change: "create_clinic",
        clinicName: clinic.name,
        doctorsCount: doctors?.length ?? 0,
        createdAdminUserId: adminUserId,
      },
      ...requestMeta,
    });

    const response: AdminCreateClinicResponse = {
      clinicId,
      clinicName: clinic.name,
      adminUserId,
      adminPassword,
    };
    return res.status(201).json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid clinic payload.",
        detail: "validation_error",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return next(error);
  }
};

export const handleAdminDeleteClinic: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.params.id?.trim();
    if (!clinicId) {
      return res.status(400).json({ error: "Clinic ID is required." });
    }

    const clinics = await getClinicInfoCollection();
    const existing = await clinics.findOne({ clinicId });
    if (!existing) {
      return res.status(404).json({ error: "Clinic not found." });
    }

    await clinics.deleteOne({ clinicId });

    const accounts = await getClinicAccountsCollection();
    await accounts.deleteMany({ clinicId });

    const doctors = await getClinicDoctorsCollection();
    await doctors.deleteMany({ clinicId });

    const adminUsername = req.adminAuth?.username ?? "admin";
    const requestMeta = getAuditRequestMeta(req);
    await logAuditEvent({
      action: "admin_change",
      actorRole: "admin",
      actorId: adminUsername,
      actorLabel: adminUsername,
      clinicId,
      targetType: "clinic",
      targetId: clinicId,
      details: {
        change: "delete_clinic",
        clinicName: existing.name,
      },
      ...requestMeta,
    });

    return res.json({ ok: true, clinicId });
  } catch (error) {
    return next(error);
  }
};

const adminUpdateClinicSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  type: z.enum(["Hospital", "Clinic"]).optional(),
  location: z.string().trim().min(2).max(200).optional(),
  image: z.string().trim().min(5).max(500).optional(),
  description: z.string().trim().max(2000).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  email: z.string().trim().email().optional(),
  rating: z.number().min(0).max(5).optional(),
  patients: z.string().trim().max(120).optional(),
  bookingEnabled: z.boolean().optional(),
  immediateWoundCare: z.boolean().optional(),
  googlePlaceId: z.string().trim().min(2).max(120).optional(),
  hours: clinicHoursSchema.optional(),
  pricing: z.object({
    firstVisit: z.string().trim().min(1).max(40),
    followUp: z.string().trim().min(1).max(40),
    otherServices: z.string().trim().min(1).max(200),
  }).optional(),
  photos: z.array(z.object({
    label: z.string().trim().min(1).max(40),
    url: z.string().trim().min(5).max(500),
  })).optional(),
  notificationEmailEnabled: z.boolean().optional(),
  notificationPhoneEnabled: z.boolean().optional(),
  notificationLineEnabled: z.boolean().optional(),
  customLabelIds: z.array(z.string().trim().min(1).max(80)).optional(),
  bookingClosures: z.array(z.object({
    startDate: z.string().trim().min(10).max(10),
    endDate: z.string().trim().min(10).max(10).optional(),
    startTime: z.string().trim().min(4).max(10).optional(),
    endTime: z.string().trim().min(4).max(10).optional(),
    reason: z.string().trim().max(200).optional(),
    id: z.string().trim().min(8).max(80).optional(),
    createdAt: z.date().optional().or(z.string().optional()),
  })).optional(),
  doctors: z.array(z.object({
    id: z.string().trim().min(2).max(80),
    clinicId: z.string().trim().min(2).max(80),
    name: z.string().trim().min(2).max(120),
    specialization: z.string().trim().min(2).max(120),
    languages: z.array(z.string().trim().min(2).max(60)),
    rating: z.number().min(0).max(5),
    nextAvailable: z.string().trim().min(2).max(80).optional(),
    availability: z.array(z.object({
      days: z.array(z.string().trim().min(2).max(10)).min(1),
      startTime: z.string().trim().min(4).max(10),
      endTime: z.string().trim().min(4).max(10),
    })).optional(),
  })).optional(),
});

export const handleAdminUpdateClinic: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.params.id?.trim();
    if (!clinicId) {
      return res.status(400).json({ error: "Clinic ID is required." });
    }

    const payload = adminUpdateClinicSchema.parse(parseRequestBody(req.body));

    const clinics = await getClinicInfoCollection();
    const existing = await clinics.findOne({ clinicId });
    if (!existing) {
      return res.status(404).json({ error: "Clinic not found." });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.type !== undefined) updates.type = payload.type;
    if (payload.location !== undefined) updates.location = payload.location;
    if (payload.image !== undefined) updates.image = payload.image;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.phone !== undefined) updates.phone = payload.phone;
    if (payload.email !== undefined) updates.email = payload.email;
    if (payload.rating !== undefined) updates.rating = payload.rating;
    if (payload.patients !== undefined) updates.patients = payload.patients;
    if (payload.bookingEnabled !== undefined) updates.bookingEnabled = payload.bookingEnabled;
    if (payload.immediateWoundCare !== undefined) updates.immediateWoundCare = payload.immediateWoundCare;
    if (payload.googlePlaceId !== undefined) updates.googlePlaceId = payload.googlePlaceId;
    if (payload.hours !== undefined) updates.hours = payload.hours;
    if (payload.pricing !== undefined) updates.pricing = payload.pricing;
    if (payload.photos !== undefined) updates.photos = payload.photos;
    if (payload.notificationEmailEnabled !== undefined) updates.notificationEmailEnabled = payload.notificationEmailEnabled;
    if (payload.notificationPhoneEnabled !== undefined) updates.notificationPhoneEnabled = payload.notificationPhoneEnabled;
    if (payload.notificationLineEnabled !== undefined) updates.notificationLineEnabled = payload.notificationLineEnabled;
    if (payload.customLabelIds !== undefined) updates.customLabelIds = payload.customLabelIds;
    if (payload.bookingClosures !== undefined) updates.bookingClosures = payload.bookingClosures;

    await clinics.updateOne({ clinicId }, { $set: updates });

    // Handle doctors update
    if (payload.doctors !== undefined) {
      const doctorsCol = await getClinicDoctorsCollection();
      await doctorsCol.deleteMany({ clinicId });
      if (payload.doctors.length > 0) {
        await Promise.all(
          payload.doctors.map((doctor: any) =>
            doctorsCol.insertOne({
              clinicId,
              doctorId: doctor.id,
              name: doctor.name,
              specialization: doctor.specialization,
              languages: doctor.languages,
              rating: doctor.rating,
              nextAvailable: computeDoctorNextAvailability(doctor.availability) ?? doctor.nextAvailable ?? "Schedule TBD",
              availability: doctor.availability,
              updatedAt: new Date(),
            }),
          ),
        );
      }
    }

    const adminUsername = req.adminAuth?.username ?? "admin";
    const requestMeta = getAuditRequestMeta(req);
    await logAuditEvent({
      action: "admin_change",
      actorRole: "admin",
      actorId: adminUsername,
      actorLabel: adminUsername,
      clinicId,
      targetType: "clinic",
      targetId: clinicId,
      details: {
        change: "update_clinic",
        updatedFields: Object.keys(payload).filter((k) => (payload as Record<string, unknown>)[k] !== undefined),
      },
      ...requestMeta,
    });

    const updated = await clinics.findOne({ clinicId });
    return res.json({ ok: true, clinic: updated });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid update payload.",
        detail: "validation_error",
        issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    return next(error);
  }
};

export const handleAdminClinicAccounts: RequestHandler = async (_req, res, next) => {
  try {
    const accounts = await getClinicAccountsCollection();
    const all = await accounts.find({}).toArray();
    const result = all.map((a) => ({
      clinicId: a.clinicId,
      userId: a.userId,
      createdAt: a.createdAt,
    }));
    return res.json({ accounts: result });
  } catch (error) {
    return next(error);
  }
};

export const handleAdminResetClinicPassword: RequestHandler = async (req, res, next) => {
  try {
    const clinicId = req.params.id?.trim();
    if (!clinicId) {
      return res.status(400).json({ error: "Clinic ID is required." });
    }

    const accounts = await getClinicAccountsCollection();
    const account = await accounts.findOne({ clinicId });
    if (!account) {
      return res.status(404).json({ error: "Clinic account not found." });
    }

    const newPassword = crypto.randomBytes(18).toString("base64url");
    const passwordHash = await bcryptjs.hash(newPassword, 10);
    await accounts.updateOne({ clinicId }, { $set: { passwordHash } });

    const adminUsername = req.adminAuth?.username ?? "admin";
    const requestMeta = getAuditRequestMeta(req);
    await logAuditEvent({
      action: "admin_change",
      actorRole: "admin",
      actorId: adminUsername,
      actorLabel: adminUsername,
      clinicId,
      targetType: "clinic_account",
      targetId: account.userId,
      details: { change: "reset_password" },
      ...requestMeta,
    });

    return res.json({ ok: true, userId: account.userId, newPassword });
  } catch (error) {
    return next(error);
  }
};

export const handleAdminAuditLogs: RequestHandler = async (req, res, next) => {
  try {
    const query = adminAuditLogsQuerySchema.parse(req.query);
    const response: AdminAuditLogsResponse = await listAuditLogs(query);
    return res.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid audit log query.",
        detail: "validation_error",
      });
    }
    return next(error);
  }
};

export const handleAdminGetCallSettings: RequestHandler = async (_req, res, next) => {
  try {
    const resolved = await getResolvedCallSettings();
    const response: AdminCallSettingsResponse = {
      provider: resolved.provider,
      fallbackToTwilio: resolved.fallbackToTwilio,
    };
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

export const handleAdminUpdateCallSettings: RequestHandler = async (req, res, next) => {
  try {
    const payload = adminCallSettingsSchema.parse(parseRequestBody(req.body)) as AdminCallSettingsUpdateRequest;
    const updated = await saveCallSettings(payload, req.adminAuth?.username ?? "admin");

    const adminUsername = req.adminAuth?.username ?? "admin";
    await logAuditEvent({
      action: "admin_change",
      actorRole: "admin",
      actorId: adminUsername,
      actorLabel: adminUsername,
      targetType: "system_call_settings",
      targetId: "clinic_call_provider",
      details: {
        provider: updated.provider,
        fallbackToTwilio: updated.fallbackToTwilio,
      },
      ...getAuditRequestMeta(req),
    });

    const response: AdminCallSettingsResponse = {
      provider: updated.provider,
      fallbackToTwilio: updated.fallbackToTwilio,
    };
    return res.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid call settings payload." });
    }
    return next(error);
  }
};

// ── Custom Labels CRUD ──

const customLabelCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).optional(),
});

const customLabelUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(200).optional(),
});

export const handleAdminListCustomLabels: RequestHandler = async (_req, res, next) => {
  try {
    const labels = await getCustomLabelsCollection();
    const list = await labels.find({}).toArray();
    return res.json({
      labels: list.map((l: any) => ({
        id: l.labelId,
        name: l.name,
        description: l.description ?? "",
        createdAt: l.createdAt?.toISOString?.() ?? l.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const handleAdminCreateCustomLabel: RequestHandler = async (req, res, next) => {
  try {
    const payload = customLabelCreateSchema.parse(parseRequestBody(req.body));
    const labelId = `label-${crypto.randomUUID().slice(0, 8)}`;

    const labels = await getCustomLabelsCollection();
    const existing = await labels.findOne({ name: payload.name });
    if (existing) {
      return res.status(409).json({ error: "Label with this name already exists." });
    }

    const now = new Date();
    await labels.insertOne({
      labelId,
      name: payload.name,
      description: payload.description ?? "",
      createdAt: now,
      updatedAt: now,
    } as any);

    return res.status(201).json({
      label: {
        id: labelId,
        name: payload.name,
        description: payload.description ?? "",
        createdAt: now.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid label payload." });
    }
    return next(error);
  }
};

export const handleAdminUpdateCustomLabel: RequestHandler = async (req, res, next) => {
  try {
    const labelId = req.params.labelId?.trim();
    if (!labelId) return res.status(400).json({ error: "Label ID is required." });

    const payload = customLabelUpdateSchema.parse(parseRequestBody(req.body));
    const labels = await getCustomLabelsCollection();
    const existing = await labels.findOne({ labelId });
    if (!existing) return res.status(404).json({ error: "Label not found." });

    if (payload.name !== undefined && payload.name !== (existing as any).name) {
      const duplicate = await labels.findOne({ name: payload.name });
      if (duplicate) return res.status(409).json({ error: "Label with this name already exists." });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.description !== undefined) updates.description = payload.description;
    await labels.updateOne({ labelId }, { $set: updates });

    const refreshed = await labels.findOne({ labelId });
    return res.json({
      label: {
        id: (refreshed as any)?.labelId ?? labelId,
        name: (refreshed as any)?.name ?? existing.name,
        description: (refreshed as any)?.description ?? "",
        createdAt: (refreshed as any)?.createdAt?.toISOString?.() ?? (existing as any).createdAt,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid label payload." });
    }
    return next(error);
  }
};

export const handleAdminDeleteCustomLabel: RequestHandler = async (req, res, next) => {
  try {
    const labelId = req.params.labelId?.trim();
    if (!labelId) return res.status(400).json({ error: "Label ID is required." });

    const labels = await getCustomLabelsCollection();
    const existing = await labels.findOne({ labelId });
    if (!existing) return res.status(404).json({ error: "Label not found." });

    await labels.deleteOne({ labelId });

    // Remove this label from all clinics that have it
    const clinics = await getClinicInfoCollection();
    const affectedClinics = await clinics.find({ customLabelIds: labelId }).toArray();
    await Promise.all(
      affectedClinics.map((c: any) =>
        clinics.updateOne(
          { clinicId: c.clinicId },
          { $set: { customLabelIds: (c.customLabelIds ?? []).filter((id: string) => id !== labelId) } },
        ),
      ),
    );

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
};
