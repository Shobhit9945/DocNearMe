import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getAppointmentsCollection, getClinicInfoCollection } from "../db";
import type { Appointment, ClinicInfo } from "../types";
import { sendEmail } from "./mailer";

type Logger = Pick<Console, "info" | "warn" | "error">;

type ClinicBookingNotificationDetails = {
  clinicName: string;
  patientName: string;
  doctorName: string;
  requestedDateTime: string;
  specialization: string;
  statusLabel: string;
  portalUrl: string;
  confirmUrl: string;
  declineUrl: string;
};

type ClinicBookingNotificationEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const DEFAULT_PORTAL_URL = "https://clinic.docnearme.app/appointments";
const CLINIC_PORTAL_APPOINTMENTS_URL =
  process.env.CLINIC_PORTAL_APPOINTMENTS_URL ?? DEFAULT_PORTAL_URL;
const APP_BASE_URL =
  process.env.APP_BASE_URL ??
  process.env.PUBLIC_BASE_URL ??
  "https://docnearme.jp";
const DEEPL_API_KEY = process.env.DEEPL ?? process.env.DEEPL_API_KEY ?? "";
const DEEPL_API_URL = process.env.DEEPL_API_URL ?? "https://api-free.deepl.com/v2/translate";
const GOOGLE_TRANSLATE_ENDPOINT =
  "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ja&dt=t&q=";
const NOTIFICATION_RETRY_DELAYS_MS = [1000, 3000];
const CONFIRMATION_TOKEN_BYTES = 32;
const CONFIRMATION_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const buildClinicActionUrl = (
  baseUrl: string,
  appointmentId: string,
  token: string,
  action: "confirm" | "decline",
) => {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const useClinicPath = /\.netlify\.app$/i.test(normalizedBase);
  const pathPrefix = useClinicPath ? "/clinic" : "";
  return `${normalizedBase}${pathPrefix}/confirm?appointmentId=${encodeURIComponent(
    appointmentId,
  )}&token=${encodeURIComponent(token)}&action=${action}`;
};

const resolveAppointmentLookup = (appointmentId: string) =>
  ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : appointmentId;

const formatAppointmentDateTime = (preferredStart?: string, slot?: string) => {
  const dateValue = preferredStart ?? "";
  if (!dateValue) return slot ? `- ${slot}` : "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return slot ? `${dateValue} (${slot})` : dateValue;
  const localized = date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  return slot ? `${localized} (${slot})` : localized;
};

const containsJapanese = (text: string) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf]/.test(text);

