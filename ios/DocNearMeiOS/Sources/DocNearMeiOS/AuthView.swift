import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import UIKit

@MainActor
struct AuthView: View {
    @EnvironmentObject private var appState: AppState

    @State private var selectedTab: AuthTab = .signIn

    @State private var loginEmail = ""
    @State private var loginPassword = ""
    @State private var loginError: String?
    @State private var isLoginLoading = false

    @State private var resetOpen = false
    @State private var resetEmail = ""
    @State private var resetOtp = ""
    @State private var resetPassword = ""
    @State private var resetMessage: String?
    @State private var resetMessageIsError = false
    @State private var resetOtpLoading = false
    @State private var resetOtpCooldown = 0
    @State private var resetOtpSent = false
    @State private var resetLoading = false
    @State private var resetCooldownTask: Task<Void, Never>?

    @State private var signupStep: SignupStep = .email
    @State private var signupEmail = ""
    @State private var captchaToken: String?
    @State private var captchaProofToken: String?
    @State private var recaptchaResetID = UUID()
    @State private var isCheckEmailLoading = false

    @State private var emailOtp = ""
    @State private var otpVerified = false
    @State private var otpSent = false
    @State private var otpCooldown = 0
    @State private var otpLoading = false
    @State private var otpCooldownTask: Task<Void, Never>?

    @State private var signupPhone = ""
    @State private var phoneOtp = ""
    @State private var phoneOtpVerified = false
    @State private var phoneOtpSent = false
    @State private var phoneOtpCooldown = 0
    @State private var phoneOtpLoading = false
    @State private var phoneOtpCooldownTask: Task<Void, Never>?
    @State private var phoneProofToken: String?

    @State private var signupName = ""
    @State private var signupDob = Date()
    @State private var signupNationality = ""
    @State private var signupVisaType = "tourist"
    @State private var signupPassword = ""
    @State private var consentAccepted = false
    @State private var signupStatus: String?
    @State private var signupStatusIsError = false
    @State private var isSignupLoading = false

    @State private var photoItem: PhotosPickerItem?
    @State private var photoPayload: SignupPhotoPayload?
    @State private var photoPreview: Image?

    private let visaOptions: [VisaOption] = [
        VisaOption(id: "tourist", label: "Tourist"),
        VisaOption(id: "resident-work", label: "Resident (Work)"),
        VisaOption(id: "resident-student", label: "Resident (Student)"),
        VisaOption(id: "resident-family", label: "Resident (Family)"),
        VisaOption(id: "resident-permanent", label: "Resident (Permanent)"),
        VisaOption(id: "resident-long-term", label: "Resident (Long-term)"),
        VisaOption(id: "resident-other", label: "Resident (Other)"),
        VisaOption(id: "japanese-national", label: "Japanese national")
    ]

    var body: some View {
        SectionCard(padding: 20) {
            VStack(alignment: .leading, spacing: 16) {
                TranslatedText(text: "Patient access")
                    .font(.appTitle(18))
                    .foregroundColor(AppTheme.navy)

                Picker("Auth", selection: $selectedTab) {
                    ForEach(AuthTab.allCases) { tab in
                        Text(tab.title).tag(tab)
                    }
                }
                .pickerStyle(.segmented)

                if selectedTab == .signIn {
                    signInForm
                } else {
                    signupForm
                }
            }
        }
        .onChange(of: signupEmail) { _, newValue in
            resetSignupFlow(keepEmail: true)
        }
        .onChange(of: photoItem) { _, newValue in
            Task { @MainActor in
                await loadPhoto(from: newValue)
            }
        }
    }

    private var signInForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Email", text: $loginEmail)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)

            SecureField("Password", text: $loginPassword)
                .textFieldStyle(.roundedBorder)

            if let loginError {
                Text(loginError)
                    .font(.appBody(11))
                    .foregroundColor(.red)
            }

