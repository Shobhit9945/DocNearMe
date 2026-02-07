import Foundation

@MainActor
final class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var authToken: String? = nil
    @Published var profile: PatientProfile? = nil
    @Published var clinics: [ClinicProfile] = []
    @Published var appointments: [AppointmentResponseItem] = []
    @Published var medicalRecords: [MedicalRecordSummary] = []
    @Published var chatMessages: [DocDaisyMessage] = [
        DocDaisyMessage(sender: "bot", text: "Hi! I’m DocDaisy. How can I help you today?")
    ]
    @Published var isLoading = false
    @Published var errorMessage: String? = nil

    private let tokenKey = "DocNearMeAuthToken"
    private let tokenService = "DocNearMe"

    init() {
        if let token = KeychainHelper.loadToken(service: tokenService, account: tokenKey) {
            authToken = token
            isAuthenticated = true
            Task {
                await refreshAll()
            }
        }
    }

    func signIn(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: AuthResponse = try await APIClient.shared.request(
                "/api/auth/login",
                method: "POST",
                body: LoginRequest(email: email, password: password)
            )
            authToken = response.token
            isAuthenticated = true
            KeychainHelper.saveToken(response.token, service: tokenService, account: tokenKey)
            await refreshAll()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signUp(payload: SignupRequest) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: AuthResponse = try await APIClient.shared.request(
                "/api/auth/signup",
                method: "POST",
                body: payload
            )
            authToken = response.token
            isAuthenticated = true
            KeychainHelper.saveToken(response.token, service: tokenService, account: tokenKey)
            await refreshAll()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func requestPhoneOtp(phone: String) async -> PhoneOtpResponse? {
        do {
            return try await APIClient.shared.request(
                "/api/auth/request-phone-otp",
                method: "POST",
                body: RequestPhoneOtpRequest(phone: phone)
            )
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func verifyPhoneOtp(phone: String, otp: String) async -> PhoneOtpResponse? {
        do {
            return try await APIClient.shared.request(
                "/api/auth/verify-phone-otp",
                method: "POST",
                body: VerifyPhoneOtpRequest(phone: phone, otp: otp)
            )
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func signOut() {
        authToken = nil
        isAuthenticated = false
        profile = nil
        clinics = []
        appointments = []
        medicalRecords = []
        KeychainHelper.deleteToken(service: tokenService, account: tokenKey)
    }

    func refreshAll() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadProfile() }
            group.addTask { await self.loadClinics() }
            group.addTask { await self.loadAppointments() }
            group.addTask { await self.loadMedicalRecords() }
        }
    }

    func loadProfile() async {
        guard let token = authToken else { return }
        do {
            let response: PatientProfileResponse = try await APIClient.shared.request(
                "/api/profile",
                token: token
            )
            profile = response.profile
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateProfile(_ update: PatientProfileUpdateRequest) async {
        guard let token = authToken else { return }
        do {
            let response: PatientProfileResponse = try await APIClient.shared.request(
                "/api/profile",
                method: "PUT",
                token: token,
                body: update
            )
            profile = response.profile
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadClinics() async {
        do {
            let response: ClinicListResponse = try await APIClient.shared.request("/api/clinics")
            clinics = response.clinics
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadAppointments() async {
        guard let token = authToken else { return }
        do {
            let response: AppointmentListResponse = try await APIClient.shared.request(
                "/api/appointments/me",
                token: token
            )
            appointments = response.appointments
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadMedicalRecords() async {
        guard let token = authToken else { return }
        do {
            let response: MedicalRecordListResponse = try await APIClient.shared.request(
                "/api/medical-records",
                token: token
            )
            medicalRecords = response.records
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createAppointment(_ payload: AppointmentCreateRequest) async -> Bool {
        guard let token = authToken else { return false }
        do {
            let _: AppointmentCreateResponse = try await APIClient.shared.request(
                "/api/appointments/request",
                method: "POST",
                token: token,
                body: payload
            )
            await loadAppointments()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func fetchAvailability(dateKey: String, clinicId: String) async -> AvailabilityResponse? {
        do {
            let response: AvailabilityResponse = try await APIClient.shared.request(
                "/api/availability?date=\(dateKey)&clinicId=\(clinicId)"
            )
            return response
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func sendDocDaisyMessage(_ message: String) async {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        chatMessages.append(DocDaisyMessage(sender: "user", text: trimmed))
        do {
            let response: DocDaisyResponse = try await APIClient.shared.request(
                "/api/docdaisy/respond",
                method: "POST",
                body: ["messages": chatMessages]
            )
            chatMessages.append(DocDaisyMessage(sender: "bot", text: response.reply))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func uploadMedicalRecord(_ payload: MedicalRecordUploadRequest) async -> Bool {
        guard let token = authToken else { return false }
        do {
            let _: MedicalRecordDetailResponse = try await APIClient.shared.request(
                "/api/medical-records",
                method: "POST",
                token: token,
                body: payload
            )
            await loadMedicalRecords()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func fetchMedicalRecordDetail(id: String) async -> MedicalRecordDetail? {
        guard let token = authToken else { return nil }
        do {
            let response: MedicalRecordDetailResponse = try await APIClient.shared.request(
                "/api/medical-records/\(id)",
                token: token
            )
            return response.record
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }
}
