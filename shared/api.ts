/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

export type UserRole = "patient" | "admin" | "clinic";

export interface DemoResponse {
  message: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  clinicId?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthenticatedUser;
}

export interface AppointmentResponseItem {
  _id: string;
  date: string;
  dateKey: string;
  slot: string;
  specialization: string;
  clinicId: string;
  notes?: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  createdAt: string;
}

export interface AppointmentListResponse {
  appointments: AppointmentResponseItem[];
}
