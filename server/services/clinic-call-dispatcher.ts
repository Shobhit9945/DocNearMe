import { ObjectId } from "mongodb";
import { getAppointmentsCollection, getClinicInfoCollection } from "../db";
import type { Appointment, ClinicInfo } from "../types";
import { sendClinicBookingNotificationCall } from "./twilio-voice";
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

const getElevenLabsOutboundUrl =
  () => process.env.ELEVENLABS_OUTBOUND_CALL_URL ?? "https://api.elevenlabs.io/v1/convai/outbound-calls";

const formatAppointmentDateTime = (preferredStart?: string, slot?: string) => {
  const dateValue = preferredStart ?? "";
  if (!dateValue) return slot ? `- ${slot}` : "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return slot ? `${dateValue} (${slot})` : dateValue;
  const localized = date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  return slot ? `${localized} (${slot})` : localized;
};

const queueElevenLabsCall = async (
  clinic: ClinicInfo,
  appointment: Appointment,
  appointmentId: string,
  logger: Logger,
): Promise<{ queued: boolean; reason?: string }> => {
  const apiKey = getElevenLabsApiKey();
  const agentId = getElevenLabsAgentId();
  if (!apiKey || !agentId) {
    return { queued: false, reason: "elevenlabs_not_configured" };
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

  const payload = {
    agent_id: agentId,
    to_number: to,
    metadata: {
      source: "docnearme",
      clinicId: clinic.clinicId,
      appointmentId,
      patientName: appointment.patientName ?? "patient",
      requestedDateTime,
      decisionOptions: ["confirm", "decline", "reschedule"],
      locale: "ja-JP",
    },
  };

  try {
    const response = await fetch(getElevenLabsOutboundUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason =
        typeof data?.detail === "string"
          ? data.detail
          : typeof data?.message === "string"
            ? data.message
            : "elevenlabs_call_failed";
      return { queued: false, reason };
    }

    logger.info("[clinic-call] elevenlabs call initiated", {
      clinicId: clinic.clinicId,
      appointmentId,
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
