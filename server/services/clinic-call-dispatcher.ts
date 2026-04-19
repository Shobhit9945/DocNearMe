import { ObjectId } from "mongodb";
import { getAppointmentsCollection, getClinicInfoCollection } from "../db";
import type { Appointment, ClinicInfo } from "../types";
import { buildVoiceToken, sendClinicBookingNotificationCall } from "./twilio-voice";
import { getResolvedCallSettings } from "./call-settings";

type Logger = Pick<Console, "info" | "warn" | "error">;

type Provider = "twilio" | "elevenlabs";

export type ClinicCallDispatchResult = {
  queued: boolean;
  reason?: string;
  provider: Provider;
  fallbackUsed?: boolean;
};

const resolveAppointmentLookup = (appointmentId: string) =>
  ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : appointmentId;

const normalizeE164 = (value: string) => {
  const compact = value.replace(/[\s\-()]/g, "");
  if (compact.startsWith("+")) return compact;
  return compact;
};

const ensureE164 = (value: string) => /^\+\d{7,15}$/.test(value);

const getDefaultDialCode = () => process.env.CLINIC_DEFAULT_DIAL_CODE ?? "";

const normalizeClinicPhone = (rawPhone: string) => {
  let normalized = normalizeE164(rawPhone.trim());
  if (!normalized.startsWith("+") && getDefaultDialCode()) {
    const digits = normalized.replace(/\D/g, "").replace(/^0+/, "");
    normalized = `${getDefaultDialCode()}${digits}`;
  }
  return ensureE164(normalized) ? normalized : "";
};

const shouldSendPhoneNotification = (clinic: ClinicInfo | null) =>
  Boolean(clinic?.notificationPhoneEnabled && clinic?.phone);

const getElevenLabsApiKey = () => process.env.ELEVENLABS_API_KEY ?? "";

const getElevenLabsAgentId = () => process.env.ELEVENLABS_AGENT_ID ?? "";

const normalizePhoneNumberResourceId = (value?: string) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  // TWILIO_CALLER_ID is usually an E.164 number (+81...), which is not a valid ElevenLabs phone-number resource id.
  if (/^\+\d{7,15}$/.test(trimmed)) return "";
  return trimmed;
};

const getElevenLabsAgentPhoneNumberId = () =>
  normalizePhoneNumberResourceId(process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID) ||
  normalizePhoneNumberResourceId(process.env.ELEVENLABS_PHONE_NUMBER_ID) ||
  normalizePhoneNumberResourceId(process.env.ELEVENLABS_TWILIO_PHONE_NUMBER_ID) ||
  normalizePhoneNumberResourceId(process.env.TWILIO_CALLER_ID) ||
  "phnum_1401kpj8xgsjfehv0rrvbpy96j2w";

const getElevenLabsOutboundUrl =
  () => process.env.ELEVENLABS_OUTBOUND_CALL_URL ?? "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";

