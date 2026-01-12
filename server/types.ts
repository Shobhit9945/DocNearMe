export interface Appointment {
  _id?: unknown;
  date: string;
  dateKey: string;
  slot: string;
  specialization: string;
  clinicId: string;
  notes?: string;
  patientId?: string;
  patientName?: string;
  patientEmail?: string;
  createdAt: Date;
}

export interface User {
  _id?: unknown;
  email: string;
  passwordHash: string;
  role: "patient" | "clinic";
  fullName: string;
  createdAt: Date;
}
