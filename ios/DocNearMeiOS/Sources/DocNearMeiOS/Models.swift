import Foundation

struct AuthUser: Codable {
    let id: String
    let name: String
    let email: String
    let createdAt: String
}

struct AuthResponse: Codable {
    let token: String
    let user: AuthUser
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct SignupPhotoPayload: Codable {
    let dataUrl: String
    let fileName: String
    let fileType: String
    let size: Int
}

struct SignupRequest: Codable {
    let name: String
    let email: String
    let password: String
    let dateOfBirth: String
    let nationality: String
    let visaType: String
    let phone: String
    let phoneProofToken: String
    let photo: SignupPhotoPayload?
    let consentAccepted: Bool
}

struct CheckEmailRequest: Codable {
    let email: String
    let captchaToken: String
}

struct CheckEmailResponse: Codable {
    let exists: Bool
    let message: String
    let captchaProofToken: String?
}

struct RequestOtpRequest: Codable {
    let email: String
    let captchaProofToken: String?
}

struct VerifyOtpRequest: Codable {
    let email: String
    let otp: String
}

struct OtpResponse: Codable {
    let success: Bool
    let message: String
    let debugOtp: String?
}

struct RequestPhoneOtpRequest: Codable {
    let phone: String
}

struct VerifyPhoneOtpRequest: Codable {
    let phone: String
    let otp: String
}

struct PhoneOtpResponse: Codable {
    let success: Bool
    let message: String
    let debugOtp: String?
    let phoneProofToken: String?
}

struct RequestPasswordResetRequest: Codable {
    let email: String
}

struct ResetPasswordRequest: Codable {
    let email: String
    let otp: String
    let password: String
}

struct ResetPasswordResponse: Codable {
    let success: Bool
    let message: String
}

struct PatientProfile: Codable {
    let name: String
    let email: String
    let phone: String?
    let address: String?
    let visaType: String?
    let emergencyContact: String?
    let preferredLanguage: String?
    let notificationsEnabled: Bool?
}

struct PatientProfileResponse: Codable {
    let profile: PatientProfile
}

struct PatientProfileUpdateRequest: Codable {
    let name: String?
    let email: String?
    let phone: String?
    let address: String?
    let visaType: String?
    let emergencyContact: String?
    let preferredLanguage: String?
    let notificationsEnabled: Bool?
}

struct ClinicProfile: Codable, Identifiable {
    let id: String
    let name: String
    let type: String
    let rating: Double
    let patients: String
    let distance: String
    let location: String
    let image: String
    let specializations: [String]
    let nextAvailability: String
    let immediateWoundCare: Bool
    let googlePlaceId: String?
    let phone: String?
    let email: String?
}

struct ClinicListResponse: Codable {
    let clinics: [ClinicProfile]
}

struct ClinicProfileResponse: Codable {
    let clinic: ClinicProfile
}

struct ClinicDoctor: Codable, Identifiable {
    let id: String
    let name: String
    let clinicId: String
    let specialization: String
    let languages: [String]
    let rating: Double
    let nextAvailable: String
}

struct ClinicDoctorsResponse: Codable {
    let doctors: [ClinicDoctor]
}

struct ClinicReview: Codable, Identifiable {
    let id: String
    let clinicId: String
    let author: String
    let rating: Double
    let comment: String
    let createdAt: String
}

struct ClinicReviewListResponse: Codable {
    let reviews: [ClinicReview]
    let averageRating: Double
}

struct TranslateRequest: Encodable {
    let text: String
    let targetLanguage: String
    let sourceLanguage: String?
}

struct TranslateResponse: Decodable {
    let translation: String
}

struct VaultKdfParams: Codable {
    let algo: String
    let N: Int?
    let r: Int?
    let p: Int?
    let keyLen: Int?
    let iterations: Int?
    let hash: String?
    let opslimit: Int?
    let memlimit: Int?
}

struct VaultKeyPayload: Codable {
    let dekWrappedByPassword: String
    let dekWrappedByRecovery: String
    let kdfSaltPassword: String
    let kdfSaltRecovery: String
    let kdfParams: VaultKdfParams
    let aead: String
    let wrapIvPassword: String
    let wrapIvRecovery: String
}

struct VaultKeyGetResponse: Codable {
    let hasKey: Bool
    let key: VaultKeyPayload?
}

struct VaultKeyCreateRequest: Encodable {
    let dekWrappedByPassword: String
    let dekWrappedByRecovery: String
    let kdfSaltPassword: String
    let kdfSaltRecovery: String
    let kdfParams: VaultKdfParams
    let aead: String
    let wrapIvPassword: String
    let wrapIvRecovery: String
}

struct VaultKeyPasswordUpdateRequest: Encodable {
    let dekWrappedByPassword: String
    let kdfSaltPassword: String
    let kdfParams: VaultKdfParams
    let aead: String
    let wrapIvPassword: String
}

struct VaultKeyUpsertResponse: Codable {
    let success: Bool
    let updatedAt: String
}

struct VaultDocSummary: Codable, Identifiable {
    let id: String
    let name: String
    let type: String
    let size: Double
    let createdAt: String
}

struct VaultDocDetail: Codable, Identifiable {
    let id: String
    let name: String
    let type: String
    let size: Double
    let createdAt: String
    let iv: String
    let ciphertext: String
    let aad: String?
}

struct VaultDocListResponse: Codable {
    let docs: [VaultDocSummary]
}

struct VaultDocFetchResponse: Codable {
    let doc: VaultDocDetail
}

struct VaultDocCreateRequest: Encodable {
    let id: String
    let name: String
    let type: String
    let size: Double
    let iv: String
    let ciphertext: String
    let aad: String?
}

struct VaultDocCreateResponse: Codable {
    let success: Bool
    let doc: VaultDocSummary
}

struct VaultDocRenameResponse: Codable {
    let success: Bool
    let doc: VaultDocSummary
}

struct VaultDocDeleteResponse: Codable {
    let success: Bool
}

struct MedicalConsentStatusResponse: Codable {
    let hasConsented: Bool
    let consentedAt: String?
    let consentVersion: String?
}

struct MedicalConsentRequest: Encodable {
    let consentVersion: String
    let consentText: String
}

struct MedicalConsentResponse: Codable {
    let success: Bool
    let consentedAt: String
    let consentVersion: String
}

struct AppointmentResponseItem: Codable, Identifiable {
    let id: String
    let date: String
    let dateKey: String
    let slot: String
    let preferredStart: String
    let preferredEnd: String
    let confirmedStart: String?
    let confirmedEnd: String?
    let status: String
    let declineReason: String?
    let clinicMessage: String?
    let specialization: String
    let doctorName: String?
    let clinicId: String
    let serviceId: String?
    let notes: String?
    let notesTranslated: String?
    let patientId: String?
    let patientName: String?
    let patientNameTranslated: String?
    let patientPhone: String?
    let patientEmail: String?
    let patientVisaType: String?
    let createdAt: String
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case date
        case dateKey
        case slot
        case preferredStart
        case preferredEnd
        case confirmedStart
        case confirmedEnd
        case status
        case declineReason
        case clinicMessage
        case specialization
        case doctorName
        case clinicId
        case serviceId
        case notes
        case notesTranslated
        case patientId
        case patientName
        case patientNameTranslated
        case patientPhone
        case patientEmail
        case patientVisaType
        case createdAt
        case updatedAt
    }
}

