export type UserRole = "patient" | "admin" | "clinic";

export interface User {
  _id?: unknown;
  email: string;
  name?: string;
  passwordHash: string;
  role: UserRole;
  clinicId?: string;
  createdAt: Date;
}

export interface Appointment {
  _id?: unknown;
  date: string;
  dateKey: string;
  slot: string;
  specialization: string;
  clinicId: string;
  notes?: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  createdAt: Date;
}

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
  clinicId?: string;
}
