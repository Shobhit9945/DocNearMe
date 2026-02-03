import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getAppointmentsCollection, getClinicInfoCollection } from "../db";
import type { Appointment, ClinicInfo } from "../types";

type Logger = Pick<Console, "info" | "warn" | "error">;

type VoiceNotificationDetails = {
  clinicName: string;
  patientName: string;
  requestedDateTime: string;
  appointmentId: string;
};

const DEFAULT_VOICE_BASE_URL = "https://clinic.docnearme.app";

const getTwilioAccountSid = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (!sid) throw new Error("Twilio account SID is not configured.");
  return sid;
};

const getTwilioAuthToken = () => {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) throw new Error("Twilio auth token is not configured.");
  return token;
};

const getTwilioCallerId = () => {
  const from = process.env.TWILIO_CALLER_ID;
  if (!from) throw new Error("Twilio caller ID is not configured.");
  return from;
};

const getVoiceWebhookBaseUrl = () =>
  process.env.VOICE_WEBHOOK_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? DEFAULT_VOICE_BASE_URL;

const getVoiceWebhookSecret = () => {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) throw new Error("VOICE_WEBHOOK_SECRET is not configured.");
  return secret;
};

const buildVoiceToken = (appointmentId: string) =>
  crypto.createHmac("sha256", getVoiceWebhookSecret()).update(appointmentId).digest("hex");

const resolveAppointmentLookup = (appointmentId: string) =>
  ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : appointmentId;

const formatAppointmentDateTime = (preferredStart?: string, slot?: string) => {
  const dateValue = preferredStart ?? "";
  if (!dateValue) return slot ? `- ${slot}` : "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return slot ? `${dateValue} (${slot})` : dateValue;
  const localized = date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
  return slot ? `${localized} (${slot})` : localized;
};

const buildVoiceDetails = (clinic: ClinicInfo, appointment: Appointment): VoiceNotificationDetails => {
  const requestedDateTime = formatAppointmentDateTime(
    appointment.preferredStart ?? appointment.date,
    appointment.slot,
  );
  return {
    clinicName: clinic.name ?? clinic.clinicId,
    patientName: appointment.patientName ?? "patient",
    requestedDateTime,
    appointmentId: String(appointment._id ?? appointment.id ?? ""),
  };
};

const buildCallUrl = (appointmentId: string) => {
  const baseUrl = getVoiceWebhookBaseUrl().replace(/\/$/, "");
  const token = buildVoiceToken(appointmentId);
  return `${baseUrl}/api/voice/appointment?appointmentId=${encodeURIComponent(
    appointmentId,
  )}&token=${encodeURIComponent(token)}`;
};

const createTwilioCall = async (to: string, url: string) => {
  const accountSid = getTwilioAccountSid();
  const authToken = getTwilioAuthToken();
  const from = getTwilioCallerId();

  const body = new URLSearchParams({
    To: to,
    From: from,
    Url: url,
    Method: "POST",
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message ?? "Twilio call failed.";
    throw new Error(message);
  }

  return data;
};

export const shouldSendClinicBookingNotificationCall = (clinic: ClinicInfo | null) =>
  Boolean(clinic?.notificationPhoneEnabled && clinic?.phone);

export const sendClinicBookingNotificationCall = async (
  clinicId: string,
  appointmentId: string,
  logger: Logger = console,
) => {
  const appointments = await getAppointmentsCollection();
  const appointmentLookup = resolveAppointmentLookup(appointmentId);
  const appointment = await appointments.findOne({ _id: appointmentLookup });

  if (!appointment) {
    logger.warn("[clinic-call] appointment not found", { clinicId, appointmentId });
    return false;
  }

  const clinics = await getClinicInfoCollection();
  const clinic = await clinics.findOne({ clinicId });
  if (!clinic) {
    logger.warn("[clinic-call] clinic not found", { clinicId, appointmentId });
    return false;
  }

  if (!shouldSendClinicBookingNotificationCall(clinic)) {
    logger.info("[clinic-call] phone notifications disabled or missing phone", {
      clinicId,
      appointmentId,
    });
    return false;
  }

  const to = String(clinic.phone).trim();
  if (!to) {
    logger.warn("[clinic-call] missing phone", { clinicId, appointmentId });
    return false;
  }

  const url = buildCallUrl(String(appointmentId));
  try {
    await createTwilioCall(to, url);
    logger.info("[clinic-call] call initiated", { clinicId, appointmentId });
    return true;
  } catch (error) {
    logger.error("[clinic-call] call failed", {
      clinicId,
      appointmentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

export const buildVoicePrompt = (details: VoiceNotificationDetails) => {
  return (
    `Hello ${details.clinicName}. ` +
    `You have a new appointment request for ${details.patientName}. ` +
    `Requested time: ${details.requestedDateTime}. ` +
    "Press 1 to accept, 2 to decline, 3 to request reschedule. " +
    "Please view your email and dashboard for further information."
  );
};

export const verifyVoiceToken = (appointmentId: string, token: string) => {
  if (!appointmentId || !token) return false;
  const expected = buildVoiceToken(appointmentId);
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  if (expectedBuffer.length !== tokenBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, tokenBuffer);
};
