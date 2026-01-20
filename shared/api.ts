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
  doctorName?: string;
  clinicId: string;
  notes?: string;
  patientId?: string;
  patientName?: string;
  patientEmail?: string;
  createdAt: string;
}

export interface AppointmentCreateRequest {
  date: string;
  slot: string;
  specialization: string;
  doctorName?: string;
  clinicId: string;
  notes?: string;
  patientName?: string;
  patientEmail?: string;
}

export interface AppointmentCreateResponse {
  success: boolean;
  id: string;
  message: string;
}

export interface AppointmentRescheduleRequest {
  date: string;
  slot: string;
  reason: string;
}

export interface AppointmentRescheduleResponse {
  success: boolean;
  appointment: AppointmentResponseItem;
  message: string;
}

export interface AppointmentCancelRequest {
  reason: string;
}

export interface AppointmentCancelResponse {
  success: boolean;
  message: string;
}

export interface AppointmentListResponse {
  appointments: AppointmentResponseItem[];
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface RequestOtpRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface OtpResponse {
  success: boolean;
  message: string;
  debugOtp?: string;
}

export interface RequestPasswordResetRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  password: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface MedicalRecordResponseItem {
  id: string;
  name: string;
  type: string;
  size: number;
  iv: string;
  data: string;
  createdAt: string;
}

export interface MedicalRecordListResponse {
  records: MedicalRecordResponseItem[];
}

export interface MedicalRecordUploadRequest {
  name: string;
  type: string;
  size: number;
  iv: string;
  data: string;
}

export interface MedicalRecordUploadResponse {
  success: boolean;
  record: MedicalRecordResponseItem;
}

export interface MedicalConsentStatusResponse {
  hasConsented: boolean;
  consentedAt?: string;
  consentVersion?: string;
}

export interface MedicalConsentRequest {
  consentVersion: string;
  consentText: string;
}

export interface MedicalConsentResponse {
  success: boolean;
  consentedAt: string;
  consentVersion: string;
}

export interface MedicalRecordDeleteResponse {
  success: boolean;
}