const translateWithGoogle = async (text: string, logger: Logger) => {
  try {
    const response = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}${encodeURIComponent(text)}`);
    if (!response.ok) return undefined;
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return undefined;
    const translated = data[0]
      .map((chunk) => (Array.isArray(chunk) && typeof chunk[0] === "string" ? chunk[0] : ""))
      .join("")
      .trim();
    if (!translated || translated === text) return undefined;
    return translated;
  } catch (error) {
    logger.warn("[clinic-notification] google_translate_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
};

const translateToJapanese = async (inputs: string[], logger: Logger) => {
  if (inputs.length === 0) return inputs;
  const sanitizedInputs = inputs.map((value) => value?.trim() ?? "");
  const shouldTranslate = sanitizedInputs.map((value) => value && !containsJapanese(value));

  if (DEEPL_API_KEY && shouldTranslate.some(Boolean)) {
    const params = new URLSearchParams();
    sanitizedInputs.forEach((value, index) => {
      if (shouldTranslate[index]) params.append("text", value);
    });
    params.append("target_lang", "JA");

    try {
      const response = await fetch(DEEPL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (response.ok) {
        const data = (await response.json()) as { translations?: Array<{ text: string }> };
        if (data.translations) {
          const translations = data.translations.map((item) => item.text ?? "");
          let translateIndex = 0;
          return sanitizedInputs.map((value, index) => {
            if (!shouldTranslate[index]) return value;
            const translated = translations[translateIndex] ?? value;
            translateIndex += 1;
            return translated || value;
          });
        }
      } else {
        logger.warn("[clinic-notification] deepl_translate_failed", {
          status: response.status,
        });
      }
    } catch (error) {
      logger.warn("[clinic-notification] deepl_translate_error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const translatedWithGoogle = await Promise.all(
    sanitizedInputs.map(async (value, index) => {
      if (!shouldTranslate[index]) return value;
      return (await translateWithGoogle(value, logger)) ?? value;
    }),
  );
  return translatedWithGoogle;
};

export const buildClinicBookingNotificationEmail = (
  recipient: string,
  details: ClinicBookingNotificationDetails,
): ClinicBookingNotificationEmail => {
  const subject = "【DocNearMe】新しい予約リクエストがあります";
  const text = [
    `${details.clinicName} 様`,
    "",
    "新しい予約リクエストがあります。",
    "",
    `患者名: ${details.patientName}`,
    `担当医: ${details.doctorName}`,
    `希望日時: ${details.requestedDateTime}`,
    `診療科: ${details.specialization}`,
    `ステータス: ${details.statusLabel}`,
    "",
    `承認: ${details.confirmUrl}`,
    `却下: ${details.declineUrl}`,
    "",
    `予約管理: ${details.portalUrl}`,
    "",
    "院内ポータルで内容をご確認ください。",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">新しい予約リクエストがあります</h2>
      <p style="margin: 0 0 12px;">${details.clinicName} 様</p>
      <table style="border-collapse: collapse; width: 100%; margin: 12px 0;">
        <tbody>
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 120px;">患者名</td>
            <td style="padding: 6px 0; font-weight: 600;">${details.patientName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">担当医</td>
            <td style="padding: 6px 0; font-weight: 600;">${details.doctorName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">希望日時</td>
            <td style="padding: 6px 0; font-weight: 600;">${details.requestedDateTime}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">診療科</td>
            <td style="padding: 6px 0; font-weight: 600;">${details.specialization}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">ステータス</td>
            <td style="padding: 6px 0; font-weight: 600;">${details.statusLabel}</td>
          </tr>
        </tbody>
      </table>
      <div style="margin: 16px 0; display: flex; gap: 12px; flex-wrap: wrap;">
        <a
          href="${details.confirmUrl}"
          style="background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 999px; font-weight: 600;"
        >
          承認する
        </a>
        <a
          href="${details.declineUrl}"
          style="background: #ef4444; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 999px; font-weight: 600;"
        >
          却下する
        </a>
      </div>
      <p style="margin: 12px 0;">予約管理: <a href="${details.portalUrl}">${details.portalUrl}</a></p>
      <p style="margin: 12px 0; color: #475569;">院内ポータルで内容をご確認ください。</p>
    </div>
  `;

  return { to: recipient, subject, text, html };
};

export const resolveClinicNotificationRecipient = (
  clinic: Pick<ClinicInfo, "clinicId" | "email">,
  logger: Logger = console,
) => {
  const email = typeof clinic.email === "string" ? clinic.email.trim() : "";
  if (!email) {
    logger.warn("[clinic-notification] missing clinic email", {
      clinicId: clinic.clinicId,
    });
    return null;
  }
  return email;
};

