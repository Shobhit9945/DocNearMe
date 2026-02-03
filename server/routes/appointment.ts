import crypto from "crypto";
import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
  getAppointmentsCollection,
  getClinicInfoCollection,
  getClinicIntakeFormsCollection,
  getIntakeResponsesCollection,
  getPatientsCollection,
} from "../db";
import {
  Appointment,
  AppointmentStatus,
  ClinicIntakeForm,
  IntakeAnswerValue,
  IntakeFormAnswer,
  IntakeQuestion,
  PatientAppointmentSummary,
  SharedMedicalRecord,
} from "../types";
import { sendEmail } from "../services/mailer";
import { queueClinicBookingNotificationEmail } from "../services/clinic-booking-notifications";
import { sendClinicBookingNotificationCall } from "../services/twilio-voice";
import { findConfirmedOverlap } from "./appointment-utils";
import { getDateKey, isClinicClosedOnDate, isSlotInFutureJst, normalizeClinicHours } from "../lib/scheduling";

const parseRequestBody = (body: unknown): Record<string, unknown> => {
  if (body instanceof Buffer) {
    return parseRequestBody(body.toString("utf8"));
  }
  if (body instanceof Uint8Array) {
    return parseRequestBody(Buffer.from(body).toString("utf8"));
  }
  if (body && typeof body === "object") return body as Record<string, unknown>;
  if (typeof body !== "string") return {};

  const trimmed = body.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const params = new URLSearchParams(trimmed);
    const payload: Record<string, string> = {};
    params.forEach((value, key) => {
      payload[key] = value;
    });
    return payload;
  }
};

const generateBookingId = () =>
  `DNM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const CONFIRMATION_TOKEN_BYTES = 32;
const CONFIRMATION_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const DEFAULT_APPOINTMENT_MINUTES = 30;

const formatSlotLabel = (date: Date) =>
  date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const buildClinicNotificationEmail = (clinicId: string) =>
  process.env.CLINIC_NOTIFICATION_EMAIL ?? `clinic-${clinicId}@docnearme.local`;

const buildAppBaseUrl = () => process.env.APP_BASE_URL ?? "http://localhost:8080";

const parseDateOrNull = (value: unknown) => {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const sanitizeChoice = (options: string[], value: string) =>
  options.length > 0 ? (options.includes(value) ? value : "") : value;

const sanitizeIntakeAnswerValue = (question: IntakeQuestion, rawValue: unknown): IntakeAnswerValue => {
  switch (question.questionType) {
    case "short-text":
    case "long-text": {
      const value = normalizeString(rawValue);
      return value.length ? value : null;
    }
    case "single-choice": {
      const value = normalizeString(rawValue);
      if (!value) return null;
      const sanitized = sanitizeChoice(question.options ?? [], value);
      return sanitized ? sanitized : null;
    }
    case "multiple-choice": {
      if (!Array.isArray(rawValue)) return null;
      const sanitized = rawValue
        .map((entry) => normalizeString(entry))
        .filter(Boolean)
        .filter((entry, index, arr) => arr.indexOf(entry) === index);
      if (question.options?.length) {
        const allowed = sanitized.filter((entry) => question.options.includes(entry));
        return allowed.length ? allowed : null;
      }
      return sanitized.length ? sanitized : null;
    }
    case "number": {
      const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
      if (Number.isNaN(value)) return null;
      return value;
    }
    case "date": {
      const value = normalizeString(rawValue);
      return value.length ? value : null;
    }
    case "boolean": {
      if (typeof rawValue === "boolean") return rawValue;
      return null;
    }
    case "file":
    default:
      return null;
  }
};

const isAnswerProvided = (question: IntakeQuestion, value: IntakeAnswerValue) => {
  if (question.questionType === "boolean") {
    return typeof value === "boolean";
  }
  if (question.questionType === "multiple-choice") {
    return Array.isArray(value) && value.length > 0;
  }
  if (question.questionType === "number") {
    return typeof value === "number" && !Number.isNaN(value);
  }
  if (question.questionType === "date") {
    return typeof value === "string" && value.trim().length > 0;
  }
  return typeof value === "string" && value.trim().length > 0;
};

const sanitizeIntakeResponses = (
  form: ClinicIntakeForm,
  payload: unknown,
): { responses: IntakeFormAnswer[]; missingRequired: IntakeQuestion[] } => {
  const rawResponses = payload && typeof payload === "object" && Array.isArray((payload as any).responses)
    ? ((payload as any).responses as unknown[])
    : [];
  const questionMap = new Map(form.questions.map((question) => [question.id, question]));
  const responses: IntakeFormAnswer[] = [];

  rawResponses.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const questionId = normalizeString((entry as any).questionId);
    if (!questionId) return;
    const question = questionMap.get(questionId);
    if (!question) return;
    const sanitizedValue = sanitizeIntakeAnswerValue(question, (entry as any).value);
    if (sanitizedValue === null) return;
    responses.push({
      questionId,
      label: question.label,
      questionType: question.questionType,
      dataType: question.dataType,
      value: sanitizedValue,
    });
  });

  const responseMap = new Map(responses.map((response) => [response.questionId, response]));
  const missingRequired = form.questions.filter(
    (question) => question.required && !isAnswerProvided(question, responseMap.get(question.id)?.value ?? null),
  );

  return { responses, missingRequired };
};

const resolvePreferredTimes = (payload: Record<string, unknown>, slotFallback?: string) => {
  const preferredStartRaw =
    typeof payload.preferredStart === "string"
      ? payload.preferredStart
      : typeof payload.date === "string"
        ? payload.date
        : "";
  const preferredStart = parseDateOrNull(preferredStartRaw);
  if (!preferredStart) return null;

  const preferredEndRaw = typeof payload.preferredEnd === "string" ? payload.preferredEnd : "";
  let preferredEnd = parseDateOrNull(preferredEndRaw);
  if (!preferredEnd) {
    preferredEnd = new Date(preferredStart.getTime() + DEFAULT_APPOINTMENT_MINUTES * 60 * 1000);
  }

  if (preferredEnd <= preferredStart) {
    return null;
  }

  const slot = typeof payload.slot === "string" ? payload.slot : slotFallback ?? formatSlotLabel(preferredStart);
  const dateKey = getDateKey(preferredStart);

  return {
    preferredStart,
    preferredEnd,
    slot,
    dateKey,
  };
};

const MAX_RECORD_SIZE_BYTES = 8 * 1024 * 1024;

const parseSharedRecord = (value: unknown): SharedMedicalRecord | null => {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  const recordId = typeof payload.recordId === "string" ? payload.recordId : "";
  const name = typeof payload.name === "string" ? payload.name : "";
  const type = typeof payload.type === "string" ? payload.type : "";
  const size = typeof payload.size === "number" ? payload.size : Number(payload.size);
  const iv = typeof payload.iv === "string" ? payload.iv : "";
  const data = typeof payload.data === "string" ? payload.data : "";

  if (!recordId || !name || !type || !iv || !data) return null;
  if (!type.startsWith("image/") && type !== "application/pdf") return null;
  if (Number.isNaN(size) || size <= 0 || size > MAX_RECORD_SIZE_BYTES) return null;

  return { recordId, name, type, size, iv, data };
};

const serializeAppointment = (appointment: Appointment) => {
  const fallbackPreferredStart = appointment.preferredStart ?? appointment.date;
  const fallbackPreferredStartDate = parseDateOrNull(fallbackPreferredStart) ?? new Date();
  const fallbackPreferredEnd =
    appointment.preferredEnd ??
    new Date(fallbackPreferredStartDate.getTime() + DEFAULT_APPOINTMENT_MINUTES * 60 * 1000).toISOString();
  const status: AppointmentStatus = appointment.status ?? "CONFIRMED";

  return {
    _id: appointment._id
      ? appointment._id instanceof ObjectId
        ? appointment._id.toString()
        : String(appointment._id)
      : "",
    date: appointment.date,
    dateKey: appointment.dateKey,
    slot: appointment.slot,
    preferredStart: appointment.preferredStart ?? fallbackPreferredStart,
    preferredEnd: appointment.preferredEnd ?? fallbackPreferredEnd,
    confirmedStart: appointment.confirmedStart,
    confirmedEnd: appointment.confirmedEnd,
    status,
    declineReason: appointment.declineReason,
    clinicMessage: appointment.clinicMessage,
    specialization: appointment.specialization,
    doctorName: appointment.doctorName,
    clinicId: appointment.clinicId,
    serviceId: appointment.serviceId,
    notes: appointment.notes,
    patientId: appointment.patientId,
    patientName: appointment.patientName,
    patientPhone: appointment.patientPhone,
    patientEmail: appointment.patientEmail,
    patientVisaType: appointment.patientVisaType,
    createdAt: appointment.createdAt instanceof Date ? appointment.createdAt.toISOString() : appointment.createdAt,
    updatedAt: appointment.updatedAt instanceof Date ? appointment.updatedAt.toISOString() : appointment.updatedAt,
  };
};

const resolveAppointmentId = (appointmentId: string) =>
  ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : appointmentId;

const DEEPL_API_URL = process.env.DEEPL_API_URL ?? "https://api-free.deepl.com/v2/translate";
const DEEPL_API_KEY = process.env.DEEPL;
const GOOGLE_TRANSLATE_ENDPOINT =
  "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ja&dt=t&q=";

const containsJapanese = (text: string) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf]/.test(text);

const translateWithDeepL = async (text: string) => {
  if (!DEEPL_API_KEY) return undefined;
  const params = new URLSearchParams();
  params.append("text", text);
  params.append("target_lang", "JA");

  const response = await fetch(DEEPL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("DeepL translation error", errorBody);
    return undefined;
  }

  const data = (await response.json()) as { translations?: Array<{ text?: string }> };
  const translated = data.translations?.[0]?.text?.trim() ?? "";
  if (!translated || translated === text) return undefined;
  return translated;
};

const translateWithGoogle = async (text: string) => {
  const response = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}${encodeURIComponent(text)}`);
  if (!response.ok) {
    return undefined;
  }
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) return undefined;
  const translated = data[0]
    .map((chunk) => (Array.isArray(chunk) && typeof chunk[0] === "string" ? chunk[0] : ""))
    .join("")
    .trim();
  if (!translated || translated === text) return undefined;
  return translated;
};

