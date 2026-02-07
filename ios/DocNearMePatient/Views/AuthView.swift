import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var appState: AppState
    @State private var mode: AuthMode = .login

    @State private var email = ""
    @State private var password = ""

    @State private var name = ""
    @State private var dateOfBirth = ""
    @State private var nationality = ""
    @State private var visaType = ""
    @State private var phone = ""
    @State private var otp = ""
    @State private var phoneProofToken: String? = nil
    @State private var isRequestingOtp = false
    @State private var isVerifyingOtp = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 12) {
                    Image(systemName: "heart.text.square")
                        .font(.system(size: 48))
                        .foregroundStyle(.teal)
                    Text("DocNearMe")
                        .font(.largeTitle.weight(.bold))
                    Text("Use your DocNearMe account to access appointments, records, and DocDaisy.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                Picker("Mode", selection: $mode) {
                    ForEach(AuthMode.allCases, id: \.self) { item in
                        Text(item.title).tag(item)
                    }
                }
                .pickerStyle(.segmented)

                if mode == .login {
                    loginForm
                } else {
                    signupForm
                }

                if let errorMessage = appState.errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }

                LegalNoticeView()
            }
            .padding(24)
        }
    }

    private var loginForm: some View {
        VStack(spacing: 16) {
            TextField("Email", text: $email)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)

            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)

            Button {
                Task {
                    await appState.signIn(email: email, password: password)
                }
            } label: {
                if appState.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Sign in")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var signupForm: some View {
        VStack(spacing: 16) {
            TextField("Full name", text: $name)
                .textFieldStyle(.roundedBorder)

            TextField("Email", text: $email)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)

            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)

            TextField("Date of birth (YYYY-MM-DD)", text: $dateOfBirth)
                .textFieldStyle(.roundedBorder)

            TextField("Nationality", text: $nationality)
                .textFieldStyle(.roundedBorder)

            TextField("Visa type", text: $visaType)
                .textFieldStyle(.roundedBorder)

            TextField("Phone (+countrycode)", text: $phone)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.phonePad)

            if phoneProofToken == nil {
                VStack(spacing: 12) {
                    TextField("SMS code", text: $otp)
                        .textFieldStyle(.roundedBorder)
                    HStack {
                        Button("Send code") {
                            Task {
                                isRequestingOtp = true
                                defer { isRequestingOtp = false }
                                let response = await appState.requestPhoneOtp(phone: phone)
                                if response?.success == true {
                                    otp = response?.debugOtp ?? ""
                                }
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(isRequestingOtp || phone.isEmpty)

                        Button("Verify") {
                            Task {
                                isVerifyingOtp = true
                                defer { isVerifyingOtp = false }
                                let response = await appState.verifyPhoneOtp(phone: phone, otp: otp)
                                phoneProofToken = response?.phoneProofToken
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isVerifyingOtp || otp.isEmpty)
                    }
                }
            }

            Button {
                guard let phoneProofToken else { return }
                let payload = SignupRequest(
                    name: name,
                    email: email,
                    password: password,
                    dateOfBirth: dateOfBirth,
                    nationality: nationality,
                    visaType: visaType,
                    phone: phone,
                    phoneProofToken: phoneProofToken,
                    consentAccepted: true
                )
                Task {
                    await appState.signUp(payload: payload)
                }
            } label: {
                if appState.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Create account")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(phoneProofToken == nil)
        }
    }
}

private enum AuthMode: CaseIterable {
    case login
    case signup

    var title: String {
        switch self {
        case .login:
            return "Sign in"
        case .signup:
            return "Sign up"
        }
    }
}

#Preview {
    AuthView()
        .environmentObject(AppState())
}