            Button {
                Task { await handleLogin() }
            } label: {
                if isLoginLoading {
                    ProgressView()
                } else {
                    TranslatedText(text: "Sign in")
                        .font(.appBody(14, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(AppTheme.primary)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            Button {
                resetOpen.toggle()
            } label: {
                TranslatedText(text: resetOpen ? "Hide reset" : "Reset password")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.primary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if resetOpen {
                resetPasswordForm
            }
        }
    }

    private var resetPasswordForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Email", text: $resetEmail)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)

            TextField("Reset code", text: resetOtpBinding)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.numberPad)

            SecureField("New password", text: $resetPassword)
                .textFieldStyle(.roundedBorder)

            if let resetMessage {
                Text(resetMessage)
                    .font(.appBody(11))
                    .foregroundColor(resetMessageIsError ? .red : .green)
            }

            HStack(spacing: 10) {
                Button {
                    Task { await requestPasswordResetOtp() }
                } label: {
                    if resetOtpLoading {
                        ProgressView()
                    } else {
                        Text(resetOtpSent ? "Resend OTP" : "Send reset OTP")
                            .font(.appBody(12, weight: .semibold))
                    }
                }
                .disabled(resetOtpLoading || resetOtpCooldown > 0)
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(AppTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                if resetOtpCooldown > 0 {
                    Text("Resend in \(formatCountdown(resetOtpCooldown))")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                }
            }

            Button {
                Task { await resetPasswordAction() }
            } label: {
                if resetLoading {
                    ProgressView()
                } else {
                    Text("Reset password")
                        .font(.appBody(12, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(AppTheme.navy)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .padding(.top, 4)
    }

    private var signupForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                TranslatedText(text: "Signup progress")
                    .font(.appBody(12, weight: .semibold))
                    .foregroundColor(AppTheme.navy)
                TranslatedText(text: "Step \(signupStep.number) of 5: \(signupStep.title)")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)
            }
            .padding(12)
            .background(AppTheme.surface)
            .cornerRadius(12)

            switch signupStep {
            case .email:
                signupEmailStep
            case .otp:
                signupOtpStep
            case .phone:
                signupPhoneStep
            case .phoneOtp:
                signupPhoneOtpStep
            case .details:
                signupDetailsStep
            }

            if let signupStatus {
                Text(signupStatus)
                    .font(.appBody(11))
                    .foregroundColor(signupStatusIsError ? .red : .green)
            }
        }
    }

    private var signupEmailStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Email", text: $signupEmail)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)

            TranslatedText(text: "We will check if the email is already registered before sending the verification code.")
                .font(.appBody(11))
                .foregroundColor(AppTheme.muted)

            if isSignupEmailValid {
                VStack(alignment: .leading, spacing: 8) {
                    TranslatedText(text: "Security check")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.navy)

                    RecaptchaWebView(
                        siteKey: AppConfig.recaptchaSiteKey,
                        onVerify: { token in
                            captchaToken = token
                        },
                        onExpire: {
                            captchaToken = nil
                        },
                        onError: {
                            captchaToken = nil
                        }
                    )
                    .id(recaptchaResetID)
                    .frame(height: 92)

                    TranslatedText(text: "Complete the captcha to unlock verification for this email.")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                }
            }

            Button {
                Task { await checkEmailAvailability() }
            } label: {
                if isCheckEmailLoading {
                    ProgressView()
                } else {
                    Text("Check email")
                        .font(.appBody(12, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(AppTheme.primary)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .disabled(isCheckEmailLoading || captchaToken == nil)
        }
    }

    private var signupOtpStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    TranslatedText(text: "Verify your email")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.navy)
                    Text(signupEmail)
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                }
                Spacer()
                Button {
                    resetSignupFlow(keepEmail: true)
                } label: {
                    Text("Change email")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.primary)
                }
            }

            TextField("Verification code", text: emailOtpBinding)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.numberPad)

            HStack(spacing: 10) {
                Button {
                    Task { await requestEmailOtp() }
                } label: {
                    if otpLoading {
                        ProgressView()
                    } else {
                        Text(otpSent ? "Resend OTP" : "Send OTP")
                            .font(.appBody(12, weight: .semibold))
                    }
                }
                .disabled(otpLoading || otpCooldown > 0)
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(AppTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Button {
                    Task { await verifyEmailOtp() }
                } label: {
                    if otpLoading {
                        ProgressView()
                    } else {
                        Text("Verify OTP")
                            .font(.appBody(12, weight: .semibold))
                    }
                }
                .disabled(otpLoading || emailOtp.count < 6)
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(AppTheme.primary.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            if otpCooldown > 0 {
                Text("Resend in \(formatCountdown(otpCooldown))")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)
            }

            if otpVerified {
                Text("Email verified")
                    .font(.appBody(11))
                    .foregroundColor(.green)
            }
        }
    }

    private var signupPhoneStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    TranslatedText(text: "Add your phone number")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.navy)
                    TranslatedText(text: "We will send an SMS verification code.")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                }
                Spacer()
                Button {
                    signupStep = .otp
                } label: {
                    Text("Back")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.primary)
                }
            }

            TextField("Phone number (e.g. +819012345678)", text: $signupPhone)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.phonePad)

            TranslatedText(text: "Enter your full phone number with country code.")
                .font(.appBody(11))
                .foregroundColor(AppTheme.muted)

            Button {
                signupStep = .phoneOtp
            } label: {
                Text("Continue to phone verification")
                    .font(.appBody(12, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(AppTheme.primary)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .disabled(!isValidPhone)
        }
    }

    private var signupPhoneOtpStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    TranslatedText(text: "Verify your phone")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.navy)
                    Text(signupPhone)
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                }
                Spacer()
                Button {
                    signupStep = .phone
                } label: {
                    Text("Change phone")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.primary)
                }
            }

            TextField("SMS code", text: phoneOtpBinding)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.numberPad)

            HStack(spacing: 10) {
                Button {
                    Task { await requestPhoneOtp() }
                } label: {
                    if phoneOtpLoading {
                        ProgressView()
                    } else {
                        Text(phoneOtpSent ? "Resend SMS" : "Send SMS")
                            .font(.appBody(12, weight: .semibold))
                    }
                }
                .disabled(phoneOtpLoading || phoneOtpCooldown > 0)
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(AppTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Button {
                    Task { await verifyPhoneOtp() }
                } label: {
                    if phoneOtpLoading {
                        ProgressView()
                    } else {
                        Text("Verify SMS")
                            .font(.appBody(12, weight: .semibold))
                    }
                }
                .disabled(phoneOtpLoading || phoneOtp.count < 6)
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(AppTheme.primary.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            if phoneOtpCooldown > 0 {
                Text("Resend in \(formatCountdown(phoneOtpCooldown))")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)
            }

            if phoneOtpVerified {
                Text("Phone verified")
                    .font(.appBody(11))
                    .foregroundColor(.green)
            }
        }
    }

    private var signupDetailsStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Full name", text: $signupName)
                .textFieldStyle(.roundedBorder)

            DatePicker("Date of birth", selection: $signupDob, displayedComponents: .date)
                .datePickerStyle(.compact)

            TextField("Nationality", text: $signupNationality)
                .textFieldStyle(.roundedBorder)

            Picker("Visa type", selection: $signupVisaType) {
                ForEach(visaOptions) { option in
                    Text(option.label).tag(option.id)
                }
            }
            .pickerStyle(.menu)

            PhotosPicker(selection: $photoItem, matching: .images) {
                HStack(spacing: 10) {
                    Image(systemName: "photo")
                    Text(photoPayload == nil ? "Upload profile photo (optional)" : "Change photo")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.navy)
                    Spacer()
                }
                .padding(10)
                .background(AppTheme.surface)
                .cornerRadius(12)
            }

            if let preview = photoPreview {
                preview
                    .resizable()
                    .scaledToFill()
                    .frame(width: 80, height: 80)
                    .clipShape(Circle())

                Button {
                    photoItem = nil
                    photoPayload = nil
                    self.photoPreview = nil
                } label: {
                    Text("Remove photo")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.primary)
                }
            } else {
                Text("Optional. Max size 5MB.")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)
            }

            SecureField("Password (min 8 characters)", text: $signupPassword)
                .textFieldStyle(.roundedBorder)

            VStack(alignment: .leading, spacing: 8) {
                TranslatedText(text: "Consent for medical data handling (Japan APPI)")
                    .font(.appBody(12, weight: .semibold))
                    .foregroundColor(AppTheme.navy)
                TranslatedText(text: "I consent to DocNearMe collecting, using, and securely storing my personal information, including health-related data, in compliance with Japan's Act on the Protection of Personal Information (APPI), for account creation, care coordination, and secure service delivery.")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)

                Toggle(isOn: $consentAccepted) {
                    Text("I agree and provide my explicit consent.")
                        .font(.appBody(11))
                }
            }
            .padding(12)
            .background(AppTheme.surface)
            .cornerRadius(12)

            Button {
                Task { await submitSignup() }
            } label: {
                if isSignupLoading {
                    ProgressView()
                } else {
                    Text("Create account")
                        .font(.appBody(12, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(AppTheme.primary)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    private var emailOtpBinding: Binding<String> {
        Binding(
            get: { emailOtp },
            set: { emailOtp = sanitizeOtp($0) }
        )
    }

    private var phoneOtpBinding: Binding<String> {
        Binding(
            get: { phoneOtp },
            set: { phoneOtp = sanitizeOtp($0) }
        )
    }

    private var resetOtpBinding: Binding<String> {
        Binding(
            get: { resetOtp },
            set: { resetOtp = sanitizeOtp($0) }
        )
    }

    private var isSignupEmailValid: Bool {
        let trimmed = signupEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.contains("@") && trimmed.contains(".")
    }

    private var isValidPhone: Bool {
        let pattern = "^\\+\\d{7,15}$"
        return signupPhone.range(of: pattern, options: .regularExpression) != nil
    }

    private func handleLogin() async {
        isLoginLoading = true
        loginError = nil
        defer { isLoginLoading = false }
        do {
            let payload = LoginRequest(email: loginEmail, password: loginPassword)
            let response: AuthResponse = try await APIClient.shared.request("/api/auth/login", method: .post, body: payload)
            appState.authToken = response.token
            appState.user = response.user
        } catch {
            loginError = error.localizedDescription
        }
    }

    private func checkEmailAvailability() async {
        guard let captchaToken else { return }
        isCheckEmailLoading = true
        setSignupStatus(nil)
        defer { isCheckEmailLoading = false }
        do {
            let payload = CheckEmailRequest(email: signupEmail, captchaToken: captchaToken)
            let response: CheckEmailResponse = try await APIClient.shared.request("/api/auth/check-email", method: .post, body: payload)
            setSignupStatus(response.message, isError: response.exists)
            if !response.exists {
                captchaProofToken = response.captchaProofToken
                signupStep = .otp
            }
        } catch {
            setSignupStatus(error.localizedDescription, isError: true)
        }
    }

    private func requestEmailOtp() async {
        guard let captchaProofToken else {
            setSignupStatus("Complete the email check first.", isError: true)
            return
        }
        otpLoading = true
        setSignupStatus(nil)
        defer { otpLoading = false }
        do {
            let payload = RequestOtpRequest(email: signupEmail, captchaProofToken: captchaProofToken)
            let response: OtpResponse = try await APIClient.shared.request("/api/auth/request-otp", method: .post, body: payload)
            setSignupStatus(response.message, isError: !response.success)
            otpSent = response.success
            if response.success {
                startOtpCooldown(seconds: 60)
            }
        } catch {
            setSignupStatus(error.localizedDescription, isError: true)
        }
    }

    private func verifyEmailOtp() async {
        otpLoading = true
        setSignupStatus(nil)
        defer { otpLoading = false }
        do {
            let payload = VerifyOtpRequest(email: signupEmail, otp: emailOtp)
            let response: OtpResponse = try await APIClient.shared.request("/api/auth/verify-otp", method: .post, body: payload)
            setSignupStatus(response.message, isError: !response.success)
            otpVerified = response.success
            if response.success {
                signupStep = .phone
            }
        } catch {
            setSignupStatus(error.localizedDescription, isError: true)
        }
    }

    private func requestPhoneOtp() async {
        phoneOtpLoading = true
        setSignupStatus(nil)
        defer { phoneOtpLoading = false }
        do {
            let payload = RequestPhoneOtpRequest(phone: signupPhone)
            let response: OtpResponse = try await APIClient.shared.request("/api/auth/request-phone-otp", method: .post, body: payload)
            setSignupStatus(response.message, isError: !response.success)
            phoneOtpSent = response.success
            if response.success {
                startPhoneOtpCooldown(seconds: 60)
            }
        } catch {
            setSignupStatus(error.localizedDescription, isError: true)
        }
    }

    private func verifyPhoneOtp() async {
        phoneOtpLoading = true
        setSignupStatus(nil)
        defer { phoneOtpLoading = false }
        do {
            let payload = VerifyPhoneOtpRequest(phone: signupPhone, otp: phoneOtp)
            let response: PhoneOtpResponse = try await APIClient.shared.request("/api/auth/verify-phone-otp", method: .post, body: payload)
            setSignupStatus(response.message, isError: !response.success)
            phoneOtpVerified = response.success
            if response.success {
                phoneProofToken = response.phoneProofToken
                signupStep = .details
            }
        } catch {
            setSignupStatus(error.localizedDescription, isError: true)
        }
    }

    private func submitSignup() async {
        guard consentAccepted else {
            setSignupStatus("Please provide consent to proceed with account creation.", isError: true)
            return
        }
        guard let phoneProofToken else {
            setSignupStatus("Phone verification required before signup.", isError: true)
            return
        }
        isSignupLoading = true
        setSignupStatus(nil)
        defer { isSignupLoading = false }
        do {
            let payload = SignupRequest(
                name: signupName,
                email: signupEmail,
                password: signupPassword,
                dateOfBirth: Self.dobFormatter.string(from: signupDob),
                nationality: signupNationality,
                visaType: signupVisaType,
                phone: signupPhone,
                phoneProofToken: phoneProofToken,
                photo: photoPayload,
                consentAccepted: consentAccepted
            )
            let response: AuthResponse = try await APIClient.shared.request("/api/auth/signup", method: .post, body: payload)
            appState.authToken = response.token
            appState.user = response.user
            setSignupStatus("Account created successfully.")
        } catch {
            setSignupStatus(error.localizedDescription, isError: true)
        }
    }

    private func requestPasswordResetOtp() async {
        resetOtpLoading = true
        resetMessage = nil
        defer { resetOtpLoading = false }
        do {
            let payload = RequestPasswordResetRequest(email: resetEmail)
            let response: OtpResponse = try await APIClient.shared.request("/api/auth/request-password-reset", method: .post, body: payload)
            resetMessage = response.message
            resetMessageIsError = !response.success
            resetOtpSent = response.success
            if response.success {
                startResetCooldown(seconds: 60)
            }
        } catch {
            resetMessage = error.localizedDescription
            resetMessageIsError = true
        }
    }

    private func resetPasswordAction() async {
        resetLoading = true
        resetMessage = nil
        defer { resetLoading = false }
        do {
            let payload = ResetPasswordRequest(email: resetEmail, otp: resetOtp, password: resetPassword)
            let response: ResetPasswordResponse = try await APIClient.shared.request("/api/auth/reset-password", method: .post, body: payload)
            resetMessage = response.message
            resetMessageIsError = !response.success
        } catch {
            resetMessage = error.localizedDescription
            resetMessageIsError = true
        }
    }

    private func startOtpCooldown(seconds: Int) {
        otpCooldownTask?.cancel()
        otpCooldown = seconds
        otpCooldownTask = Task { @MainActor in
            while otpCooldown > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                otpCooldown -= 1
            }
        }
    }

    private func startPhoneOtpCooldown(seconds: Int) {
        phoneOtpCooldownTask?.cancel()
        phoneOtpCooldown = seconds
        phoneOtpCooldownTask = Task { @MainActor in
            while phoneOtpCooldown > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                phoneOtpCooldown -= 1
            }
        }
    }

    private func startResetCooldown(seconds: Int) {
        resetCooldownTask?.cancel()
        resetOtpCooldown = seconds
        resetCooldownTask = Task { @MainActor in
            while resetOtpCooldown > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                resetOtpCooldown -= 1
            }
        }
    }

    private func sanitizeOtp(_ value: String) -> String {
        String(value.filter { $0.isNumber }.prefix(6))
    }

    private func formatCountdown(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let remaining = seconds % 60
        return String(format: "%d:%02d", minutes, remaining)
    }

    private func resetSignupFlow(keepEmail: Bool) {
        let currentEmail = signupEmail
        signupStep = .email
        captchaToken = nil
        captchaProofToken = nil
        recaptchaResetID = UUID()
        emailOtp = ""
        otpVerified = false
        otpSent = false
        otpCooldown = 0
        signupPhone = ""
        phoneOtp = ""
        phoneOtpVerified = false
        phoneOtpSent = false
        phoneOtpCooldown = 0
        phoneProofToken = nil
        if keepEmail {
            signupEmail = currentEmail
        } else {
            signupEmail = ""
        }
    }

    private func setSignupStatus(_ message: String?, isError: Bool = false) {
        signupStatus = message
        signupStatusIsError = isError
    }

    @MainActor
    private func loadPhoto(from item: PhotosPickerItem?) async {
        guard let item else { return }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else { return }
            if data.count > 5 * 1024 * 1024 {
                setSignupStatus("Photo must be 5MB or smaller.", isError: true)
                photoPayload = nil
                photoPreview = nil
                return
            }
            let contentType = item.supportedContentTypes.first
            let mimeType = contentType?.preferredMIMEType ?? "image/jpeg"
            let fileExtension = contentType?.preferredFilenameExtension ?? "jpg"
            let fileName = "profile.\(fileExtension)"
            let base64 = data.base64EncodedString()
            let dataUrl = "data:\(mimeType);base64,\(base64)"

            photoPayload = SignupPhotoPayload(
                dataUrl: dataUrl,
                fileName: fileName,
                fileType: mimeType,
                size: data.count
            )
            if let image = UIImage(data: data) {
                photoPreview = Image(uiImage: image)
            }
        } catch {
            setSignupStatus("Unable to load photo.", isError: true)
        }
    }

    private enum AuthTab: String, CaseIterable, Identifiable {
        case signIn
        case signUp

        var id: String { rawValue }

        var title: String {
            switch self {
            case .signIn: return "Sign in"
            case .signUp: return "Create account"
            }
        }
    }

    private enum SignupStep {
        case email
        case otp
        case phone
        case phoneOtp
        case details

        var number: String {
            switch self {
            case .email: return "1"
            case .otp: return "2"
            case .phone: return "3"
            case .phoneOtp: return "4"
            case .details: return "5"
            }
        }

        var title: String {
            switch self {
            case .email: return "Confirm your email"
            case .otp: return "Verify your email"
            case .phone: return "Add your phone"
            case .phoneOtp: return "Verify your phone"
            case .details: return "Complete your profile"
            }
        }
    }

    private struct VisaOption: Identifiable {
        let id: String
        let label: String
    }

    private static let dobFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
