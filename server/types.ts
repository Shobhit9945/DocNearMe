export interface Appointment {
  _id?: unknown;
  date: string;
  dateKey: string;
  slot: string;
  specialization: string;
  doctorName?: string;
  clinicId: string;
  notes?: string;
  patientId?: string;
  patientName?: string;
  patientEmail?: string;
  sharedRecord?: SharedMedicalRecord;
  createdAt: Date;
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
  specialization: string;
  doctorName?: string;
  clinicId: string;
  createdAt: Date;
}

export interface PatientUser {
  _id?: unknown;
  name: string;
  email: string;
  passwordHash: string;
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
