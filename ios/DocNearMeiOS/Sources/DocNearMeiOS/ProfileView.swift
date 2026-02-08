import SwiftUI

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var profile: PatientProfile?
    @Published var isLoading = false
    @Published var errorMessage: String?

    @Published var name = ""
    @Published var email = ""
    @Published var phone = ""
    @Published var address = ""
    @Published var visaType = ""
    @Published var preferredLanguage = "Japanese"
    @Published var notificationsEnabled = true
    @Published var emergencyContactName = ""
    @Published var emergencyContactNumber = ""

    func loadProfile(token: String?) async {
        guard let token else {
            profile = nil
            return
        }
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        do {
            let response: PatientProfileResponse = try await APIClient.shared.request("/api/profile", token: token)
            applyProfile(response.profile)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func saveProfile(token: String?) async {
        let payload = PatientProfileUpdateRequest(
            name: name,
            email: email,
            phone: phone.isEmpty ? nil : phone,
            address: address.isEmpty ? nil : address,
            visaType: visaType.isEmpty ? nil : visaType,
            emergencyContact: emergencyContactName.isEmpty && emergencyContactNumber.isEmpty ? nil : "\(emergencyContactName) · \(emergencyContactNumber)",
            preferredLanguage: preferredLanguage,
            notificationsEnabled: notificationsEnabled
        )

        guard let token else {
            profile = PatientProfile(
                name: name,
                email: email,
                phone: phone.isEmpty ? nil : phone,
                address: address.isEmpty ? nil : address,
                visaType: visaType.isEmpty ? nil : visaType,
                emergencyContact: emergencyContactName,
                preferredLanguage: preferredLanguage,
                notificationsEnabled: notificationsEnabled
            )
            return
        }

        isLoading = true
        errorMessage = nil
        do {
            let response: PatientProfileResponse = try await APIClient.shared.request("/api/profile", method: .put, body: payload, token: token)
            applyProfile(response.profile)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func applyProfile(_ profile: PatientProfile) {
        self.profile = profile
        name = profile.name
        email = profile.email
        phone = profile.phone ?? ""
        address = profile.address ?? ""
        visaType = profile.visaType ?? ""
        preferredLanguage = profile.preferredLanguage ?? "Japanese"
        notificationsEnabled = profile.notificationsEnabled ?? true
    }
}

struct ProfileView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = ProfileViewModel()
    @State private var isEditing = false
    @State private var showMedicalRecords = false

    private let languageOptions = [
        "Japanese", "English", "Indonesian", "Burmese", "Bangla", "Arabic", "Hindi",
        "Filipino", "Thai", "Chinese", "Korean", "Mexican", "Vietnamese"
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                if appState.authToken == nil {
                    AuthView()
                }
                medicalRecordsSection
                personalSection
                coordinationSection
                safetySection
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 120)
        }
        .background(AppTheme.background.ignoresSafeArea())
        .overlay(alignment: .topTrailing) {
            LanguageSwitcherView()
                .padding(.top, 12)
                .padding(.trailing, 16)
        }
        .navigationDestination(isPresented: $showMedicalRecords) {
            MedicalRecordsView()
        }
        .task {
            await viewModel.loadProfile(token: appState.authToken)
        }
        .onChange(of: appState.authToken) { _, newValue in
            Task {
                await viewModel.loadProfile(token: newValue)
            }
        }
        .onChange(of: appState.openMedicalRecords) { _, newValue in
            if newValue {
                showMedicalRecords = true
                appState.openMedicalRecords = false
            }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                TranslatedText(text: "Profile")
                    .font(.appTitle(24))
                    .foregroundColor(AppTheme.navy)
                TranslatedText(text: "Manage your personal details and preferences.")
                    .font(.appBody(12))
                    .foregroundColor(AppTheme.muted)
            }
            Spacer()
            if appState.authToken != nil {
                PillButton(title: "Sign out", style: .outline) {
                    appState.signOut()
                }
            }
        }
    }

    private var personalSection: some View {
        SectionCard(padding: 20) {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        TranslatedText(text: "Personal information")
                            .font(.appBody(14, weight: .semibold))
                            .foregroundColor(AppTheme.navy)
                        TranslatedText(text: "Manage your personal details and preferences.")
                            .font(.appBody(11))
                            .foregroundColor(AppTheme.muted)
                    }
                    Spacer()
                    Button {
                        isEditing.toggle()
                    } label: {
                        TranslatedText(text: isEditing ? "Done" : "Edit info")
                            .font(.appBody(11, weight: .semibold))
                            .foregroundColor(AppTheme.navy)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.white)
                            .cornerRadius(14)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(AppTheme.border, lineWidth: 1)
                            )
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    TranslatedText(text: "Account")
                        .font(.appBody(10, weight: .semibold))
                        .foregroundColor(AppTheme.muted)
                        .textCase(.uppercase)
                        .tracking(1.2)
                    Group {
                        if viewModel.name.isEmpty {
                            TranslatedText(text: "Guest profile")
                        } else {
                            Text(viewModel.name)
                        }
                    }
                    .font(.appTitle(18))
                    .foregroundColor(AppTheme.navy)
                    TranslatedText(text: appState.authToken == nil ? "Sign in to personalize your profile." : "You are signed in to DocNearMe.")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.muted)
                }
                .padding(12)
                .background(Color(red: 0.97, green: 0.98, blue: 1.0))
                .cornerRadius(14)

                VStack(spacing: 12) {
                    profileField(label: "Full name", text: $viewModel.name)
                    profileField(label: "Email address", text: $viewModel.email)
                    profileField(label: "Phone number", text: $viewModel.phone)
                }
                .disabled(!isEditing)

                VStack(alignment: .leading, spacing: 8) {
                    TranslatedText(text: "Preferred language")
                        .font(.appBody(11, weight: .semibold))
                        .foregroundColor(AppTheme.muted)
                        .textCase(.uppercase)
                        .tracking(1.1)

                    WrapLanguageChips(options: languageOptions, selected: $viewModel.preferredLanguage, isEnabled: isEditing)
                }

                Toggle(isOn: $viewModel.notificationsEnabled) {
                    TranslatedText(text: "Send me appointment reminders and care tips.")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.muted)
                }
                .disabled(!isEditing)

                HStack {
                    PillButton(title: "Save", style: .primary) {
                        Task { await viewModel.saveProfile(token: appState.authToken) }
                    }
                    PillButton(title: "Cancel", style: .outline) {
                        isEditing = false
                    }
                }
                .disabled(!isEditing)
            }
        }
    }

    private var medicalRecordsSection: some View {
        SectionCard(padding: 20) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        TranslatedText(text: "Medical Records Vault")
                            .font(.appBody(14, weight: .semibold))
                            .foregroundColor(AppTheme.navy)
                        TranslatedText(text: "Upload PDFs or images, encrypt them on your device, and store them securely.")
                            .font(.appBody(11))
                            .foregroundColor(AppTheme.muted)
                    }
                    Spacer()
                    ChipView(text: "Encrypted", background: Color.white, foreground: AppTheme.primary)
                }

                PillButton(title: "Open vault", style: .primary) {
                    showMedicalRecords = true
                }
            }
        }
    }

    private var coordinationSection: some View {
        SectionCard(padding: 20) {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        TranslatedText(text: "Clinic coordination")
                            .font(.appBody(14, weight: .semibold))
                            .foregroundColor(AppTheme.navy)
                        TranslatedText(text: "Used only to help clinics prepare documents and communication support")
                            .font(.appBody(11))
                            .foregroundColor(AppTheme.muted)
                    }
                    Spacer()
                    ChipView(text: "Optional", background: Color.white, foreground: AppTheme.muted)
                }

                VStack(spacing: 12) {
                    profileField(label: "Home address", text: $viewModel.address)
                    profileField(label: "Visa type", text: $viewModel.visaType)
                }
                .disabled(!isEditing)
            }
        }
    }

    private var safetySection: some View {
        SectionCard(padding: 20) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "shield.checkerboard")
                        .foregroundColor(AppTheme.primary)
                    VStack(alignment: .leading, spacing: 4) {
                        TranslatedText(text: "Medical safety")
                            .font(.appBody(14, weight: .semibold))
                            .foregroundColor(AppTheme.navy)
                        TranslatedText(text: "Your information is protected with strong encryption.")
                            .font(.appBody(11))
                            .foregroundColor(AppTheme.muted)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    TranslatedText(text: "Emergency contact (for clinics)")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.navy)
                    TranslatedText(text: "Used only if a clinic needs to reach someone on your behalf.")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                }

                VStack(spacing: 12) {
                    profileField(label: "Full name", text: $viewModel.emergencyContactName)
                    profileField(label: "Phone number", text: $viewModel.emergencyContactNumber)
                }
                .disabled(!isEditing)
            }
        }
    }

    private func profileField(label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            TranslatedText(text: label)
                .font(.appBody(10, weight: .semibold))
                .foregroundColor(AppTheme.muted)
                .textCase(.uppercase)
                .tracking(1.2)
            TextField(label, text: text)
                .textFieldStyle(.roundedBorder)
        }
    }
}

struct WrapLanguageChips: View {
    let options: [String]
    @Binding var selected: String
    let isEnabled: Bool

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(options, id: \.self) { option in
                Button(option) {
                    selected = option
                }
                .font(.appBody(11, weight: .semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(selected == option ? AppTheme.lightBlue : Color.white)
                .foregroundColor(selected == option ? AppTheme.primary : AppTheme.muted)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(selected == option ? AppTheme.primary : AppTheme.border, lineWidth: 1)
                )
                .cornerRadius(16)
                .disabled(!isEnabled)
            }
        }
    }
}
