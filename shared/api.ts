/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

export interface DemoResponse {
  message: string;
}

export type AppointmentStatus =
  | "PENDING_CLINIC"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED_BY_PATIENT"
  | "NO_SHOW"
  | "COMPLETED";

export interface AppointmentResponseItem {
  _id: string;
  date: string;
  dateKey: string;
  slot: string;
  preferredStart: string;
  preferredEnd: string;
  confirmedStart?: string;
  confirmedEnd?: string;
  status: AppointmentStatus;
  declineReason?: string;
  specialization: string;
  doctorName?: string;
  clinicId: string;
  serviceId?: string;
  notes?: string;
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AppointmentCreateRequest {
  clinicId: string;
  preferredStart: string;
  preferredEnd: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  note?: string;
  serviceId?: string;
  specialization?: string;
  doctorName?: string;
  slot?: string;
  sharedRecord?: SharedMedicalRecord;
}

export interface AppointmentCreateResponse {
  success: boolean;
  id: string;
  appointment: AppointmentResponseItem;
  message: string;
}

export interface AppointmentConfirmRequest {
  clinicConfirmationToken: string;
  confirmedStart?: string;
  confirmedEnd?: string;
}

export interface AppointmentConfirmResponse {
  success: boolean;
  appointment: AppointmentResponseItem;
  message: string;
}

export interface AppointmentDeclineRequest {
  clinicConfirmationToken: string;
  declineReason?: string;
}

export interface AppointmentDeclineResponse {
  success: boolean;
  appointment: AppointmentResponseItem;
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

export interface SharedMedicalRecord {
  recordId: string;
  name: string;
  type: string;
  size: number;
  iv: string;
  data: string;
}

export interface SignupPhotoPayload {
  dataUrl: string;
  fileName: string;
  fileType: string;
  size: number;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  dateOfBirth: string;
  nationality: string;
  residentStatus: string;
  photo?: SignupPhotoPayload | null;
  consentAccepted: boolean;
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

export interface CheckEmailRequest {
  email: string;
}

export interface CheckEmailResponse {
  exists: boolean;
  message: string;
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

export interface MedicalRecordSummary {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
}

export interface MedicalRecordDetail extends MedicalRecordSummary {
  iv: string;
  data: string;
}

export interface MedicalRecordListResponse {
  records: MedicalRecordSummary[];
}

export interface MedicalRecordFetchResponse {
  record: MedicalRecordDetail;
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
  record: MedicalRecordDetail;
}

export interface MedicalRecordRenameRequest {
  name: string;
}

export interface MedicalRecordRenameResponse {
  success: boolean;
  record: MedicalRecordSummary;
}

export interface MedicalConsentStatusResponse {
  hasConsented: boolean;
  consentedAt?: string;
  consentVersion?: string;
}

export interface ClinicHours {
  weekdays: string;
  weekend: string;
  closedDays: string;
}

export interface ClinicPricing {
  firstVisit: string;
  followUp: string;
  otherServices: string;
}

export interface ClinicPhoto {
  label: string;
  url: string;
}

export interface ClinicDoctor {
  id: string;
  name: string;
  clinicId: string;
  specialization: string;
  languages: string[];
  rating: number;
  nextAvailable: string;
  availability?: string;
}

export interface ClinicProfile {
  id: string;
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
  hours?: ClinicHours;
  pricing?: ClinicPricing;
  photos?: ClinicPhoto[];
  doctors?: ClinicDoctor[];
}

export interface ClinicListResponse {
  clinics: ClinicProfile[];
}

export interface ClinicProfileResponse {
  clinic: ClinicProfile;
}

export interface ClinicDoctorsResponse {
  doctors: ClinicDoctor[];
}

export interface ClinicLoginRequest {
  userId: string;
  password: string;
}

export interface ClinicLoginResponse {
  token: string;
  clinicId: string;
}

export interface ClinicCredentials {
  clinicId: string;
  clinicName: string;
  userId: string;
  password: string;
}

export interface ClinicCredentialsResponse {
  credentials: ClinicCredentials[];
}

export interface ClinicProfileUpdateRequest {
  name?: string;
  location?: string;
  phone?: string;
  image?: string;
  specializations?: string[];
  nextAvailability?: string;
  hours?: ClinicHours;
  pricing?: ClinicPricing;
  photos?: ClinicPhoto[];
}

export interface ClinicDoctorsUpdateRequest {
  doctors: ClinicDoctor[];
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

export interface MedicalRecordKeyPayload {
  wrappedKey: string;
  salt: string;
  iv: string;
  iterations: number;
  kdf: "PBKDF2";
}

export interface MedicalRecordKeyResponse {
  hasKey: boolean;
  key?: MedicalRecordKeyPayload;
}

export type MedicalRecordKeyUpsertRequest = MedicalRecordKeyPayload;

export interface MedicalRecordKeyUpsertResponse {
  success: boolean;
  updatedAt: string;
}

export interface ClinicReview {
  id: string;
  clinicId: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClinicReviewListResponse {
  reviews: ClinicReview[];
  averageRating: number;
}

export interface ClinicReviewCreateRequest {
  author: string;
  rating: number;
  comment: string;
}

export interface ClinicReviewCreateResponse {
  success: boolean;
  review: ClinicReview;
}

export interface ClinicReviewUpdateRequest {
  author: string;
  rating: number;
  comment: string;
}

export interface ClinicReviewUpdateResponse {
  success: boolean;
  review: ClinicReview;
}

export interface ClinicReviewDeleteResponse {
  success: boolean;
}
