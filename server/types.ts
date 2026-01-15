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
