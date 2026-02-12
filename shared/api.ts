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
  | "RESCHEDULE_REQUESTED"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED_BY_PATIENT"
  | "CANCELLED_BY_CLINIC"
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
  clinicMessage?: string;
  specialization: string;
  doctorName?: string;
  clinicId: string;
  serviceId?: string;
  notes?: string;
  notesTranslated?: string;
  patientId?: string;
  patientName?: string;
  patientNameTranslated?: string;
  doctorNameTranslated?: string;
  specializationTranslated?: string;
  patientPhone?: string;
  patientEmail?: string;
  patientVisaType?: VisaType;
  createdAt: string;
  updatedAt?: string;
}

export type IntakeQuestionType =
  | "short-text"
  | "long-text"
  | "single-choice"
  | "multiple-choice"
  | "number"
  | "date"
  | "boolean"
  | "file";

export type IntakeDataType = "string" | "number" | "date" | "boolean" | "email" | "phone" | "file";

export type IntakeDeliveryTiming = "booking" | "reminder" | "checkin";

export type IntakeAnswerValue = string | string[] | number | boolean | null;

export interface IntakeQuestion {
  id: string;
  label: string;
  description?: string;
  questionType: IntakeQuestionType;
  dataType: IntakeDataType;
  required: boolean;
  options: string[];
}

export interface IntakeFormConfig {
  clinicId: string;
  isRequired: boolean;
  deliveryTiming: IntakeDeliveryTiming;
  questions: IntakeQuestion[];
  updatedAt?: string;
}

export interface IntakeFormAnswer {
  questionId: string;
  label: string;
  questionType: IntakeQuestionType;
  dataType: IntakeDataType;
  value: IntakeAnswerValue;
  labelTranslated?: string;
  valueTranslated?: IntakeAnswerValue;
}

export interface IntakeFormResponsePayload {
  responses: IntakeFormAnswer[];
  submittedAt?: string;
}

export interface ClinicIntakeFormResponse {
  form: IntakeFormConfig | null;
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
  intakeResponse?: IntakeFormResponsePayload;
}

export interface AppointmentCreateResponse {
  success: boolean;
  id: string;
  appointment: AppointmentResponseItem;
  message: string;
  phoneCallQueued?: boolean;
  phoneCallReason?: string;
}

export interface AppointmentConfirmRequest {
  clinicConfirmationToken: string;
  confirmedStart?: string;
  confirmedEnd?: string;
}

export interface AppointmentConfirmResponse {
  success: boolean;
  appointment: AppointmentResponseItem;
  patientDetails?: ClinicPatientDetailsResponse["patient"];
  intakeResponse?: IntakeFormResponsePayload;
  sharedRecord?: SharedMedicalRecord;
  message: string;
}

export interface AppointmentDeclineRequest {
  clinicConfirmationToken: string;
  declineReason?: string;
}

export interface AppointmentDeclineResponse {
  success: boolean;
  appointment: AppointmentResponseItem;
  patientDetails?: ClinicPatientDetailsResponse["patient"];
  intakeResponse?: IntakeFormResponsePayload;
  sharedRecord?: SharedMedicalRecord;
  message: string;
}

export interface AppointmentRescheduleMessageRequest {
  message: string;
}