const translateToJapanese = async (text?: string) => {
  if (!text) return undefined;
  if (containsJapanese(text)) return text;
  try {
    const deepLTranslation = await translateWithDeepL(text);
    if (deepLTranslation) return deepLTranslation;
    const googleTranslation = await translateWithGoogle(text);
    return googleTranslation ?? text;
  } catch (error) {
    console.error("Translation error", error);
    return text;
  }
};

const calculateAge = (dateOfBirth?: string) => {
  if (!dateOfBirth) return undefined;
  const parsed = new Date(dateOfBirth);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age;
};

const resolveToken = (req: Request, payload: Record<string, unknown>) => {
  if (typeof payload.clinicConfirmationToken === "string") return payload.clinicConfirmationToken;
  if (typeof req.query.token === "string") return req.query.token;
  return "";
};

const resolveConfirmationTimes = (payload: Record<string, unknown>, fallback: { start: string; end: string }) => {
  const confirmedStart = parseDateOrNull(payload.confirmedStart) ?? parseDateOrNull(fallback.start);
  const confirmedEnd = parseDateOrNull(payload.confirmedEnd) ?? parseDateOrNull(fallback.end);
  if (!confirmedStart || !confirmedEnd || confirmedEnd <= confirmedStart) return null;
  return { confirmedStart, confirmedEnd };
};

