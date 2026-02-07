import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var appState: AppState
    @State private var showEdit = false

    var body: some View {
        Form {
            Section("Profile") {
                ProfileRow(label: "Name", value: appState.profile?.name ?? "")
                ProfileRow(label: "Email", value: appState.profile?.email ?? "")
                ProfileRow(label: "Phone", value: appState.profile?.phone ?? "")
                ProfileRow(label: "Language", value: appState.profile?.preferredLanguage ?? "")
                ProfileRow(label: "Visa type", value: appState.profile?.visaType ?? "")
            }

            Section("Emergency contact") {
                Text(appState.profile?.emergencyContact ?? "")
            }

            Section {
                Button("Edit profile") {
                    showEdit = true
                }
            }

            Section {
                Button(role: .destructive) {
                    appState.signOut()
                } label: {
                    Text("Sign out")
                }
            }

            Section {
                LegalNoticeView()
            }
        }
        .navigationTitle("Profile")
        .task {
            await appState.loadProfile()
        }
        .sheet(isPresented: $showEdit) {
            ProfileEditorView()
        }
    }
}

private struct ProfileRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
        }
    }
}

private struct ProfileEditorView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var emergencyContact = ""
    @State private var preferredLanguage = ""
    @State private var visaType = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Phone", text: $phone)
                TextField("Address", text: $address)
                TextField("Emergency contact", text: $emergencyContact)
                TextField("Preferred language", text: $preferredLanguage)
                TextField("Visa type", text: $visaType)
            }
            .navigationTitle("Edit profile")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await appState.updateProfile(PatientProfileUpdateRequest(
                                name: name.isEmpty ? nil : name,
                                email: nil,
                                phone: phone.isEmpty ? nil : phone,
                                address: address.isEmpty ? nil : address,
                                visaType: visaType.isEmpty ? nil : visaType,
                                emergencyContact: emergencyContact.isEmpty ? nil : emergencyContact,
                                preferredLanguage: preferredLanguage.isEmpty ? nil : preferredLanguage,
                                notificationsEnabled: nil
                            ))
                            dismiss()
                        }
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear {
                name = appState.profile?.name ?? ""
                phone = appState.profile?.phone ?? ""
                address = appState.profile?.address ?? ""
                emergencyContact = appState.profile?.emergencyContact ?? ""
                preferredLanguage = appState.profile?.preferredLanguage ?? ""
                visaType = appState.profile?.visaType ?? ""
            }
        }
    }
}

#Preview {
    NavigationStack {
        ProfileView()
            .environmentObject(AppState())
    }
}
