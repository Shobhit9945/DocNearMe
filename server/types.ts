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
  verifiedAt?: Date;
  usedAt?: Date;
}
