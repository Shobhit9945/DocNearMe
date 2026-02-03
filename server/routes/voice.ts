import { Request, Response, RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { getAppointmentsCollection, getPatientsCollection } from "../db";
import { getDateKey } from "../lib/scheduling";
import type { AppointmentStatus } from "@shared/api";
import { buildVoicePrompt, verifyVoiceToken } from "../services/twilio-voice";

const getVoiceBaseUrl = (req?: Request) => {
  const configured = (process.env.VOICE_WEBHOOK_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  if (configured) return configured;
  if (!req) return "";
  const host = req.get("host") ?? "";
  const protocol = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
  return host ? `${protocol}://${host}` : "";
};

const renderXml = (res: Response, xml: string) => {
  res.set("Content-Type", "text/xml");
  return res.status(200).send(xml);
};

const buildGatherTwiml = (message: string, actionUrl: string) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${actionUrl}" method="POST" timeout="8">
    <Say voice="alice">${message}</Say>
  </Gather>
  <Say voice="alice">We did not receive your response. Please check your email and dashboard for details.</Say>
</Response>`;

const buildCompletionTwiml = (message: string) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>
  <Hangup />
</Response>`;

const resolveAppointmentLookup = (appointmentId: string) =>
  ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : appointmentId;

const updatePatientSummary = async (appointmentId: string, patientId: string | undefined, updates: any) => {
  if (!patientId) return;
  const patients = await getPatientsCollection();
  const patientLookupId = ObjectId.isValid(patientId) ? new ObjectId(patientId) : patientId;
  const patient = await patients.findOne({ _id: patientLookupId });
  if (!patient?.appointments) return;
  const updatedAppointments = patient.appointments.map((summary: any) =>
    summary.appointmentId === appointmentId ? { ...summary, ...updates } : summary,
  );
  await patients.updateOne(
    { _id: patientLookupId },
    {
      $set: {
        appointments: updatedAppointments,
      },
    },
  );
};

const resolveConfirmFields = (appointment: any) => {
  const confirmedStart = appointment.preferredStart ?? appointment.date;
  const confirmedEnd =
    appointment.preferredEnd ??
    new Date(new Date(confirmedStart).getTime() + 30 * 60 * 1000).toISOString();
  const dateKey = getDateKey(new Date(confirmedStart));
  const slot = appointment.slot ?? "";
  return { confirmedStart, confirmedEnd, dateKey, slot };
};

const applyDecision = async (appointmentId: string, appointment: any, digit: string) => {
  const appointments = await getAppointmentsCollection();
  const now = new Date();
  let update: Record<string, unknown> = { updatedAt: now };
  let patientUpdate: Record<string, unknown> = { updatedAt: now };

  if (digit === "1") {
    const confirmFields = resolveConfirmFields(appointment);
    update = {
      ...update,
      status: "CONFIRMED",
      confirmedStart: confirmFields.confirmedStart,
      confirmedEnd: confirmFields.confirmedEnd,
      date: confirmFields.confirmedStart,
      dateKey: confirmFields.dateKey,
      slot: confirmFields.slot,
      clinicMessage: null,
      declineReason: null,
      clinicConfirmationTokenHash: null,
      tokenExpiresAt: null,
    };
    patientUpdate = {
      ...patientUpdate,
      status: "CONFIRMED" as AppointmentStatus,
      confirmedStart: confirmFields.confirmedStart,
      confirmedEnd: confirmFields.confirmedEnd,
      date: confirmFields.confirmedStart,
      slot: confirmFields.slot,
    };
  } else if (digit === "2") {
    update = {
      ...update,
      status: "DECLINED",
      declineReason: "Declined by clinic (phone)",
      clinicMessage: null,
      clinicConfirmationTokenHash: null,
      tokenExpiresAt: null,
    };
    patientUpdate = {
      ...patientUpdate,
      status: "DECLINED" as AppointmentStatus,
      declineReason: "Declined by clinic (phone)",
    };
  } else if (digit === "3") {
    update = {
      ...update,
      status: "RESCHEDULE_REQUESTED",
      clinicMessage: "Clinic requested reschedule (phone)",
      clinicConfirmationTokenHash: null,
      tokenExpiresAt: null,
    };
    patientUpdate = {
      ...patientUpdate,
      status: "RESCHEDULE_REQUESTED" as AppointmentStatus,
      clinicMessage: "Clinic requested reschedule (phone)",
    };
  } else {
    return { ok: false, message: "Invalid input." };
  }

  await appointments.updateOne({ _id: resolveAppointmentLookup(appointmentId) }, { $set: update });
  await updatePatientSummary(appointmentId, appointment.patientId, patientUpdate);

  return { ok: true, status: update.status as AppointmentStatus };
};

export const handleVoiceAppointment: RequestHandler = async (req: Request, res: Response) => {
  const appointmentId = String(req.query.appointmentId ?? "");
  const token = String(req.query.token ?? "");

  if (!appointmentId || !verifyVoiceToken(appointmentId, token)) {
    return renderXml(res, buildCompletionTwiml("Invalid request."));
  }

  const appointments = await getAppointmentsCollection();
  const appointment = await appointments.findOne({ _id: resolveAppointmentLookup(appointmentId) });
  if (!appointment) {
    return renderXml(res, buildCompletionTwiml("Appointment not found."));
  }

  const preferredStart = appointment.preferredStart ?? appointment.date;
  const dateValue = new Date(preferredStart);
  const formattedDate = Number.isNaN(dateValue.getTime())
    ? preferredStart
    : dateValue.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
  const requestedDateTime = appointment.slot ? `${formattedDate} (${appointment.slot})` : formattedDate;

  const message = buildVoicePrompt({
    clinicName: appointment.clinicId,
    patientName: appointment.patientName ?? "patient",
    requestedDateTime,
    appointmentId: String(appointmentId),
  });

  const baseUrl = getVoiceBaseUrl(req);
  const actionUrl = `${baseUrl}/api/voice/appointment/response?appointmentId=${encodeURIComponent(
    appointmentId,
  )}&token=${encodeURIComponent(token)}`;

  return renderXml(res, buildGatherTwiml(message, actionUrl));
};

export const handleVoiceAppointmentResponse: RequestHandler = async (req: Request, res: Response) => {
  const appointmentId = String(req.query.appointmentId ?? "");
  const token = String(req.query.token ?? "");
  const digit = String(req.body?.Digits ?? req.query?.Digits ?? "");

  if (!appointmentId || !verifyVoiceToken(appointmentId, token)) {
    return renderXml(res, buildCompletionTwiml("Invalid request."));
  }

  const appointments = await getAppointmentsCollection();
  const appointment = await appointments.findOne({ _id: resolveAppointmentLookup(appointmentId) });
  if (!appointment) {
    return renderXml(res, buildCompletionTwiml("Appointment not found."));
  }

  if (appointment.status !== "PENDING_CLINIC") {
    return renderXml(res, buildCompletionTwiml("This request is no longer pending."));
  }

  const result = await applyDecision(appointmentId, appointment, digit);
  if (!result.ok) {
    return renderXml(res, buildCompletionTwiml("Invalid input. Please check your dashboard."));
  }

  return renderXml(res, buildCompletionTwiml("Thank you. Your response has been recorded."));
};