export interface AppointmentRescheduleMessageResponse {
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

export interface ClinicPatientDetailsResponse {
  patient: {
    name: string;
    nameTranslated?: string;
    age?: number;
    country?: string;
    countryTranslated?: string;
    visaType?: VisaType;
    visaTypeTranslated?: string;
  };
  sharedRecord?: SharedMedicalRecord;
  intakeResponse?: IntakeFormResponsePayload;
}

export interface SharedMedicalRecord {
  recordId: string;
  name: string;
  type: string;
  size: number;
  iv: string;
  data?: string;
}

export type VaultAead = "aes-256-gcm";

export type VaultKdfParams =
  | {
      algo: "argon2id";
      opslimit: number;
      memlimit: number;
      keyLen: number;
    }
  | {
      algo: "scrypt";
      N: number;
      r: number;
      p: number;
      keyLen: number;
    }
  | {
      algo: "pbkdf2";
      iterations: number;
      keyLen: number;
      hash: "SHA-256";
    };

export interface VaultKeyPayload {
  dekWrappedByPassword: string;
  dekWrappedByRecovery: string;
  kdfSaltPassword: string;
  kdfSaltRecovery: string;
  kdfParams: VaultKdfParams;
  aead: VaultAead;
  wrapIvPassword: string;
  wrapIvRecovery: string;
}

export interface VaultKeyGetResponse {
  hasKey: boolean;
  key?: VaultKeyPayload;
}

export interface VaultKeyCreateRequest extends VaultKeyPayload {}

export interface VaultKeyPasswordUpdateRequest {
  dekWrappedByPassword: string;
  kdfSaltPassword: string;
  kdfParams: VaultKdfParams;
  aead: VaultAead;
  wrapIvPassword: string;
}

export interface VaultKeyUpsertResponse {
  success: boolean;
  updatedAt: string;
}

export interface VaultDocSummary {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
}

export interface VaultDocDetail extends VaultDocSummary {
  iv: string;
  ciphertext: string;
  aad?: string;
}

export interface VaultDocListResponse {
  docs: VaultDocSummary[];
}

export interface VaultDocFetchResponse {
  doc: VaultDocDetail;
}

export interface VaultDocCreateRequest {
  id?: string;
  name: string;
  type: string;
  size: number;
  iv: string;
  ciphertext: string;
  aad?: string;
}

export interface VaultDocCreateResponse {
  success: boolean;
  doc: VaultDocSummary;
}

export interface VaultDocRenameResponse {
  success: boolean;
  doc: VaultDocSummary;
}

export interface VaultDocDeleteResponse {
  success: boolean;
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
  visaType: VisaType;
  phone: string;
  phoneProofToken: string;
  photo?: SignupPhotoPayload | null;
  consentAccepted: boolean;
}

export type VisaType =
  | "tourist"
  | "resident-work"
  | "resident-student"
  | "resident-family"
  | "resident-permanent"
  | "resident-long-term"
  | "resident-other"
  | "japanese-national";

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

export interface PatientProfile {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  visaType?: VisaType;
  emergencyContact?: string;
  preferredLanguage?: string;
  notificationsEnabled?: boolean;
}

export interface PatientProfileResponse {
  profile: PatientProfile;
}

export interface PatientProfileUpdateRequest {
  name?: string;
  email?: string;
  phone?: string;
  emailProofToken?: string;
  phoneProofToken?: string;
  address?: string;
  visaType?: VisaType;
  emergencyContact?: string;
  preferredLanguage?: string;
  notificationsEnabled?: boolean;
}

export interface ProfileEmailChangeRequest {
  email: string;
}

export interface ProfileEmailChangeVerifyRequest {
  email: string;
  otp: string;
}

export interface ProfileEmailChangeVerifyResponse extends OtpResponse {
  emailProofToken?: string;
}

export interface ProfilePhoneChangeRequest {
  phone: string;
}

export interface ProfilePhoneChangeVerifyRequest {
  phone: string;
  otp: string;
}

export interface ProfilePhoneChangeVerifyResponse extends OtpResponse {
  phoneProofToken?: string;
}

export interface RequestOtpRequest {
  email: string;
  captchaProofToken?: string;
}

export interface CheckEmailRequest {
  email: string;
  captchaToken: string;
}

export interface CheckEmailResponse {
  exists: boolean;
  message: string;
  captchaProofToken?: string;
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

export interface RequestPhoneOtpRequest {
  phone: string;
}

export interface VerifyPhoneOtpRequest {
  phone: string;
  otp: string;
}

export interface PhoneOtpResponse extends OtpResponse {
  phoneProofToken?: string;
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

export interface ClinicDailyHours {
  start: string;
  end: string;
}

export interface ClinicHours {
  weekdays: ClinicDailyHours;
  weekend: ClinicDailyHours;
  closedDays: string[];
  slotMinutes?: number;
}

export interface ClinicBookingClosure {
  id?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  createdAt?: string;
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

export interface ClinicDoctorAvailabilitySlot {
  days: string[];
  startTime: string;
  endTime: string;
}

export interface ClinicDoctor {
  id: string;
  name: string;
  clinicId: string;
  specialization: string;
  languages: string[];
  rating: number;
  nextAvailable: string;
  availability?: ClinicDoctorAvailabilitySlot[];
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
  immediateWoundCare: boolean;
  googlePlaceId?: string;
  phone?: string;
  email?: string;
  notificationEmailEnabled?: boolean;
  notificationPhoneEnabled?: boolean;
  notificationLineEnabled?: boolean;
  notification_email_enabled?: boolean;
  notification_phone_enabled?: boolean;
  notification_line_enabled?: boolean;
  hours?: ClinicHours;
  bookingClosures?: ClinicBookingClosure[];
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
  email?: string;
  googlePlaceId?: string;
  image?: string;
  nextAvailability?: string;
  immediateWoundCare?: boolean;
  hours?: ClinicHours;
  bookingClosures?: ClinicBookingClosure[];
  pricing?: ClinicPricing;
  photos?: ClinicPhoto[];
  notificationEmailEnabled?: boolean;
  notificationPhoneEnabled?: boolean;
  notificationLineEnabled?: boolean;
  notification_email_enabled?: boolean;
  notification_phone_enabled?: boolean;
  notification_line_enabled?: boolean;
}

export interface ClinicDoctorsUpdateRequest {
  doctors: ClinicDoctor[];
}

export interface TranslateRequest {
  text: string;
  targetLanguage: "en" | "ja" | "ko" | "id" | "my" | "bn" | "ar" | "hi" | "th" | "fil" | "zh" | "es" | "vi";
  sourceLanguage?:
    | "auto"
    | "en"
    | "ja"
    | "ko"
    | "id"
    | "my"
    | "bn"
    | "ar"
    | "hi"
    | "th"
    | "fil"
    | "zh"
    | "es"
    | "vi";
}

export interface TranslateResponse {
  translation: string;
}

export interface AdminAuthCheckResponse {
  ok: boolean;
}

export interface AdminCreateClinicRequest {
  clinic: ClinicProfile;
  doctors?: ClinicDoctor[];
  adminUserId?: string;
  adminPassword?: string;
}

export interface AdminCreateClinicResponse {
  clinicId: string;
  clinicName: string;
  adminUserId: string;
  adminPassword: string;
}

export type AuditActorRole = "patient" | "clinic" | "admin" | "system";

export type AuditEventSource = "api" | "voice" | "system";

export type AuditAction =
  | "patient_account_created"
  | "clinic_account_created"
  | "appointment_booked"
  | "appointment_confirmed"
  | "appointment_declined"
  | "appointment_cancelled_by_patient"
  | "appointment_cancelled_by_clinic"
  | "appointment_reschedule_requested"
  | "appointment_completed"
  | "appointment_deleted_by_clinic"
  | "admin_change";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actorRole: AuditActorRole;
  actorId?: string;
  actorLabel?: string;
  clinicId?: string;
  patientId?: string;
  appointmentId?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  source?: AuditEventSource;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AdminAuditLogsResponse {
  logs: AuditLogEntry[];
  limit: number;
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
  appointmentId?: string;
  patientId?: string;
  author: string;
  overallRating: number;
  ratings: ClinicReviewRatings;
  comment?: string;
  isPublic?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ClinicReviewRatings {
  englishCommunication: number;
  explainedTreatmentClearly: number;
  foreignPatientFriendlyStaff: number;
  cashlessPaymentAvailable: number;
  waitTimeReasonable: number;
}

export interface ClinicReviewListResponse {
  reviews: ClinicReview[];
  averageRating: number;
}

export interface ClinicReviewCreateRequest {
  author: string;
  appointmentId: string;
  overallRating: number;
  ratings: ClinicReviewRatings;
  comment?: string;
  isPublic?: boolean;
}

export interface ClinicReviewCreateResponse {
  success: boolean;
  review: ClinicReview;
}

export interface ClinicReviewUpdateRequest {
  author: string;
  overallRating: number;
  ratings: ClinicReviewRatings;
  comment?: string;
  isPublic?: boolean;
}

export interface ClinicReviewUpdateResponse {
  success: boolean;
  review: ClinicReview;
}

export interface ClinicReviewDeleteResponse {
  success: boolean;
}
