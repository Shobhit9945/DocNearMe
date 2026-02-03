import type { ObjectId } from "mongodb";

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
  clinicNotificationSentAt?: Date;
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
  purpose?: "signup" | "password_reset";
  verifiedAt?: Date;
  usedAt?: Date;
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
  author: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ClinicAccount {
  _id?: unknown;
  clinicId: string;
  userId: string;
  passwordHash: string;
  tempPassword?: string;
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
  immediateWoundCare?: boolean;
  specializations: string[];
  nextAvailability: string;
  googlePlaceId?: string;
  phone?: string;
  email?: string;
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
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
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