const updatePatientAppointmentSummary = async (
  appointmentId: string,
  patientId: string | undefined,
  updates: Partial<PatientAppointmentSummary>,
) => {
  if (!patientId) return;
  const patients = await getPatientsCollection();
  const patientLookupId = ObjectId.isValid(patientId) ? new ObjectId(patientId) : patientId;
  const patient = await patients.findOne({ _id: patientLookupId });
  if (!patient?.appointments) return;

  const updatedAppointments = patient.appointments.map((summary) =>
    summary.appointmentId === appointmentId
      ? {
          ...summary,
          ...updates,
        }
      : summary,
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

const removePatientAppointmentSummary = async (appointmentId: string, patientId: string | undefined) => {
  if (!patientId) return;
  const patients = await getPatientsCollection();
  const patientLookupId = ObjectId.isValid(patientId) ? new ObjectId(patientId) : patientId;
  await patients.updateOne(
    { _id: patientLookupId },
    {
      $pull: {
        appointments: { appointmentId },
      },
    },
  );
};

const removeIntakeResponseForAppointment = async (appointmentId: string) => {
  const intakeResponses = await getIntakeResponsesCollection();
  await intakeResponses.deleteOne({ appointmentId });
};

export const handleRequestAppointment = async (req: Request, res: Response) => {
  const payload = parseRequestBody(req.body);
  const {
    clinicId,
    patientName,
    patientPhone,
    patientEmail,
    note,
    serviceId,
    specialization,
    doctorName,
    sharedRecord,
  } = payload ?? {};
  const sharedRecordPayload = parseSharedRecord(sharedRecord);

  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  if (!clinicId || !patientName || !patientPhone || !patientEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if ((sharedRecord !== undefined && sharedRecord !== null) && !sharedRecordPayload) {
    return res.status(400).json({ error: "Invalid shared medical record." });
  }

  const preferredTimes = resolvePreferredTimes(payload);
  if (!preferredTimes) {
    return res.status(400).json({ error: "Invalid preferred appointment time" });
  }

  if (!isSlotInFutureJst(preferredTimes.dateKey, preferredTimes.slot, new Date(), preferredTimes.preferredStart)) {
    return res.status(400).json({ error: "Preferred appointment time has already passed." });
  }

  const clinicKey = String(clinicId);
  const trimmedName = String(patientName).trim();
  const trimmedEmail = String(patientEmail).trim();
  const trimmedPhone = String(patientPhone).trim();

  try {
    const appointments = await getAppointmentsCollection();
    const patients = await getPatientsCollection();
    const clinicIntakeForms = await getClinicIntakeFormsCollection();
    const patientLookupId = ObjectId.isValid(req.auth.id) ? new ObjectId(req.auth.id) : req.auth.id;
    const patient = await patients.findOne({ _id: patientLookupId });
    const patientVisaType = typeof patient?.visaType === "string" ? patient.visaType : undefined;
    const conflict = await findConfirmedOverlap(
      appointments,
      clinicKey,
      preferredTimes.preferredStart,
      preferredTimes.preferredEnd,
    );
    if (conflict) {
      return res.status(409).json({ error: "Slot already booked" });
    }

    const clinicInfoCollection = await getClinicInfoCollection();
    const clinicInfo = await clinicInfoCollection.findOne({ clinicId: clinicKey });
    if (!clinicInfo) {
      return res.status(404).json({ error: "Clinic not found." });
    }

    const closureCheck = isClinicClosedOnDate(preferredTimes.preferredStart, normalizeClinicHours(clinicInfo.hours), clinicInfo.bookingClosures);
    if (closureCheck.closed) {
      return res.status(409).json({ error: "Clinic is closed on the selected date." });
    }

    const clinicIntakeForm = await clinicIntakeForms.findOne({ clinicId: clinicKey });
    let intakeResponses: IntakeFormAnswer[] = [];
    if (clinicIntakeForm && clinicIntakeForm.deliveryTiming === "booking" && clinicIntakeForm.questions.length) {
      const { responses, missingRequired } = sanitizeIntakeResponses(
        clinicIntakeForm,
        payload?.intakeResponse,
      );
      if (clinicIntakeForm.isRequired && missingRequired.length > 0) {
        return res.status(400).json({ error: "Intake form responses are required." });
      }
      intakeResponses = responses;
    }

    const rawToken = crypto.randomBytes(CONFIRMATION_TOKEN_BYTES).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + CONFIRMATION_TOKEN_TTL_MS);
    const now = new Date();

    const record: Appointment = {
      date: preferredTimes.preferredStart.toISOString(),
      dateKey: preferredTimes.dateKey,
      slot: preferredTimes.slot,
      preferredStart: preferredTimes.preferredStart.toISOString(),
      preferredEnd: preferredTimes.preferredEnd.toISOString(),
      confirmedStart: undefined,
      confirmedEnd: undefined,
      status: "PENDING_CLINIC",
      clinicConfirmationTokenHash: hashToken(rawToken),
      tokenExpiresAt,
      declineReason: undefined,
      specialization: typeof specialization === "string" ? specialization : "General",
      doctorName: typeof doctorName === "string" ? doctorName.trim() : undefined,
      clinicId: clinicKey,
      serviceId: typeof serviceId === "string" ? serviceId : undefined,
      notes: typeof note === "string" ? note : typeof payload.notes === "string" ? payload.notes : undefined,
      patientId: req.auth.id,
      patientName: trimmedName || req.auth.name,
      patientPhone: trimmedPhone,
      patientEmail: trimmedEmail || req.auth.email,
      patientVisaType,
      sharedRecord: sharedRecordPayload ?? undefined,
      createdAt: now,
      updatedAt: now,
    };

    const result = await appointments.insertOne(record);
    const appointmentId = result.insertedId?.toString?.() ?? generateBookingId();

    if (intakeResponses.length > 0) {
      const intakeResponsesCollection = await getIntakeResponsesCollection();
      await intakeResponsesCollection.insertOne({
        appointmentId,
        clinicId: clinicKey,
        patientId: req.auth.id,
        responses: intakeResponses,
        createdAt: now,
        updatedAt: now,
      });
    }

    const patientAppointment: PatientAppointmentSummary = {
      appointmentId,
      date: record.date,
      slot: record.slot,
      preferredStart: record.preferredStart,
      preferredEnd: record.preferredEnd,
      confirmedStart: record.confirmedStart,
      confirmedEnd: record.confirmedEnd,
      status: record.status,
      specialization: record.specialization,
      doctorName: record.doctorName,
      clinicId: record.clinicId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    await patients.updateOne(
      { _id: patientLookupId },
      {
        $push: { appointments: patientAppointment },
      },
    );

    const emailAddress = record.patientEmail;
    if (emailAddress) {
      const appointmentDate = new Date(record.preferredStart);
      const formattedDate = Number.isNaN(appointmentDate.getTime())
        ? record.preferredStart
        : appointmentDate.toLocaleString();

      try {
        await sendEmail({
          to: emailAddress,
          subject: "DocNearMe appointment request received",
          text: [
            `Hi ${record.patientName ?? "there"},`,
            "",
            "We received your appointment request and sent it to the clinic for confirmation.",
            `Request ID: ${appointmentId}`,
            `Clinic: ${record.clinicId}`,
            `Preferred date: ${formattedDate}`,
            `Preferred time: ${record.slot}`,
            "",
            "You'll receive a confirmation email once the clinic approves the time.",
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="margin-bottom: 12px;">Request received</h2>
              <p>Hi ${record.patientName ?? "there"},</p>
              <p>We received your appointment request and sent it to the clinic for confirmation.</p>
              <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                <tbody>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 140px;">Request ID</td>
                    <td style="padding: 6px 0; font-weight: 600;">${appointmentId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Clinic</td>
                    <td style="padding: 6px 0; font-weight: 600;">${record.clinicId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Preferred date</td>
                    <td style="padding: 6px 0; font-weight: 600;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Preferred time</td>
                    <td style="padding: 6px 0; font-weight: 600;">${record.slot}</td>
                  </tr>
                </tbody>
              </table>
              <p>You’ll receive a confirmation email once the clinic approves the time.</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send appointment request email", error);
      }
    }

    queueClinicBookingNotificationEmail(clinicKey, appointmentId);
    let phoneCallQueued = false;
    let phoneCallReason: string | undefined;
    try {
      const callResult = await sendClinicBookingNotificationCall(clinicKey, appointmentId);
      phoneCallQueued = callResult.queued;
      phoneCallReason = callResult.queued ? undefined : callResult.reason;
    } catch (error) {
      console.error("Failed to send clinic phone notification", error);
      phoneCallReason = "call_failed";
    }

    const responseAppointment = serializeAppointment({ ...record, _id: appointmentId });

    res.status(201).json({
      success: true,
      id: appointmentId,
      appointment: responseAppointment,
      message: "Request received. Awaiting clinic confirmation.",
      phoneCallQueued,
      phoneCallReason,
    });
  } catch (error) {
    console.error("Appointment request error", error);
    res.status(500).json({ error: "Failed to submit appointment request" });
  }
};

export const handleListAppointments = async (_req: Request, res: Response) => {
  try {
    const appointments = await getAppointmentsCollection();
    const list = await appointments.find({}).sort({ date: 1, slot: 1 }).toArray();

    res.json({
      appointments: list.map(serializeAppointment),
    });
  } catch (error) {
    console.error("Appointment list error", error);
    res.status(500).json({ error: "Failed to load appointments" });
  }
};

export const handleListAppointmentsForUser = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const list = await appointments
      .find({ patientId: req.auth.id })
      .sort({ date: 1, slot: 1 })
      .toArray();

    res.json({
      appointments: list.map(serializeAppointment),
    });
  } catch (error) {
    console.error("Appointment list error", error);
    res.status(500).json({ error: "Failed to load appointments" });
  }
};

export const handleListAppointmentsForClinic = async (req: Request, res: Response) => {
  if (!req.clinicAuth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const list = await appointments
      .find({ clinicId: req.clinicAuth.clinicId })
      .sort({ date: 1, slot: 1 })
      .toArray();

    const translatedAppointments = await Promise.all(
      list.map(async (appointment) => {
        const serialized = serializeAppointment(appointment);
        return {
          ...serialized,
          patientNameTranslated: await translateToJapanese(appointment.patientName),
          notesTranslated: await translateToJapanese(appointment.notes),
        };
      }),
    );

    res.json({
      appointments: translatedAppointments,
    });
  } catch (error) {
    console.error("Clinic appointment list error", error);
    res.status(500).json({ error: "Failed to load clinic appointments" });
  }
};

export const handleClinicPatientDetails = async (req: Request, res: Response) => {
  if (!req.clinicAuth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const appointmentId = req.params.id;
  const includeRecordData = req.query.includeRecordData === "true";

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment || appointment.clinicId !== req.clinicAuth.clinicId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const patients = await getPatientsCollection();
    const patientLookupId = appointment.patientId
      ? ObjectId.isValid(appointment.patientId)
        ? new ObjectId(appointment.patientId)
        : appointment.patientId
      : null;
    const patient = patientLookupId ? await patients.findOne({ _id: patientLookupId }) : null;

    const patientName = appointment.patientName ?? patient?.name ?? "";
    const patientCountry = patient?.nationality ?? undefined;
    const patientVisaType = appointment.patientVisaType ?? patient?.visaType ?? undefined;
    const patientAge = calculateAge(patient?.dateOfBirth);
    const patientNameTranslated = await translateToJapanese(patientName);

    const sharedRecord = appointment.sharedRecord
      ? {
          ...appointment.sharedRecord,
          data: includeRecordData ? appointment.sharedRecord.data : undefined,
        }
      : undefined;

    const intakeResponses = await getIntakeResponsesCollection();
    const intakeResponse = await intakeResponses.findOne({
      appointmentId,
      clinicId: req.clinicAuth.clinicId,
    });

    return res.json({
      patient: {
        name: patientName,
        nameTranslated: patientNameTranslated,
        age: patientAge,
        country: patientCountry,
        visaType: patientVisaType,
      },
      sharedRecord,
      intakeResponse: intakeResponse
        ? {
            responses: intakeResponse.responses,
            submittedAt: intakeResponse.createdAt instanceof Date ? intakeResponse.createdAt.toISOString() : undefined,
          }
        : undefined,
    });
  } catch (error) {
    console.error("Clinic patient details error", error);
    return res.status(500).json({ error: "Failed to load patient details" });
  }
};

export const handleClinicConfirmAppointment = async (req: Request, res: Response) => {
  if (!req.clinicAuth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const appointmentId = req.params.id;
  const payload = parseRequestBody(req.body);

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment || appointment.clinicId !== req.clinicAuth.clinicId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (appointment.status !== "PENDING_CLINIC" && appointment.status !== "RESCHEDULE_REQUESTED") {
      return res.status(409).json({ error: "Appointment is not awaiting confirmation." });
    }

    const fallbackStart = appointment.preferredStart ?? appointment.date;
    const fallbackEnd =
      appointment.preferredEnd ??
      new Date(new Date(fallbackStart).getTime() + DEFAULT_APPOINTMENT_MINUTES * 60 * 1000).toISOString();
    const confirmTimes = resolveConfirmationTimes(payload, { start: fallbackStart, end: fallbackEnd });
    if (!confirmTimes) {
      return res.status(400).json({ error: "Invalid confirmed time range." });
    }

    const conflict = await findConfirmedOverlap(
      appointments,
      appointment.clinicId,
      confirmTimes.confirmedStart,
      confirmTimes.confirmedEnd,
      appointment._id,
    );
    if (conflict) {
      return res.status(409).json({ error: "Confirmed time overlaps another appointment." });
    }

    const dateKey = getDateKey(confirmTimes.confirmedStart);
    const slot = formatSlotLabel(confirmTimes.confirmedStart);
    const now = new Date();

    await appointments.updateOne(
      { _id: appointmentLookup },
      {
        $set: {
          status: "CONFIRMED",
          confirmedStart: confirmTimes.confirmedStart.toISOString(),
          confirmedEnd: confirmTimes.confirmedEnd.toISOString(),
          date: confirmTimes.confirmedStart.toISOString(),
          dateKey,
          slot,
          clinicMessage: null,
          declineReason: null,
          clinicConfirmationTokenHash: null,
          tokenExpiresAt: null,
          updatedAt: now,
        },
      },
    );

    await updatePatientAppointmentSummary(appointmentId, appointment.patientId, {
      status: "CONFIRMED",
      confirmedStart: confirmTimes.confirmedStart.toISOString(),
      confirmedEnd: confirmTimes.confirmedEnd.toISOString(),
      date: confirmTimes.confirmedStart.toISOString(),
      slot,
      updatedAt: now,
    });

    if (appointment.patientEmail) {
      const formattedDate = confirmTimes.confirmedStart.toLocaleString();
      try {
        await sendEmail({
          to: appointment.patientEmail,
          subject: "Your DocNearMe appointment is confirmed",
          text: [
            `Hi ${appointment.patientName ?? "there"},`,
            "",
            "Your appointment request has been confirmed by the clinic.",
            `Appointment ID: ${appointmentId}`,
            `Clinic: ${appointment.clinicId}`,
            `Confirmed date: ${formattedDate}`,
            `Confirmed time: ${slot}`,
            "",
            "Please arrive 10 minutes early and bring a photo ID and insurance card if applicable.",
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="margin-bottom: 12px;">Appointment confirmed</h2>
              <p>Hi ${appointment.patientName ?? "there"},</p>
              <p>Your appointment request has been confirmed by the clinic.</p>
              <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                <tbody>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 160px;">Appointment ID</td>
                    <td style="padding: 6px 0; font-weight: 600;">${appointmentId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Clinic</td>
                    <td style="padding: 6px 0; font-weight: 600;">${appointment.clinicId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Confirmed date</td>
                    <td style="padding: 6px 0; font-weight: 600;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Confirmed time</td>
                    <td style="padding: 6px 0; font-weight: 600;">${slot}</td>
                  </tr>
                </tbody>
              </table>
              <p>Please arrive 10 minutes early and bring a photo ID and insurance card if applicable.</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send appointment confirmation email", error);
      }
    }

    res.json({
      success: true,
      appointment: serializeAppointment({
        ...appointment,
        status: "CONFIRMED",
        confirmedStart: confirmTimes.confirmedStart.toISOString(),
        confirmedEnd: confirmTimes.confirmedEnd.toISOString(),
        date: confirmTimes.confirmedStart.toISOString(),
        dateKey,
        slot,
        clinicMessage: null,
        declineReason: null,
        clinicConfirmationTokenHash: null,
        tokenExpiresAt: null,
        updatedAt: now,
      }),
      message: "Appointment confirmed successfully",
    });
  } catch (error) {
    console.error("Clinic appointment confirmation error", error);
    res.status(500).json({ error: "Failed to confirm appointment" });
  }
};

export const handleClinicDeclineAppointment = async (req: Request, res: Response) => {
  if (!req.clinicAuth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const appointmentId = req.params.id;
  const payload = parseRequestBody(req.body);
  const declineReason = typeof payload.declineReason === "string" ? payload.declineReason : undefined;

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment || appointment.clinicId !== req.clinicAuth.clinicId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (appointment.status !== "PENDING_CLINIC" && appointment.status !== "RESCHEDULE_REQUESTED") {
      return res.status(409).json({ error: "Appointment is not awaiting confirmation." });
    }

    const now = new Date();
    await appointments.updateOne(
      { _id: appointmentLookup },
      {
        $set: {
          status: "DECLINED",
          declineReason,
          clinicMessage: null,
          clinicConfirmationTokenHash: null,
          tokenExpiresAt: null,
          updatedAt: now,
        },
      },
    );

    await updatePatientAppointmentSummary(appointmentId, appointment.patientId, {
      status: "DECLINED",
      updatedAt: now,
    });

    if (appointment.patientEmail) {
      try {
        await sendEmail({
          to: appointment.patientEmail,
          subject: "Clinic could not confirm your appointment",
          text: [
            `Hi ${appointment.patientName ?? "there"},`,
            "",
            "The clinic was unable to confirm your requested time.",
            "Please choose another time and submit a new request.",
            declineReason ? "" : undefined,
            declineReason ? `Reason: ${declineReason}` : undefined,
          ]
            .filter(Boolean)
            .join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="margin-bottom: 12px;">Request declined</h2>
              <p>Hi ${appointment.patientName ?? "there"},</p>
              <p>The clinic was unable to confirm your requested time. Please choose another time and submit a new request.</p>
              ${declineReason ? `<p><strong>Reason:</strong> ${declineReason}</p>` : ""}
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send appointment decline email", error);
      }
    }

    res.json({
      success: true,
      appointment: serializeAppointment({
        ...appointment,
        status: "DECLINED",
        declineReason,
        clinicMessage: null,
        clinicConfirmationTokenHash: null,
        tokenExpiresAt: null,
        updatedAt: now,
      }),
      message: "Appointment request declined",
    });
  } catch (error) {
    console.error("Clinic appointment decline error", error);
    res.status(500).json({ error: "Failed to decline appointment" });
  }
};

export const handleClinicRescheduleMessage = async (req: Request, res: Response) => {
  if (!req.clinicAuth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const appointmentId = req.params.id;
  const payload = parseRequestBody(req.body);
  const message = typeof payload.message === "string" ? payload.message.trim() : "";

  if (!message) {
    return res.status(400).json({ error: "Reschedule message is required." });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment || appointment.clinicId !== req.clinicAuth.clinicId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (
      appointment.status === "CANCELLED_BY_PATIENT" ||
      appointment.status === "CANCELLED_BY_CLINIC" ||
      appointment.status === "DECLINED"
    ) {
      return res.status(409).json({ error: "Appointment can no longer be rescheduled." });
    }

    const now = new Date();
    await appointments.updateOne(
      { _id: appointmentLookup },
      {
        $set: {
          status: "RESCHEDULE_REQUESTED",
          clinicMessage: message,
          updatedAt: now,
        },
      },
    );

    await updatePatientAppointmentSummary(appointmentId, appointment.patientId, {
      status: "RESCHEDULE_REQUESTED",
      updatedAt: now,
    });

    if (appointment.patientEmail) {
      try {
        await sendEmail({
          to: appointment.patientEmail,
          subject: "Clinic requested a new appointment time",
          text: [
            `Hi ${appointment.patientName ?? "there"},`,
            "",
            "The clinic reviewed your appointment request and needs to reschedule.",
            "Message from the clinic:",
            message,
            "",
            `Appointment ID: ${appointmentId}`,
            `Clinic: ${appointment.clinicId}`,
            "",
            "Please choose a new time and submit a new request.",
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="margin-bottom: 12px;">Reschedule requested</h2>
              <p>Hi ${appointment.patientName ?? "there"},</p>
              <p>The clinic reviewed your appointment request and needs to reschedule.</p>
              <p style="margin: 12px 0;"><strong>Message from the clinic:</strong></p>
              <p style="background: #f8fafc; padding: 12px; border-radius: 8px;">${message}</p>
              <p>Appointment ID: <strong>${appointmentId}</strong></p>
              <p>Clinic: <strong>${appointment.clinicId}</strong></p>
              <p>Please choose a new time and submit a new request.</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send appointment reschedule email", error);
      }
    }

    res.json({
      success: true,
      appointment: serializeAppointment({
        ...appointment,
        status: "RESCHEDULE_REQUESTED",
        clinicMessage: message,
        updatedAt: now,
      }),
      message: "Reschedule request sent to patient",
    });
  } catch (error) {
    console.error("Clinic appointment reschedule error", error);
    res.status(500).json({ error: "Failed to send reschedule message" });
  }
};

export const handleClinicCancelAppointment = async (req: Request, res: Response) => {
  if (!req.clinicAuth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const appointmentId = req.params.id;
  const payload = parseRequestBody(req.body);
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

  if (!reason) {
    return res.status(400).json({ error: "Cancellation reason is required." });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment || appointment.clinicId !== req.clinicAuth.clinicId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (
      appointment.status === "CANCELLED_BY_PATIENT" ||
      appointment.status === "CANCELLED_BY_CLINIC" ||
      appointment.status === "DECLINED"
    ) {
      return res.status(409).json({ error: "Appointment can no longer be cancelled." });
    }

    const now = new Date();
    await appointments.updateOne(
      { _id: appointmentLookup },
      {
        $set: {
          status: "CANCELLED_BY_CLINIC",
          declineReason: reason,
          clinicMessage: null,
          clinicConfirmationTokenHash: null,
          tokenExpiresAt: null,
          updatedAt: now,
        },
      },
    );

    await updatePatientAppointmentSummary(appointmentId, appointment.patientId, {
      status: "CANCELLED_BY_CLINIC",
      updatedAt: now,
    });

    await removeIntakeResponseForAppointment(appointmentId);

    if (appointment.patientEmail) {
      try {
        await sendEmail({
          to: appointment.patientEmail,
          subject: "Clinic cancelled your appointment",
          text: [
            `Hi ${appointment.patientName ?? "there"},`,
            "",
            "The clinic cancelled your appointment.",
            `Appointment ID: ${appointmentId}`,
            `Clinic: ${appointment.clinicId}`,
            `Reason: ${reason}`,
            "",
            "Please contact the clinic if you need to reschedule.",
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="margin-bottom: 12px;">Appointment cancelled</h2>
              <p>Hi ${appointment.patientName ?? "there"},</p>
              <p>The clinic cancelled your appointment.</p>
              <p><strong>Reason:</strong> ${reason}</p>
              <p>Appointment ID: <strong>${appointmentId}</strong></p>
              <p>Clinic: <strong>${appointment.clinicId}</strong></p>
              <p>Please contact the clinic if you need to reschedule.</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send appointment cancellation email", error);
      }
    }

    res.json({
      success: true,
      appointment: serializeAppointment({
        ...appointment,
        status: "CANCELLED_BY_CLINIC",
        declineReason: reason,
        clinicMessage: null,
        clinicConfirmationTokenHash: null,
        tokenExpiresAt: null,
        updatedAt: now,
      }),
      message: "Appointment cancelled",
    });
  } catch (error) {
    console.error("Clinic appointment cancellation error", error);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
};

export const handleClinicDeleteAppointment = async (req: Request, res: Response) => {
  if (!req.clinicAuth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const appointmentId = req.params.id;

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment || appointment.clinicId !== req.clinicAuth.clinicId) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const result = await appointments.deleteOne({ _id: appointmentLookup });
    if (!result.deletedCount) {
      return res.status(500).json({ error: "Unable to delete appointment." });
    }

    await removePatientAppointmentSummary(appointmentId, appointment.patientId);
    await removeIntakeResponseForAppointment(appointmentId);

    return res.json({ success: true, message: "Appointment deleted" });
  } catch (error) {
    console.error("Clinic appointment delete error", error);
    return res.status(500).json({ error: "Failed to delete appointment" });
  }
};

export const handleRescheduleAppointment = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const appointmentId = req.params.id;
  const payload = parseRequestBody(req.body);
  const { reason } = payload ?? {};

  if (!reason) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const preferredTimes = resolvePreferredTimes(payload);
  if (!preferredTimes) {
    return res.status(400).json({ error: "Invalid appointment date" });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment || appointment.patientId !== req.auth.id) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const conflict = await findConfirmedOverlap(
      appointments,
      appointment.clinicId,
      preferredTimes.preferredStart,
      preferredTimes.preferredEnd,
      appointment._id,
    );
    if (conflict) {
      return res.status(409).json({ error: "Slot already booked" });
    }

    const rawToken = crypto.randomBytes(CONFIRMATION_TOKEN_BYTES).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + CONFIRMATION_TOKEN_TTL_MS);
    const now = new Date();

    await appointments.updateOne(
      { _id: appointmentLookup },
      {
        $set: {
          date: preferredTimes.preferredStart.toISOString(),
          dateKey: preferredTimes.dateKey,
          slot: preferredTimes.slot,
          preferredStart: preferredTimes.preferredStart.toISOString(),
          preferredEnd: preferredTimes.preferredEnd.toISOString(),
          confirmedStart: null,
          confirmedEnd: null,
          status: "PENDING_CLINIC" as AppointmentStatus,
          clinicConfirmationTokenHash: hashToken(rawToken),
          tokenExpiresAt,
          declineReason: undefined,
          clinicMessage: null,
          updatedAt: now,
        },
      },
    );

    const patients = await getPatientsCollection();
    const patientLookupId = ObjectId.isValid(req.auth.id) ? new ObjectId(req.auth.id) : req.auth.id;
    const patient = await patients.findOne({ _id: patientLookupId });
    if (patient?.appointments) {
      const updatedAppointments = patient.appointments.map((summary) =>
        summary.appointmentId === appointmentId
          ? {
              ...summary,
              date: preferredTimes.preferredStart.toISOString(),
              slot: preferredTimes.slot,
              preferredStart: preferredTimes.preferredStart.toISOString(),
              preferredEnd: preferredTimes.preferredEnd.toISOString(),
              confirmedStart: null,
              confirmedEnd: null,
              status: "PENDING_CLINIC" as AppointmentStatus,
              updatedAt: now,
            }
          : summary,
      );
      await patients.updateOne(
        { _id: patientLookupId },
        {
          $set: {
            appointments: updatedAppointments,
          },
        },
      );
    }

    const clinicEmail = buildClinicNotificationEmail(appointment.clinicId);
    const baseUrl = buildAppBaseUrl();
    const confirmUrl = `${baseUrl}/api/appointments/${appointmentId}/confirm?token=${rawToken}`;
    const declineUrl = `${baseUrl}/api/appointments/${appointmentId}/decline?token=${rawToken}`;
    try {
      await sendEmail({
        to: clinicEmail,
        subject: "Updated appointment request pending confirmation",
        text: [
          `Clinic ${appointment.clinicId},`,
          "",
          "A patient rescheduled their appointment request and needs confirmation.",
          `Request ID: ${appointmentId}`,
          `Patient: ${appointment.patientName ?? "Patient"}`,
          `Preferred: ${preferredTimes.preferredStart.toISOString()} (${preferredTimes.slot})`,
          "",
          `Confirm: ${confirmUrl}`,
          `Decline: ${declineUrl}`,
          "",
          "This confirmation link expires in 48 hours.",
        ].join("\n"),
      });
    } catch (error) {
      console.error("Failed to send clinic reschedule email", error);
    }

    res.json({
      success: true,
      appointment: serializeAppointment({
        ...appointment,
        date: preferredTimes.preferredStart.toISOString(),
        dateKey: preferredTimes.dateKey,
        slot: preferredTimes.slot,
        preferredStart: preferredTimes.preferredStart.toISOString(),
        preferredEnd: preferredTimes.preferredEnd.toISOString(),
        confirmedStart: undefined,
        confirmedEnd: undefined,
        status: "PENDING_CLINIC" as AppointmentStatus,
        clinicConfirmationTokenHash: hashToken(rawToken),
        tokenExpiresAt,
        declineReason: undefined,
        updatedAt: now,
      }),
      message: "Request updated and sent to the clinic for confirmation",
    });
  } catch (error) {
    console.error("Appointment reschedule error", error);
    res.status(500).json({ error: "Failed to reschedule appointment" });
  }
};

export const handleCancelAppointment = async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const appointmentId = req.params.id;
  const payload = parseRequestBody(req.body);
  const { reason } = payload ?? {};

  if (!reason) {
    return res.status(400).json({ error: "Cancellation reason is required" });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment || appointment.patientId !== req.auth.id) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const now = new Date();
    await appointments.updateOne(
      { _id: appointmentLookup },
      {
        $set: {
          status: "CANCELLED_BY_PATIENT",
          updatedAt: now,
          clinicConfirmationTokenHash: null,
          tokenExpiresAt: null,
        },
      },
    );

    const patients = await getPatientsCollection();
    const patientLookupId = ObjectId.isValid(req.auth.id) ? new ObjectId(req.auth.id) : req.auth.id;
    const patient = await patients.findOne({ _id: patientLookupId });
    if (patient?.appointments) {
      const updatedAppointments = patient.appointments.map((summary) =>
        summary.appointmentId === appointmentId
          ? { ...summary, status: "CANCELLED_BY_PATIENT" as AppointmentStatus, updatedAt: now }
          : summary,
      );
      await patients.updateOne(
        { _id: patientLookupId },
        {
          $set: {
            appointments: updatedAppointments,
          },
        },
      );
    }

    await removeIntakeResponseForAppointment(appointmentId);

    res.json({
      success: true,
      message: "Appointment cancelled successfully",
    });
  } catch (error) {
    console.error("Appointment cancellation error", error);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
};

export const handleConfirmAppointment = async (req: Request, res: Response) => {
  const appointmentId = req.params.id;
  const payload = parseRequestBody(req.body);
  const token = resolveToken(req, payload);

  if (!token) {
    return res.status(401).json({ error: "Clinic confirmation token required." });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (appointment.status !== "PENDING_CLINIC") {
      return res.status(409).json({ error: "Appointment is not awaiting confirmation." });
    }

    if (!appointment.clinicConfirmationTokenHash || !appointment.tokenExpiresAt) {
      return res.status(401).json({ error: "Invalid or expired confirmation token." });
    }

    if (appointment.tokenExpiresAt.getTime() < Date.now()) {
      return res.status(401).json({ error: "Confirmation token expired." });
    }

    if (hashToken(token) !== appointment.clinicConfirmationTokenHash) {
      return res.status(401).json({ error: "Invalid confirmation token." });
    }

    const fallbackStart = appointment.preferredStart ?? appointment.date;
    const fallbackEnd =
      appointment.preferredEnd ??
      new Date(new Date(fallbackStart).getTime() + DEFAULT_APPOINTMENT_MINUTES * 60 * 1000).toISOString();
    const confirmTimes = resolveConfirmationTimes(payload, { start: fallbackStart, end: fallbackEnd });
    if (!confirmTimes) {
      return res.status(400).json({ error: "Invalid confirmed time range." });
    }

    const conflict = await findConfirmedOverlap(
      appointments,
      appointment.clinicId,
      confirmTimes.confirmedStart,
      confirmTimes.confirmedEnd,
      appointment._id,
    );
    if (conflict) {
      return res.status(409).json({ error: "Confirmed time overlaps another appointment." });
    }

    const dateKey = getDateKey(confirmTimes.confirmedStart);
    const slot = formatSlotLabel(confirmTimes.confirmedStart);
    const now = new Date();

    await appointments.updateOne(
      { _id: appointmentLookup },
      {
        $set: {
          status: "CONFIRMED",
          confirmedStart: confirmTimes.confirmedStart.toISOString(),
          confirmedEnd: confirmTimes.confirmedEnd.toISOString(),
          date: confirmTimes.confirmedStart.toISOString(),
          dateKey,
          slot,
          clinicMessage: null,
          declineReason: null,
          clinicConfirmationTokenHash: null,
          tokenExpiresAt: null,
          updatedAt: now,
        },
      },
    );

    const patients = await getPatientsCollection();
    if (appointment.patientId) {
      const patientLookupId = ObjectId.isValid(appointment.patientId)
        ? new ObjectId(appointment.patientId)
        : appointment.patientId;
      const patient = await patients.findOne({ _id: patientLookupId });
      if (patient?.appointments) {
        const updatedAppointments = patient.appointments.map((summary) =>
          summary.appointmentId === appointmentId
            ? {
                ...summary,
                status: "CONFIRMED" as AppointmentStatus,
                confirmedStart: confirmTimes.confirmedStart.toISOString(),
                confirmedEnd: confirmTimes.confirmedEnd.toISOString(),
                date: confirmTimes.confirmedStart.toISOString(),
                slot,
                updatedAt: now,
              }
            : summary,
        );
        await patients.updateOne(
          { _id: patientLookupId },
          {
            $set: {
              appointments: updatedAppointments,
            },
          },
        );
      }
    }

    if (appointment.patientEmail) {
      const formattedDate = confirmTimes.confirmedStart.toLocaleString();
      try {
        await sendEmail({
          to: appointment.patientEmail,
          subject: "Your DocNearMe appointment is confirmed",
          text: [
            `Hi ${appointment.patientName ?? "there"},`,
            "",
            "Your appointment request has been confirmed by the clinic.",
            `Appointment ID: ${appointmentId}`,
            `Clinic: ${appointment.clinicId}`,
            `Confirmed date: ${formattedDate}`,
            `Confirmed time: ${slot}`,
            "",
            "Please arrive 10 minutes early and bring a photo ID and insurance card if applicable.",
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="margin-bottom: 12px;">Appointment confirmed</h2>
              <p>Hi ${appointment.patientName ?? "there"},</p>
              <p>Your appointment request has been confirmed by the clinic.</p>
              <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                <tbody>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 160px;">Appointment ID</td>
                    <td style="padding: 6px 0; font-weight: 600;">${appointmentId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Clinic</td>
                    <td style="padding: 6px 0; font-weight: 600;">${appointment.clinicId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Confirmed date</td>
                    <td style="padding: 6px 0; font-weight: 600;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Confirmed time</td>
                    <td style="padding: 6px 0; font-weight: 600;">${slot}</td>
                  </tr>
                </tbody>
              </table>
              <p>Please arrive 10 minutes early and bring a photo ID and insurance card if applicable.</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send appointment confirmation email", error);
      }
    }

    res.json({
      success: true,
      appointment: serializeAppointment({
        ...appointment,
        status: "CONFIRMED",
        confirmedStart: confirmTimes.confirmedStart.toISOString(),
        confirmedEnd: confirmTimes.confirmedEnd.toISOString(),
        date: confirmTimes.confirmedStart.toISOString(),
        dateKey,
        slot,
        clinicMessage: null,
        declineReason: null,
        clinicConfirmationTokenHash: null,
        tokenExpiresAt: null,
        updatedAt: now,
      }),
      message: "Appointment confirmed successfully",
    });
  } catch (error) {
    console.error("Appointment confirmation error", error);
    res.status(500).json({ error: "Failed to confirm appointment" });
  }
};

export const handleDeclineAppointment = async (req: Request, res: Response) => {
  const appointmentId = req.params.id;
  const payload = parseRequestBody(req.body);
  const token = resolveToken(req, payload);
  const declineReason = typeof payload.declineReason === "string" ? payload.declineReason : undefined;

  if (!token) {
    return res.status(401).json({ error: "Clinic confirmation token required." });
  }

  try {
    const appointments = await getAppointmentsCollection();
    const appointmentLookup = resolveAppointmentId(appointmentId);
    const appointment = await appointments.findOne({ _id: appointmentLookup });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (appointment.status !== "PENDING_CLINIC") {
      return res.status(409).json({ error: "Appointment is not awaiting confirmation." });
    }

    if (!appointment.clinicConfirmationTokenHash || !appointment.tokenExpiresAt) {
      return res.status(401).json({ error: "Invalid or expired confirmation token." });
    }

    if (appointment.tokenExpiresAt.getTime() < Date.now()) {
      return res.status(401).json({ error: "Confirmation token expired." });
    }

    if (hashToken(token) !== appointment.clinicConfirmationTokenHash) {
      return res.status(401).json({ error: "Invalid confirmation token." });
    }

    const now = new Date();
    await appointments.updateOne(
      { _id: appointmentLookup },
      {
        $set: {
          status: "DECLINED",
          declineReason,
          clinicMessage: null,
          clinicConfirmationTokenHash: null,
          tokenExpiresAt: null,
          updatedAt: now,
        },
      },
    );

    const patients = await getPatientsCollection();
    if (appointment.patientId) {
      const patientLookupId = ObjectId.isValid(appointment.patientId)
        ? new ObjectId(appointment.patientId)
        : appointment.patientId;
      const patient = await patients.findOne({ _id: patientLookupId });
      if (patient?.appointments) {
        const updatedAppointments = patient.appointments.map((summary) =>
          summary.appointmentId === appointmentId
            ? {
                ...summary,
                status: "DECLINED" as AppointmentStatus,
                updatedAt: now,
              }
            : summary,
        );
        await patients.updateOne(
          { _id: patientLookupId },
          {
            $set: {
              appointments: updatedAppointments,
            },
          },
        );
      }
    }

    if (appointment.patientEmail) {
      try {
        await sendEmail({
          to: appointment.patientEmail,
          subject: "Clinic could not confirm your appointment",
          text: [
            `Hi ${appointment.patientName ?? "there"},`,
            "",
            "The clinic was unable to confirm your requested time.",
            "Please choose another time and submit a new request.",
            declineReason ? "" : undefined,
            declineReason ? `Reason: ${declineReason}` : undefined,
          ]
            .filter(Boolean)
            .join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="margin-bottom: 12px;">Request declined</h2>
              <p>Hi ${appointment.patientName ?? "there"},</p>
              <p>The clinic was unable to confirm your requested time. Please choose another time and submit a new request.</p>
              ${declineReason ? `<p><strong>Reason:</strong> ${declineReason}</p>` : ""}
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send appointment decline email", error);
      }
    }

    res.json({
      success: true,
      appointment: serializeAppointment({
        ...appointment,
        status: "DECLINED",
        declineReason,
        clinicMessage: null,
        clinicConfirmationTokenHash: null,
        tokenExpiresAt: null,
        updatedAt: now,
      }),
      message: "Appointment request declined",
    });
  } catch (error) {
    console.error("Appointment decline error", error);
    res.status(500).json({ error: "Failed to decline appointment" });
  }
};