const extractElevenLabsReason = (
  parsedBody: Record<string, unknown>,
  rawBody: string,
  status: number,
  statusText: string,
) => {
  if (typeof parsedBody?.detail === "string" && parsedBody.detail.trim()) {
    return parsedBody.detail;
  }

  if (parsedBody?.detail && typeof parsedBody.detail === "object") {
    const detailObject = parsedBody.detail as Record<string, unknown>;
    const detailMessage =
      typeof detailObject.message === "string" && detailObject.message.trim()
        ? detailObject.message.trim()
        : "";
    const detailCode =
      typeof detailObject.code === "string" && detailObject.code.trim()
        ? detailObject.code.trim()
        : "";
    if (detailMessage) {
      return detailCode ? `${detailMessage} (${detailCode})` : detailMessage;
    }
  }

  if (Array.isArray(parsedBody?.detail) && parsedBody.detail.length > 0) {
    const first = parsedBody.detail[0];
    if (typeof first === "string" && first.trim()) {
      return first;
    }
    if (first && typeof first === "object") {
      const candidate = (first as Record<string, unknown>).msg;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
  }

  if (typeof parsedBody?.message === "string" && parsedBody.message.trim()) {
    return parsedBody.message;
  }

  if (typeof parsedBody?.error === "string" && parsedBody.error.trim()) {
    return parsedBody.error;
  }

  const compactRawBody = rawBody.trim();
  if (compactRawBody) {
    return compactRawBody.slice(0, 240);
  }

  return `elevenlabs_http_${status}_${statusText || "error"}`;
};

const formatAppointmentDateTime = (preferredStart?: string, slot?: string) => {
  const dateValue = preferredStart ?? "";
  if (!dateValue) return slot ? `- ${slot}` : "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return slot ? `${dateValue} (${slot})` : dateValue;
  const localized = date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  return slot ? `${localized} (${slot})` : localized;
};

const buildElevenLabsFirstMessage = (context: {
  clinicName: string;
  patientName: string;
  requestedDateTime: string;
  specialization: string;
  doctorName: string;
}) =>
  [
    "もしもし、DocDaisyです。予約確認のお電話です。",
    `患者様のお名前は${context.patientName}様です。`,
    `希望日時は${context.requestedDateTime}です。`,
    `診療科は${context.specialization}、希望医師は${context.doctorName}です。`,
    "この予約について、確定・却下・追加情報が必要・日程変更希望のいずれかでご回答ください。",
  ].join(" ");

const queueElevenLabsCall = async (
  clinic: ClinicInfo,
  appointment: Appointment,
  appointmentId: string,
  logger: Logger,
): Promise<{ queued: boolean; reason?: string }> => {
  const apiKey = getElevenLabsApiKey();
  const agentId = getElevenLabsAgentId();
  const agentPhoneNumberId = getElevenLabsAgentPhoneNumberId();
  if (!apiKey) {
    return { queued: false, reason: "elevenlabs_missing_api_key" };
  }
  if (!agentId) {
    return { queued: false, reason: "elevenlabs_missing_agent_id" };
  }
  if (!agentPhoneNumberId) {
    return { queued: false, reason: "elevenlabs_missing_agent_phone_number_id" };
  }

  const rawPhone = String(clinic.phone ?? "").trim();
  const to = normalizeClinicPhone(rawPhone);
  if (!to) {
    logger.warn("[clinic-call] invalid phone format for elevenlabs", {
      clinicId: clinic.clinicId,
      appointmentId,
      phone: rawPhone,
    });
    return { queued: false, reason: "invalid_phone_format" };
  }

  const requestedDateTime = formatAppointmentDateTime(
    appointment.preferredStart ?? appointment.date,
    appointment.slot,
  );

  const clinicName = clinic.name ?? clinic.clinicId;
  const specialization = appointment.specialization ?? "General";
  const doctorName = appointment.doctorName ?? "Any available doctor";
  const notes = appointment.notes ?? "";
  const baseUrl = process.env.PUBLIC_BASE_URL ?? process.env.APP_BASE_URL ?? "https://docnearme.jp";
  const finalizeUrl = `${baseUrl}/api/voice/appointment/outcome?appointmentId=${encodeURIComponent(appointmentId)}&token=${encodeURIComponent(buildVoiceToken(appointmentId))}`;
  const firstMessage = buildElevenLabsFirstMessage({
    clinicName,
    patientName: appointment.patientName ?? "患者",
    requestedDateTime,
    specialization,
    doctorName,
  });

  const payload = {
    agent_id: agentId,
    agent_phone_number_id: agentPhoneNumberId,
    to_number: to,
    conversation_initiation_client_data: {
      dynamic_variables: {
        source: "docnearme",
        clinic_id: clinic.clinicId,
        clinic_name: clinicName,
        appointment_id: appointmentId,
        patient_name: appointment.patientName ?? "patient",
        patientName: appointment.patientName ?? "patient",
        requested_date_time: requestedDateTime,
        requestedDateTime: requestedDateTime,
        finalize_url: finalizeUrl,
        finalizeUrl,
        specialization,
        doctor_name: doctorName,
        doctorName,
        notes,
        locale: "ja-JP",
        decision_options: ["confirm", "decline", "request_additional_information", "reschedule"],
      },
      conversation_config_override: {
        agent: {
          language: "ja",
          first_message: firstMessage,
        },
        conversation: {
          text_only: false,
        },
      },
    },
  };

  try {
    const outboundUrl = getElevenLabsOutboundUrl();
    const response = await fetch(outboundUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const rawBody = await response.text();
    const data = rawBody
      ? ((() => {
          try {
            return JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            return {} as Record<string, unknown>;
          }
        })())
      : ({} as Record<string, unknown>);

    if (!response.ok) {
      const reason = extractElevenLabsReason(data, rawBody, response.status, response.statusText);
      logger.warn("[clinic-call] elevenlabs outbound rejected", {
        clinicId: clinic.clinicId,
        appointmentId,
        status: response.status,
        statusText: response.statusText,
        outboundUrl,
        reason,
      });
      return { queued: false, reason };
    }

    logger.info("[clinic-call] elevenlabs call initiated", {
      clinicId: clinic.clinicId,
      appointmentId,
      responseSummary: {
        conversationId:
          typeof data.conversation_id === "string"
            ? data.conversation_id
            : typeof data.conversationId === "string"
              ? data.conversationId
              : undefined,
        callSid:
          typeof data.call_sid === "string"
            ? data.call_sid
            : typeof data.callSid === "string"
              ? data.callSid
              : undefined,
        status: typeof data.status === "string" ? data.status : undefined,
      },
    });
    return { queued: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[clinic-call] elevenlabs request failed", {
      clinicId: clinic.clinicId,
      appointmentId,
      error: message,
    });
    return { queued: false, reason: `elevenlabs_error:${message}` };
  }
};

export const dispatchClinicBookingNotificationCall = async (
  clinicId: string,
  appointmentId: string,
  logger: Logger = console,
): Promise<ClinicCallDispatchResult> => {
  const resolvedSettings = await getResolvedCallSettings();
  const provider = resolvedSettings.provider;

  if (provider === "twilio") {
    const twilioResult = await sendClinicBookingNotificationCall(clinicId, appointmentId, logger);
    return {
      queued: twilioResult.queued,
      reason: twilioResult.reason,
      provider: "twilio",
    };
  }

  const appointments = await getAppointmentsCollection();
  const appointmentLookup = resolveAppointmentLookup(appointmentId);
  const appointment = await appointments.findOne({ _id: appointmentLookup });

  if (!appointment) {
    return { queued: false, reason: "appointment_not_found", provider: "elevenlabs" };
  }

  const clinics = await getClinicInfoCollection();
  const clinic = await clinics.findOne({ clinicId });
  if (!clinic) {
    return { queued: false, reason: "clinic_not_found", provider: "elevenlabs" };
  }

  if (!shouldSendPhoneNotification(clinic)) {
    return {
      queued: false,
      reason: "phone_notifications_disabled_or_missing",
      provider: "elevenlabs",
    };
  }

  const elevenResult = await queueElevenLabsCall(clinic, appointment as Appointment, appointmentId, logger);
  if (elevenResult.queued) {
    return { queued: true, provider: "elevenlabs" };
  }

  logger.warn("[clinic-call] elevenlabs call not queued", {
    clinicId,
    appointmentId,
    reason: elevenResult.reason ?? "unknown",
    fallbackEnabled: resolvedSettings.fallbackToTwilio,
  });

  if (!resolvedSettings.fallbackToTwilio) {
    return {
      queued: false,
      reason: elevenResult.reason,
      provider: "elevenlabs",
      fallbackUsed: false,
    };
  }

  const twilioResult = await sendClinicBookingNotificationCall(clinicId, appointmentId, logger);
  return {
    queued: twilioResult.queued,
    reason: twilioResult.queued ? undefined : twilioResult.reason ?? elevenResult.reason,
    provider: "elevenlabs",
    fallbackUsed: true,
  };
};
