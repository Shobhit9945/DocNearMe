import Foundation

struct AuthResponse: Codable {
    let token: String
    let user: AuthUser
}

struct AuthUser: Codable {
    let id: String
    let name: String
    let email: String
    let createdAt: String
}

struct ClinicListResponse: Codable {
    let clinics: [ClinicProfile]
}

struct ClinicProfileResponse: Codable {
    let clinic: ClinicProfile
}

struct ClinicDoctorsResponse: Codable {
    let doctors: [ClinicDoctor]
}

struct ClinicProfile: Codable, Identifiable, Hashable {
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

struct ClinicDoctor: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let clinicId: String
    let specialization: String
    let languages: [String]
    let rating: Double
    let nextAvailable: String
}

struct AppointmentListResponse: Codable {
    let appointments: [AppointmentResponseItem]
}

struct AppointmentResponseItem: Codable, Identifiable, Hashable {
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
    let patientName: String?
    let patientPhone: String?
    let patientEmail: String?
    let createdAt: String
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case date, dateKey, slot, preferredStart, preferredEnd, confirmedStart, confirmedEnd
        case status, declineReason, clinicMessage, specialization, doctorName, clinicId
        case serviceId, notes, patientName, patientPhone, patientEmail, createdAt, updatedAt
    }
}

struct AppointmentCreateRequest: Codable {
    let clinicId: String
    let preferredStart: String
    let preferredEnd: String
    let patientName: String
    let patientPhone: String
    let patientEmail: String
    let note: String?
    let specialization: String?
    let doctorName: String?
    let slot: String?
}

struct AppointmentCreateResponse: Codable {
    let success: Bool
    let id: String
    let appointment: AppointmentResponseItem
    let message: String
}

struct AvailabilityResponse: Codable {
    let date: String
    let clinicId: String
    let slots: [String]
    let isClosed: Bool
    let reason: String?
}

struct PatientProfileResponse: Codable {
    let profile: PatientProfile
}

struct PatientProfile: Codable, Hashable {
    let name: String
    let email: String
    let phone: String?
    let address: String?
    let visaType: String?
    let emergencyContact: String?
    let preferredLanguage: String?
    let notificationsEnabled: Bool?
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

struct MedicalRecordListResponse: Codable {
    let records: [MedicalRecordSummary]
}

struct MedicalRecordSummary: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let type: String
    let size: Int
    let createdAt: String
}

struct MedicalRecordDetailResponse: Codable {
    let record: MedicalRecordDetail
}

struct MedicalRecordDetail: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let type: String
    let size: Int
    let createdAt: String
    let iv: String
    let data: String
}

struct MedicalRecordUploadRequest: Codable {
    let name: String
    let type: String
    let size: Int
    let iv: String
    let data: String
}

struct MedicalConsentResponse: Codable {
    let hasConsented: Bool
    let consentedAt: String?
    let consentVersion: String
}

struct MedicalConsentRequest: Codable {
    let consentText: String
    let consentVersion: String
}

struct DocDaisyMessage: Codable, Hashable {
    let sender: String
    let text: String
}

struct DocDaisyResponse: Codable {
    let reply: String
    let specialization: String?
    let relevant: Bool?
    let mode: String?
}

struct LoginRequest: Codable {
    let email: String
    let password: String
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
    let consentAccepted: Bool
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
    let phoneProofToken: String?
    let debugOtp: String?
}
