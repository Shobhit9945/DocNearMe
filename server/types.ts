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
  sharedRecord?: SharedMedicalRecord;
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
  dateOfBirth?: string;
  nationality?: string;
  residentStatus?: string;
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
  specializations: string[];
  nextAvailability: string;
  googlePlaceId?: string;
  phone?: string;
  hours?: {
    weekdays: string;
    weekend: string;
    closedDays: string;
  };
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
  availability?: string;
  updatedAt?: Date;
}
