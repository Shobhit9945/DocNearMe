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
  createdAt: Date;
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

export interface ClinicReview {
  _id?: unknown;
  clinicId: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt?: Date;
}
