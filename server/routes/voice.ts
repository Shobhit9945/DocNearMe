import { Request, Response, RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { getAppointmentsCollection, getPatientsCollection } from "../db";
import { getDateKey } from "../lib/scheduling";
import type { AppointmentStatus, AuditAction } from "@shared/api";
import { buildVoicePrompt, verifyVoiceToken } from "../services/twilio-voice";
import { logAuditEvent } from "../services/audit-log";
import { sendEmail } from "../services/mailer";

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const getVoiceBaseUrl = (req?: Request) => {
  const configured = normalizeBaseUrl(process.env.VOICE_WEBHOOK_BASE_URL ?? "");
  if (configured) return configured;
  if (!req) return "";
  const host = (req.get("x-forwarded-host") ?? req.get("host") ?? "").split(",")[0].trim();
  const forwardedProto = req.get("x-forwarded-proto");
  const protocolCandidate = (
    forwardedProto ? forwardedProto.split(",")[0] : req.protocol ?? "https"
  )
    .trim()
    .toLowerCase();
  const protocol = protocolCandidate === "http" ? "http" : "https";
  return host ? `${protocol}://${host}` : "";
};

const renderXml = (res: Response, xml: string) => {
  res.set("Content-Type", "text/xml");
  return res.status(200).send(xml);
};

const escapeTwiml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const VOICE_NAME = "alice";
const VOICE_LANGUAGE = "ja-JP";

const buildSayLines = (lines: string[]) =>
  lines
    .map(
      (line, index) =>
        `  <Say voice="${VOICE_NAME}" language="${VOICE_LANGUAGE}">${escapeTwiml(line)}</Say>` +
        (index < lines.length - 1 ? "\n  <Pause length=\"1\" />" : ""),
    )
    .join("\n");

const buildGatherTwiml = (lines: string[], actionUrl: string) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${escapeTwiml(actionUrl)}" method="POST" timeout="8">
${buildSayLines(lines)}
  </Gather>
  <Say voice="${VOICE_NAME}" language="${VOICE_LANGUAGE}">ご入力が確認できませんでした。メールとダッシュボードをご確認ください。</Say>
</Response>`;

const buildCompletionTwiml = (lines: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${buildSayLines(lines)}
  <Hangup />
</Response>`;

const normalizeDigit = (value: string) => value.trim().replace(/\D/g, "");

const extractDigits = (value: unknown) => {
  if (!value) return "";
  if (Array.isArray(value)) {
    return normalizeDigit(String(value[0] ?? ""));
  }
  if (typeof value === "number") {
    return normalizeDigit(String(value));
  }
  if (typeof value === "string") {
    const params = new URLSearchParams(value);
    const parsed = params.get("Digits") ?? params.get("digits");
    return normalizeDigit(parsed ?? value);
  }
  if (Buffer.isBuffer(value)) {
    return extractDigits(value.toString("utf8"));
  }
  if (typeof value === "object") {
    const typed = value as any;
    if (typed.Digits || typed.digits) {
      return normalizeDigit(String(typed.Digits ?? typed.digits ?? ""));
    }
  }
  return "";
};

const resolveAppointmentLookup = (appointmentId: string) =>
  (ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : appointmentId) as any;

const updatePatientSummary = async (appointmentId: string, patientId: string | undefined, updates: any) => {
  if (!patientId) return;
  const patients = await getPatientsCollection();
  const patientLookupId = ObjectId.isValid(patientId) ? new ObjectId(patientId) : patientId;
  const patient = await patients.findOne({ _id: patientLookupId as any });
  if (!patient?.appointments) return;
  const updatedAppointments = patient.appointments.map((summary: any) =>
    summary.appointmentId === appointmentId ? { ...summary, ...updates } : summary,
  );
  await patients.updateOne(
    { _id: patientLookupId as any } as any,
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
  let auditAction: AuditAction | null = null;
  const normalizedDigit = normalizeDigit(digit).charAt(0);

  if (normalizedDigit === "1") {
    auditAction = "appointment_confirmed";
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
  } else if (normalizedDigit === "2") {
    auditAction = "appointment_declined";
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
  } else if (normalizedDigit === "3") {
    auditAction = "appointment_reschedule_requested";
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

  await appointments.updateOne(
    { _id: resolveAppointmentLookup(appointmentId) } as any,
    { $set: update },
  );
  await updatePatientSummary(appointmentId, appointment.patientId, patientUpdate);

  if (auditAction) {
    await logAuditEvent({
      action: auditAction,
      actorRole: "clinic",
      actorId: `${appointment.clinicId}:voice`,
      actorLabel: appointment.clinicId,
      clinicId: appointment.clinicId,
      patientId: appointment.patientId,
      appointmentId,
      targetType: "appointment",
      targetId: appointmentId,
      details: {
        previousStatus: appointment.status,
        digit: normalizedDigit,
        via: "voice_call",
      },
      source: "voice",
    });
  }

  return { ok: true, status: update.status as AppointmentStatus };
};

const updateAppointmentOutcome = async (
  appointmentId: string,
  appointment: any,
  outcome: "confirm" | "decline" | "info_requested" | "reschedule",
  payload: Record<string, unknown>,
) => {
  const appointments = await getAppointmentsCollection();
  const now = new Date();
  let update: Record<string, unknown> = { updatedAt: now };
  let patientUpdate: Record<string, unknown> = { updatedAt: now };
  let auditAction: AuditAction | null = null;

  if (outcome === "confirm") {
    auditAction = "appointment_confirmed";
    const confirmedStart =
      typeof payload.confirmedStart === "string" && payload.confirmedStart.trim()
        ? payload.confirmedStart.trim()
        : appointment.preferredStart ?? appointment.date;
    const confirmedEnd =
      typeof payload.confirmedEnd === "string" && payload.confirmedEnd.trim()
        ? payload.confirmedEnd.trim()
        : appointment.preferredEnd ??
          new Date(new Date(confirmedStart).getTime() + 30 * 60 * 1000).toISOString();
    const confirmedDate = new Date(confirmedStart);
    const dateKey = getDateKey(confirmedDate);
    const slot = appointment.slot ?? confirmedDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    update = {
      ...update,
      status: "CONFIRMED",
      confirmedStart,
      confirmedEnd,
      date: confirmedStart,
      dateKey,
      slot,
      clinicMessage: null,
      declineReason: null,
      clinicConfirmationTokenHash: null,
      tokenExpiresAt: null,
    };
    patientUpdate = {
      ...patientUpdate,
      status: "CONFIRMED" as AppointmentStatus,
      confirmedStart,
      confirmedEnd,
      date: confirmedStart,
      slot,
    };
  } else if (outcome === "decline") {
    auditAction = "appointment_declined";
    const declineReason = typeof payload.declineReason === "string" ? payload.declineReason.trim() : "Declined by clinic (voice)";
    update = {
      ...update,
      status: "DECLINED",
      declineReason,
      clinicMessage: null,
      clinicConfirmationTokenHash: null,
      tokenExpiresAt: null,
    };
    patientUpdate = {
      ...patientUpdate,
      status: "DECLINED" as AppointmentStatus,
      declineReason,
    };
  } else if (outcome === "info_requested") {
    auditAction = "appointment_reschedule_requested";
    const clinicMessage =
      typeof payload.clinicMessage === "string" && payload.clinicMessage.trim()
        ? payload.clinicMessage.trim()
        : "Clinic requested additional information (voice)";
    update = {
      ...update,
      status: "INFO_REQUESTED",
      clinicMessage,
      clinicConfirmationTokenHash: null,
      tokenExpiresAt: null,
    };
    patientUpdate = {
      ...patientUpdate,
      status: "INFO_REQUESTED" as AppointmentStatus,
      clinicMessage,
    };
  } else if (outcome === "reschedule") {
    auditAction = "appointment_reschedule_requested";
    const clinicMessage =
      typeof payload.clinicMessage === "string" && payload.clinicMessage.trim()
        ? payload.clinicMessage.trim()
        : "Clinic requested reschedule (voice)";
    update = {
      ...update,
      status: "RESCHEDULE_REQUESTED",
      clinicMessage,
      clinicConfirmationTokenHash: null,
      tokenExpiresAt: null,
    };
    patientUpdate = {
      ...patientUpdate,
      status: "RESCHEDULE_REQUESTED" as AppointmentStatus,
      clinicMessage,
    };
  }

  await appointments.updateOne({ _id: resolveAppointmentLookup(appointmentId) } as any, { $set: update });
  await updatePatientSummary(appointmentId, appointment.patientId, patientUpdate);

  if (appointment.patientEmail) {
    const patientName = appointment.patientName ?? "there";
    const formattedDate = (() => {
      const confirmedStart = typeof update.confirmedStart === "string" ? update.confirmedStart : appointment.preferredStart ?? appointment.date;
      const parsed = new Date(confirmedStart);
      return Number.isNaN(parsed.getTime()) ? confirmedStart : parsed.toLocaleString();
    })();
    const slot = typeof update.slot === "string" ? update.slot : appointment.slot ?? "";
    try {
      if (outcome === "confirm") {
        await sendEmail({
          to: appointment.patientEmail,
          subject: "Your DocNearMe appointment is confirmed",
          text: [
            `Hi ${patientName},`,
            "",
            "Your appointment request has been confirmed by the clinic.",
            `Appointment ID: ${appointmentId}`,
            `Clinic: ${appointment.clinicId}`,
            `Confirmed date: ${formattedDate}`,
            `Confirmed time: ${slot}`,
            "",
            "Please arrive 10 minutes early and bring a photo ID and insurance card if applicable.",
          ].join("\n"),
        });
      } else if (outcome === "decline") {
        await sendEmail({
          to: appointment.patientEmail,
          subject: "Clinic could not confirm your appointment",
          text: [
            `Hi ${patientName},`,
            "",
            "The clinic was unable to confirm your requested time.",
            typeof update.declineReason === "string" ? `Reason: ${update.declineReason}` : undefined,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      } else if (outcome === "info_requested") {
        await sendEmail({
          to: appointment.patientEmail,
          subject: "Clinic needs more information",
          text: [
            `Hi ${patientName},`,
            "",
            "The clinic asked for additional information before confirming your appointment.",
            typeof update.clinicMessage === "string" ? `Message: ${update.clinicMessage}` : undefined,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      } else if (outcome === "reschedule") {
        await sendEmail({
          to: appointment.patientEmail,
          subject: "Clinic requested a reschedule",
          text: [
            `Hi ${patientName},`,
            "",
            "The clinic asked to reschedule your appointment.",
            typeof update.clinicMessage === "string" ? `Message: ${update.clinicMessage}` : undefined,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }
    } catch (error) {
      console.error("[clinic-call] failed to send appointment outcome email", error);
    }
  }

  if (auditAction) {
    await logAuditEvent({
      action: auditAction,
      actorRole: "clinic",
      actorId: `${appointment.clinicId}:voice`,
      actorLabel: appointment.clinicId,
      clinicId: appointment.clinicId,
      patientId: appointment.patientId,
      appointmentId,
      targetType: "appointment",
      targetId: appointmentId,
      details: {
        previousStatus: appointment.status,
        outcome,
        via: "voice_call",
      },
      source: "voice",
    });
  }

  return {
    ok: true,
    status: update.status as AppointmentStatus,
  };
};

export const handleVoiceAppointmentOutcome: RequestHandler = async (req: Request, res: Response) => {
  try {
    const payload = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const finalizeUrlCandidate = String(
      payload.finalizeUrl ?? payload.finalize_url ?? payload.url ?? req.query.finalizeUrl ?? req.query.finalize_url ?? "",
    ).trim();

    let parsedFinalizeAppointmentId = "";
    let parsedFinalizeToken = "";
    if (finalizeUrlCandidate) {
      try {
        const parsed = new URL(finalizeUrlCandidate);
        parsedFinalizeAppointmentId = (parsed.searchParams.get("appointmentId") ?? "").trim();
        parsedFinalizeToken = (parsed.searchParams.get("token") ?? "").trim();
      } catch {
        // Ignore invalid finalize URL payload and continue with direct fields.
      }
    }

    const appointmentId = String(
      payload.appointmentId ??
        payload.appointment_id ??
        parsedFinalizeAppointmentId ??
        req.query.appointmentId ??
        req.query.appointment_id ??
        "",
    ).trim();
    const token = String(
      payload.token ??
        payload.finalizeToken ??
        payload.finalize_token ??
        payload.voiceToken ??
        payload.voice_token ??
        parsedFinalizeToken ??
        req.query.token ??
        "",
    ).trim();
    const normalizedOutcome = String(payload.outcome ?? payload.decision ?? "").trim().toLowerCase();
    const outcome =
      normalizedOutcome === "request_additional_information" || normalizedOutcome === "additional_information"
        ? "info_requested"
        : normalizedOutcome;

    const normalizeSecret = (value: string) => value.trim().replace(/^['\"]+|['\"]+$/g, "");

    const providedWebhookSecretRaw = String(
      req.get("x-docnearme-webhook-secret") ?? req.get("x-clinic-webhook-secret") ?? "",
    );
    const expectedWebhookSecretRaw = String(
      process.env.ELEVENLABS_OUTCOME_WEBHOOK_SECRET ??
        process.env.DOCNEARME_WEBHOOK_SECRET ??
        process.env.ELEVENLABS_WEBHOOK_SECRET ??
        "",
    );
    const providedWebhookSecret = normalizeSecret(providedWebhookSecretRaw);
    const expectedWebhookSecret = normalizeSecret(expectedWebhookSecretRaw);
    const tokenValid = Boolean(appointmentId) && verifyVoiceToken(appointmentId, token);
    const webhookSecretValid =
      Boolean(appointmentId) &&
      Boolean(expectedWebhookSecret) &&
      Boolean(providedWebhookSecret) &&
      providedWebhookSecret.toLowerCase() === expectedWebhookSecret.toLowerCase();

    if (!appointmentId || (!tokenValid && !webhookSecretValid)) {
      console.warn("[clinic-call] invalid voice outcome token", {
        appointmentId,
        hasToken: Boolean(token),
        tokenLength: token.length,
        outcome,
        hasWebhookSecret: Boolean(providedWebhookSecret),
        webhookSecretMatched: webhookSecretValid,
        hasExpectedWebhookSecret: Boolean(expectedWebhookSecret),
        providedWebhookSecretLength: providedWebhookSecret.length,
        expectedWebhookSecretLength: expectedWebhookSecret.length,
        payloadKeys: Object.keys(payload),
      });
      return res.status(401).json({ error: "Invalid voice token." });
    }

    if (!tokenValid && webhookSecretValid) {
      console.info("[clinic-call] voice outcome accepted via webhook secret", {
        appointmentId,
        outcome,
      });
    }

    const allowedOutcomes = new Set(["confirm", "decline", "info_requested", "reschedule"]);
    if (!allowedOutcomes.has(outcome)) {
      return res.status(400).json({ error: "Invalid outcome." });
    }

    const appointments = await getAppointmentsCollection();
    const appointment = await appointments.findOne({ _id: resolveAppointmentLookup(appointmentId) });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    const result = await updateAppointmentOutcome(appointmentId, appointment, outcome as any, payload);
    console.info("[clinic-call] voice outcome recorded", {
      appointmentId,
      outcome,
      status: result.status,
      clinicId: appointment.clinicId,
    });
    return res.json({ success: true, status: result.status });
  } catch (error) {
    console.error("[clinic-call] voice outcome error", error);
    return res.status(500).json({ error: "Failed to record voice outcome." });
  }
};

export const handleVoiceAppointment: RequestHandler = async (req: Request, res: Response) => {
  try {
    const appointmentId = String(req.query.appointmentId ?? req.body?.appointmentId ?? "");
    const token = String(req.query.token ?? req.body?.token ?? "");

    console.info("[clinic-call] voice appointment", {
      appointmentId,
      hasToken: Boolean(token),
    });

    if (!appointmentId || !verifyVoiceToken(appointmentId, token)) {
      return renderXml(res, buildCompletionTwiml(["無効なリクエストです。"]));
    }

    const appointments = await getAppointmentsCollection();
    const appointment = await appointments.findOne({ _id: resolveAppointmentLookup(appointmentId) });
    if (!appointment) {
      return renderXml(res, buildCompletionTwiml(["予約が見つかりません。"]));
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
    if (!baseUrl) {
      console.error("[clinic-call] missing base URL for Twilio gather action");
      return renderXml(res, buildCompletionTwiml(["処理できませんでした。"]));
    }

    const actionUrl = new URL("/api/voice/appointment/response", `${baseUrl}/`);
    actionUrl.searchParams.set("appointmentId", appointmentId);
    actionUrl.searchParams.set("token", token);

    return renderXml(res, buildGatherTwiml(message, actionUrl.toString()));
  } catch (error) {
    console.error("[clinic-call] voice appointment error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return renderXml(res, buildCompletionTwiml(["処理できませんでした。"]));
  }
};

export const handleVoiceAppointmentResponse: RequestHandler = async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any)._rawBody ?? (req.body as any)?._rawBody ?? req.body;
    const bodyDigits = extractDigits(rawBody);
    const appointmentId = String(req.query.appointmentId ?? req.body?.appointmentId ?? "");
    const token = String(req.query.token ?? req.body?.token ?? "");
    const queryDigits = extractDigits(req.query?.Digits ?? req.query?.digits ?? "");
    const digit = bodyDigits || extractDigits(req.body) || queryDigits;
    const normalizedDigit = normalizeDigit(digit).charAt(0);

    console.info("[clinic-call] voice response", {
      appointmentId,
      hasToken: Boolean(token),
      digit,
      normalizedDigit,
      contentType: req.headers["content-type"],
      hasBody: Boolean(req.body),
    });

    if (!appointmentId || !verifyVoiceToken(appointmentId, token)) {
      return renderXml(res, buildCompletionTwiml(["無効なリクエストです。"]));
    }

    const appointments = await getAppointmentsCollection();
    const appointment = await appointments.findOne({ _id: resolveAppointmentLookup(appointmentId) });
    if (!appointment) {
      return renderXml(res, buildCompletionTwiml(["予約が見つかりません。"]));
    }

    if (appointment.status !== "PENDING_CLINIC") {
      return renderXml(res, buildCompletionTwiml(["このリクエストはすでに処理されています。"]));
    }

    const result = await applyDecision(appointmentId, appointment, normalizedDigit || digit);
    if (!result.ok) {
      console.warn("[clinic-call] invalid digit", {
        appointmentId,
        digit,
        normalizedDigit,
      });
      return renderXml(
        res,
        buildCompletionTwiml(["入力が確認できませんでした。ダッシュボードをご確認ください。"]),
      );
    }

    return renderXml(res, buildCompletionTwiml(["ありがとうございます。回答を記録しました。"]));
  } catch (error) {
    console.error("[clinic-call] voice response error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return renderXml(res, buildCompletionTwiml(["処理できませんでした。"]));
  }
};
