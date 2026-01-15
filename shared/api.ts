/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

export interface DemoResponse {
  message: string;
}

export interface AppointmentResponseItem {
  _id: string;
  date: string;
  dateKey: string;
  slot: string;
  specialization: string;
  clinicId: string;
  notes?: string;
  patientId?: string;
  patientName?: string;
  patientEmail?: string;
  createdAt: string;
}

export interface AppointmentListResponse {
  appointments: AppointmentResponseItem[];
}