struct AppointmentListResponse: Codable {
    let appointments: [AppointmentResponseItem]
}

struct AppointmentCreateRequest: Encodable {
    let clinicId: String
    let preferredStart: String
    let preferredEnd: String
    let patientName: String
    let patientPhone: String
    let patientEmail: String
    let note: String?
    let serviceId: String?
    let specialization: String?
    let doctorName: String?
    let slot: String?
    let sharedRecord: SharedMedicalRecord?
    let intakeResponse: IntakeFormResponsePayload?
}

struct AppointmentCreateResponse: Codable {
    let success: Bool
    let id: String
    let appointment: AppointmentResponseItem
    let message: String
    let phoneCallQueued: Bool?
    let phoneCallReason: String?
}

struct AppointmentCancelRequest: Encodable {
    let reason: String
}

struct AppointmentCancelResponse: Codable {
    let success: Bool
    let message: String
}

struct AppointmentRescheduleRequest: Encodable {
    let date: String
    let slot: String
    let reason: String
}

struct AppointmentRescheduleResponse: Codable {
    let success: Bool
    let appointment: AppointmentResponseItem
    let message: String
}

struct AvailabilityResponse: Codable {
    let date: String
    let clinicId: String
    let slots: [String]
    let isClosed: Bool?
    let reason: String?
}

struct IntakeFormConfig: Codable {
    let clinicId: String
    let isRequired: Bool
    let deliveryTiming: String
    let questions: [IntakeQuestion]
    let updatedAt: String?
}

struct IntakeQuestion: Codable, Identifiable {
    let id: String
    let label: String
    let description: String?
    let questionType: String
    let dataType: String
    let required: Bool
    let options: [String]
}

struct IntakeFormResponsePayload: Encodable {
    let responses: [IntakeFormAnswerPayload]
    let submittedAt: String?
}

struct IntakeFormAnswerPayload: Encodable {
    let questionId: String
    let label: String
    let questionType: String
    let dataType: String
    let value: IntakeAnswerValue
}

enum IntakeAnswerValue: Encodable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case stringArray([String])

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .stringArray(let value):
            try container.encode(value)
        }
    }
}

struct ClinicIntakeFormResponse: Codable {
    let form: IntakeFormConfig?
}

struct SharedMedicalRecord: Encodable {
    let recordId: String
    let name: String
    let type: String
    let size: Int
    let iv: String
    let data: String?
}