export const shouldSendClinicBookingNotification = (appointment: Appointment | null) =>
  Boolean(appointment && !appointment.notificationSentAt);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sendWithRetry = async (
  payload: ClinicBookingNotificationEmail,
  logger: Logger,
  clinicId: string,
  appointmentId: string,
) => {
  for (let attempt = 0; attempt <= NOTIFICATION_RETRY_DELAYS_MS.length; attempt += 1) {
    logger.info("[clinic-notification] send_attempt", {
      clinicId,
      appointmentId,
      attempt: attempt + 1,
    });
    try {
      const sent = await sendEmail(payload);
      if (sent) {
        logger.info("[clinic-notification] send_success", { clinicId, appointmentId });
        return true;
      }
    } catch (error) {
      logger.error("[clinic-notification] send_error", {
        clinicId,
        appointmentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (attempt < NOTIFICATION_RETRY_DELAYS_MS.length) {
      await wait(NOTIFICATION_RETRY_DELAYS_MS[attempt]);
    }
  }

  logger.error("[clinic-notification] send_failed", { clinicId, appointmentId });
  return false;
};

export const sendClinicBookingNotificationEmail = async (
  clinicId: string,
  appointmentId: string,
  logger: Logger = console,
) => {
  const appointments = await getAppointmentsCollection();
  const appointmentLookup = resolveAppointmentLookup(appointmentId);
  const appointment = await appointments.findOne({ _id: appointmentLookup });

  if (!appointment) {
    logger.warn("[clinic-notification] appointment not found", { clinicId, appointmentId });
    return false;
  }

  if (!shouldSendClinicBookingNotification(appointment)) {
    logger.info("[clinic-notification] already sent", { clinicId, appointmentId });
    return true;
  }

  const clinics = await getClinicInfoCollection();
  const clinic = await clinics.findOne({ clinicId });
  if (!clinic) {
    logger.warn("[clinic-notification] clinic not found", { clinicId, appointmentId });
    return false;
  }

  const recipient = resolveClinicNotificationRecipient(clinic, logger);
  if (!recipient) {
    return false;
  }

  const requestedDateTime = formatAppointmentDateTime(
    appointment.preferredStart ?? appointment.date,
    appointment.slot,
  );

  const details: ClinicBookingNotificationDetails = {
    clinicName: clinic.name ?? clinicId,
    patientName: appointment.patientName ?? "患者様",
    doctorName: appointment.doctorName ?? "指定なし",
    requestedDateTime,
    specialization: appointment.specialization ?? "一般診療",
    statusLabel: "承認待ち",
    portalUrl: CLINIC_PORTAL_APPOINTMENTS_URL,
    confirmUrl: "",
    declineUrl: "",
  };

  const rawToken = crypto.randomBytes(CONFIRMATION_TOKEN_BYTES).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + CONFIRMATION_TOKEN_TTL_MS);
  details.confirmUrl = buildClinicActionUrl(APP_BASE_URL, appointmentId, rawToken, "confirm");
  details.declineUrl = buildClinicActionUrl(APP_BASE_URL, appointmentId, rawToken, "decline");

  const [translatedClinicName, translatedPatientName, translatedDoctorName, translatedSpecialization] =
    await translateToJapanese(
      [details.clinicName, details.patientName, details.doctorName, details.specialization],
      logger,
    );
  details.clinicName = translatedClinicName || details.clinicName;
  details.patientName = translatedPatientName || details.patientName;
  details.doctorName = translatedDoctorName || details.doctorName;
  details.specialization = translatedSpecialization || details.specialization;

  await appointments.updateOne(
    { _id: appointmentLookup as unknown as ObjectId },
    {
      $set: {
        clinicConfirmationTokenHash: hashToken(rawToken),
        tokenExpiresAt,
        updatedAt: new Date(),
      },
    },
  );

  const payload = buildClinicBookingNotificationEmail(recipient, details);
  const sent = await sendWithRetry(payload, logger, clinicId, appointmentId);

  if (sent) {
    await appointments.updateOne(
      { _id: appointmentLookup as unknown as ObjectId },
      { $set: { notificationSentAt: new Date(), updatedAt: new Date() } },
    );
  }

  return sent;
};

export const queueClinicBookingNotificationEmail = (
  clinicId: string,
  appointmentId: string,
  logger: Logger = console,
) => {
  setTimeout(() => {
    void sendClinicBookingNotificationEmail(clinicId, appointmentId, logger);
  }, 0);
};
