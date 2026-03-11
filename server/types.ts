import type { ObjectId } from "mongodb";
import type { AuditAction, AuditActorRole, AuditEventSource } from "@shared/api";

export type AppointmentStatus =
  | "PENDING_CLINIC"
  | "RESCHEDULE_REQUESTED"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED_BY_PATIENT"
  | "CANCELLED_BY_CLINIC"
  | "NO_SHOW"
  | "COMPLETED";

export interface Appointment {
  _id?: unknown;
  date: string;
  dateKey: string;
  slot: string;
  preferredStart: string;
  preferredEnd: string;
  confirmedStart?: string;
  confirmedEnd?: string;
  status: AppointmentStatus;
  clinicConfirmationTokenHash?: string;
  tokenExpiresAt?: Date;
  declineReason?: string;
  clinicMessage?: string;
  specialization: string;
  doctorName?: string;
  clinicId: string;
  serviceId?: string;
  notes?: string;
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  patientVisaType?: string;
  sharedRecord?: SharedMedicalRecord;
  notificationSentAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export type IntakeQuestionType =
  | "short-text"
  | "long-text"
  | "single-choice"
  | "multiple-choice"
  | "number"
  | "date"
  | "boolean"
  | "file";

export type IntakeDataType = "string" | "number" | "date" | "boolean" | "email" | "phone" | "file";

export type IntakeDeliveryTiming = "booking" | "reminder" | "checkin";

export type IntakeAnswerValue = string | string[] | number | boolean | null;

export interface IntakeQuestion {
  id: string;
  label: string;
  description?: string;
  questionType: IntakeQuestionType;
  dataType: IntakeDataType;
  required: boolean;
  options: string[];
}

export interface ClinicIntakeForm {
  _id?: unknown;
  clinicId: string;
  isRequired: boolean;
  deliveryTiming: IntakeDeliveryTiming;
  questions: IntakeQuestion[];
  updatedAt?: Date;
}

export interface IntakeFormAnswer {
  questionId: string;
  label: string;
  questionType: IntakeQuestionType;
  dataType: IntakeDataType;
  value: IntakeAnswerValue;
}

export interface IntakeFormResponse {
  _id?: unknown;
  appointmentId: string;
  clinicId: string;
  patientId?: string;
  responses: IntakeFormAnswer[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface SharedMedicalRecord {
  recordId: string;
  name: string;
  type: string;
  size: number;
  iv: string;
  data: string;
}

export interface PatientAppointmentSummary {
  appointmentId: string;
  date: string;
  slot: string;
  preferredStart: string;
  preferredEnd: string;
  confirmedStart?: string;
  confirmedEnd?: string;
  status: AppointmentStatus;
  specialization: string;
  doctorName?: string;
  clinicId: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PatientUser {
  _id?: unknown;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  nationality?: string;
  visaType?: string;
  emergencyContact?: string;
  preferredLanguage?: string;
  notificationsEnabled?: boolean;
  photo?: {
    dataUrl: string;
    fileName: string;
    fileType: string;
    size: number;
  } | null;
  appointments?: PatientAppointmentSummary[];
  createdAt: Date;
}

export interface EmailOtp {
  _id?: unknown;
  email: string;
  otpHash: string;
  createdAt: Date;
  expiresAt: Date;
  purpose?: "signup" | "password_reset" | "profile_email_change";
  verifiedAt?: Date;
  usedAt?: Date;
  attempts?: number;
}

export interface AuditLog {
  _id?: unknown;
  action: AuditAction;
  actorRole: AuditActorRole;
  actorId?: string;
  actorLabel?: string;
  clinicId?: string;
  patientId?: string;
  appointmentId?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  source?: AuditEventSource;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface MedicalRecord {
  _id?: unknown;
  patientId: string;
  name: string;
  type: string;
  size: number;
  iv: string;
  data: string;
  createdAt: Date;
}

export interface MedicalConsent {
  _id?: unknown;
  patientId: string;
  consentVersion: string;
  consentText: string;
  consentedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface MedicalRecordKey {
  _id?: unknown;
  patientId: string;
  wrappedKey: string;
  salt: string;
  iv: string;
  iterations: number;
  kdf: "PBKDF2";
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultKeyRecord {
  _id?: ObjectId;
  userId: string;
  dekWrappedByPassword: string;
  dekWrappedByRecovery: string;
  kdfSaltPassword: string;
  kdfSaltRecovery: string;
  kdfParams:
    | {
        algo: "argon2id";
        opslimit: number;
        memlimit: number;
        keyLen: number;
      }
    | {
        algo: "scrypt";
        N: number;
        r: number;
        p: number;
        keyLen: number;
      }
    | {
        algo: "pbkdf2";
        iterations: number;
        keyLen: number;
        hash: "SHA-256";
      };
  aead: "aes-256-gcm";
  wrapIvPassword: string;
  wrapIvRecovery: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultDocument {
  _id?: ObjectId | string;
  userId: string;
  docId: string;
  name: string;
  type: string;
  size: number;
  iv: string;
  ciphertext: string;
  aad?: string;
  createdAt: Date;
}

export interface ClinicReview {
  _id?: unknown;
  clinicId: string;
  appointmentId?: string;
  patientId?: string;
  author: string;
  overallRating: number;
  ratings: {
    englishCommunication: number;
    explainedTreatmentClearly: number;
    foreignPatientFriendlyStaff: number;
    cashlessPaymentAvailable: number;
    waitTimeReasonable: number;
  };
  comment?: string;
  isPublic?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ClinicAccount {
  _id?: unknown;
  clinicId: string;
  userId: string;
  passwordHash: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface ClinicInfo {
  _id?: unknown;
  clinicId: string;
  name: string;
  type: "Hospital" | "Clinic";
  rating: number;
  patients: string;
  distance: string;
  location: string;
  image: string;
  description?: string;
  immediateWoundCare?: boolean;
  bookingEnabled?: boolean;
  specializations: string[];
  nextAvailability: string;
  googlePlaceId?: string;
  phone?: string;
  email?: string;
  notificationEmailEnabled?: boolean;
  notificationPhoneEnabled?: boolean;
  notificationLineEnabled?: boolean;
  notification_email_enabled?: boolean;
  notification_phone_enabled?: boolean;
  notification_line_enabled?: boolean;
  hours?: {
    weekdays: {
      start: string;
      end: string;
    };
    weekend: {
      start: string;
      end: string;
    };
    closedDays: string[];
    slotMinutes?: number;
  };
  bookingClosures?: {
    id?: string;
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
    createdAt?: Date;
  }[];
  pricing?: {
    firstVisit: string;
    followUp: string;
    otherServices: string;
  };
  photos?: {
    label: string;
    url: string;
  }[];
  customLabelIds?: string[];
  updatedAt?: Date;
}

export interface CustomLabel {
  _id?: unknown;
  labelId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ClinicDoctorRecord {
  _id?: unknown;
  clinicId: string;
  doctorId: string;
  name: string;
  specialization: string;
  languages: string[];
  rating: number;
  nextAvailable: string;
  availability?: {
    days: string[];
    startTime: string;
    endTime: string;
  }[];
  updatedAt?: Date;
}
