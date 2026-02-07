import SwiftUI

struct AppointmentsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selection: AppointmentTab = .upcoming
    @State private var showConfirmation = false

    var preselectedClinic: ClinicProfile?

    var body: some View {
        VStack {
            Picker("", selection: $selection) {
                ForEach(AppointmentTab.allCases, id: \.self) { tab in
                    Text(tab.title).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            if selection == .upcoming {
                List {
                    ForEach(appState.appointments) { appointment in
                        NavigationLink {
                            AppointmentDetailView(
                                appointment: appointment,
                                clinicName: appState.clinics.first(where: { $0.id == appointment.clinicId })?.name
                            )
                        } label: {
                            AppointmentRow(
                                appointment: appointment,
                                clinicName: appState.clinics.first(where: { $0.id == appointment.clinicId })?.name
                            )
                        }
                    }
                }
                .listStyle(.plain)
                .task {
                    await appState.loadAppointments()
                }
            } else {
                AppointmentRequestForm(preselectedClinic: preselectedClinic, showConfirmation: $showConfirmation)
            }
        }
        .navigationTitle("Visits")
        .alert("Request sent", isPresented: $showConfirmation) {
            Button("Done", role: .cancel) { }
        } message: {
            Text("We sent your request to the clinic. We’ll notify you once it’s confirmed.")
        }
    }
}

private enum AppointmentTab: CaseIterable {
    case upcoming
    case request

    var title: String {
        switch self {
        case .upcoming:
            return "Upcoming"
        case .request:
            return "Request"
        }
    }
}

private struct AppointmentRequestForm: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedClinic: ClinicProfile
    @State private var doctors: [ClinicDoctor] = []
    @State private var selectedDoctor: ClinicDoctor? = nil
    @State private var visitDate = Date().addingTimeInterval(60 * 60 * 24)
    @State private var selectedSlot = ""
    @State private var slots: [String] = []
    @State private var notes = ""
    @State private var patientName = ""
    @State private var patientEmail = ""
    @State private var patientPhone = ""
    @State private var isLoadingSlots = false
    @Binding var showConfirmation: Bool

    init(preselectedClinic: ClinicProfile?, showConfirmation: Binding<Bool>) {
        let clinic = preselectedClinic ?? ClinicProfile(
            id: "",
            name: "",
            type: "Clinic",
            rating: 0,
            patients: "",
            distance: "",
            location: "",
            image: "",
            specializations: [],
            nextAvailability: "",
            immediateWoundCare: false,
            googlePlaceId: nil,
            phone: nil,
            email: nil
        )
        _selectedClinic = State(initialValue: clinic)
        _showConfirmation = showConfirmation
    }

    var body: some View {
        Form {
            Section("Clinic") {
                Picker("Clinic", selection: $selectedClinic) {
                    ForEach(appState.clinics) { clinic in
                        Text(clinic.name).tag(clinic)
                    }
                }
                .onChange(of: selectedClinic) { _ in
                    Task {
                        await loadDoctors()
                        await loadAvailability()
                    }
                }

                if !doctors.isEmpty {
                    Picker("Doctor", selection: $selectedDoctor) {
                        ForEach(doctors) { doctor in
                            Text(doctor.name).tag(Optional(doctor))
                        }
                    }
                }
            }

            Section("Visit time") {
                DatePicker("Date", selection: $visitDate, displayedComponents: .date)
                    .onChange(of: visitDate) { _ in
                        Task { await loadAvailability() }
                    }
                if isLoadingSlots {
                    ProgressView()
                } else if slots.isEmpty {
                    Text("No available slots for this date.")
                        .foregroundStyle(.secondary)
                } else {
                    Picker("Preferred time", selection: $selectedSlot) {
                        ForEach(slots, id: \.self) { slot in
                            Text(slot).tag(slot)
                        }
                    }
                }
            }

            Section("Notes") {
                TextEditor(text: $notes)
                    .frame(minHeight: 90)
            }

            Section("Patient details") {
                TextField("Full name", text: $patientName)
                TextField("Email", text: $patientEmail)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                TextField("Phone", text: $patientPhone)
                    .keyboardType(.phonePad)
            }

            Button {
                Task {
                    await submitRequest()
                }
            } label: {
                Text("Send request")
                    .frame(maxWidth: .infinity)
            }
            .disabled(selectedClinic.id.isEmpty || selectedSlot.isEmpty)
        }
        .task {
            if selectedClinic.id.isEmpty {
                if let first = appState.clinics.first {
                    selectedClinic = first
                }
            }
            if let profile = appState.profile {
                patientName = profile.name
                patientEmail = profile.email
                patientPhone = profile.phone ?? ""
            }
            await loadDoctors()
            await loadAvailability()
        }
    }

    private func loadDoctors() async {
        guard !selectedClinic.id.isEmpty else { return }
        do {
            let response: ClinicDoctorsResponse = try await APIClient.shared.request("/api/clinics/\(selectedClinic.id)/doctors")
            doctors = response.doctors
            selectedDoctor = doctors.first
        } catch {
            appState.errorMessage = error.localizedDescription
        }
    }

    private func loadAvailability() async {
        guard !selectedClinic.id.isEmpty else { return }
        isLoadingSlots = true
        defer { isLoadingSlots = false }
        let dateKey = DateFormatters.shared.dateKey(from: visitDate)
        if let response = await appState.fetchAvailability(dateKey: dateKey, clinicId: selectedClinic.id) {
            slots = response.slots
            selectedSlot = response.slots.first ?? ""
        }
    }

    private func submitRequest() async {
        let nameValue = patientName.isEmpty ? appState.profile?.name ?? "" : patientName
        let emailValue = patientEmail.isEmpty ? appState.profile?.email ?? "" : patientEmail
        let phoneValue = patientPhone.isEmpty ? appState.profile?.phone ?? "" : patientPhone
        guard !nameValue.isEmpty, !emailValue.isEmpty, !phoneValue.isEmpty else { return }
        let startDate = buildDateTime(from: visitDate, slot: selectedSlot)
        let preferredStart = DateFormatters.shared.isoDateString(from: startDate)
        let preferredEnd = DateFormatters.shared.isoDateString(from: startDate.addingTimeInterval(30 * 60))
        let payload = AppointmentCreateRequest(
            clinicId: selectedClinic.id,
            preferredStart: preferredStart,
            preferredEnd: preferredEnd,
            patientName: nameValue,
            patientPhone: phoneValue,
            patientEmail: emailValue,
            note: notes.isEmpty ? nil : notes,
            specialization: selectedDoctor?.specialization,
            doctorName: selectedDoctor?.name,
            slot: selectedSlot
        )
        let success = await appState.createAppointment(payload)
        if success {
            showConfirmation = true
        }
    }

    private func buildDateTime(from date: Date, slot: String) -> Date {
        let parts = slot.split(separator: \":\")
        let hour = Int(parts.first ?? \"0\") ?? 0
        let minute = Int(parts.dropFirst().first ?? \"0\") ?? 0
        return Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: date) ?? date
    }
}

#Preview {
    NavigationStack {
        AppointmentsView(preselectedClinic: nil)
            .environmentObject(AppState())
    }
}
