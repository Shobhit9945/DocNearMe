import { RequestHandler } from "express";
import { ZodError, z } from "zod";
import bcryptjs from "bcryptjs";
import {
  getClinicAccountsCollection,
  getClinicDoctorsCollection,
  getClinicInfoCollection,
} from "../db";
import { computeDoctorNextAvailability } from "./clinic";
import { getAuditRequestMeta, listAuditLogs, logAuditEvent } from "../services/audit-log";
import type {
  AdminAuditLogsResponse,
  AdminAuthCheckResponse,
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
  adminPassword: z.string().trim().min(6).max(120).optional(),
});

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


export const handleAdminAuthCheck: RequestHandler = (_req, res) => {
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
      tempPassword: adminPassword,
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
