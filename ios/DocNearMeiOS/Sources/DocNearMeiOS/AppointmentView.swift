import SwiftUI

struct AppointmentView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = AppointmentViewModel()

    @State private var showingActionSheet = false
    @State private var showingDetails = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let confirmation = viewModel.confirmation {
                    confirmationView(confirmation)
                } else {
                    header
                    modeSelector

                    if viewModel.mode == .upcoming {
                        upcomingSection
                    } else {
                        bookingSection
                    }
                }
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
        .onAppear {
            if let entryMode = appState.appointmentEntryMode {
                viewModel.mode = entryMode == "booking" ? .booking : .upcoming
                appState.appointmentEntryMode = nil
            }
        }
        .task {
            await viewModel.loadInitial(token: appState.authToken)
        }
        .onChange(of: appState.authToken) { _, newValue in
            Task {
                await viewModel.loadInitial(token: newValue)
            }
        }
        .onChange(of: viewModel.selectedClinicId) { _, _ in
            Task {
                await viewModel.loadAvailability()
                await viewModel.loadIntakeForm()
            }
        }
        .onChange(of: viewModel.selectedDate) { _, _ in
            Task { await viewModel.loadAvailability() }
        }
        .onChange(of: viewModel.selectedSpecialization) { _, _ in
            viewModel.selectedClinicId = viewModel.clinicsForSpecialization.first?.id ?? ""
            viewModel.selectedDoctorId = nil
        }
        .sheet(isPresented: $showingDetails) {
            AppointmentDetailsSheet(appointment: viewModel.actionAppointment)
        }
        .sheet(isPresented: $showingActionSheet) {
            if let token = appState.authToken {
                AppointmentActionSheet(viewModel: viewModel, token: token)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            TranslatedText(text: viewModel.mode == .booking ? "Request an appointment" : "Upcoming appointments")
                .font(.appTitle(24))
                .foregroundColor(AppTheme.navy)
            TranslatedText(text: viewModel.mode == .booking ? "Plan your visit" : "Your care plan")
                .font(.appBody(12))
                .foregroundColor(AppTheme.muted)
        }
    }

    private var modeSelector: some View {
        HStack(spacing: 8) {
            Button {
                viewModel.mode = .upcoming
            } label: {
                TranslatedText(text: "Upcoming")
                    .font(.appBody(12, weight: .semibold))
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(viewModel.mode == .upcoming ? AppTheme.navy : Color.white)
                    .foregroundColor(viewModel.mode == .upcoming ? .white : AppTheme.muted)
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(AppTheme.border, lineWidth: viewModel.mode == .upcoming ? 0 : 1)
                    )
            }

            Button {
                viewModel.mode = .booking
            } label: {
                TranslatedText(text: "Book")
                    .font(.appBody(12, weight: .semibold))
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(viewModel.mode == .booking ? AppTheme.navy : Color.white)
                    .foregroundColor(viewModel.mode == .booking ? .white : AppTheme.muted)
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(AppTheme.border, lineWidth: viewModel.mode == .booking ? 0 : 1)
                    )
            }
        }
    }

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            if appState.authToken == nil {
                SectionCard(padding: 20) {
                    VStack(alignment: .leading, spacing: 10) {
                        TranslatedText(text: "Sign in to view your appointments")
                            .font(.appTitle(18))
                            .foregroundColor(AppTheme.navy)
                        TranslatedText(text: "Your booking history is tied to your patient account.")
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                        PillButton(title: "Sign in", style: .primary) {}
                    }
                }
            } else if viewModel.isLoadingAppointments {
                LoadingCard(title: "Loading appointments...", subtitle: "Checking your upcoming visits.")
            } else if viewModel.activeAppointments.isEmpty {
                SectionCard(padding: 20) {
                    VStack(alignment: .leading, spacing: 10) {
                        TranslatedText(text: "No upcoming appointments")
                            .font(.appTitle(18))
                            .foregroundColor(AppTheme.navy)
                        TranslatedText(text: "Book your first visit and we will keep everything organized here.")
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                        PillButton(title: "Book an appointment", style: .primary) {
                            viewModel.mode = .booking
                        }
                    }
                }
            } else {
                ForEach(viewModel.activeAppointments) { appointment in
                    SectionCard(padding: 20) {
                        VStack(alignment: .leading, spacing: 12) {
                            TranslatedText(text: "Next appointment")
                                .font(.appBody(10, weight: .semibold))
                                .foregroundColor(AppTheme.muted)
                                .textCase(.uppercase)
                                .tracking(1.2)
                            TranslatedText(text: "\(appointment.doctorName ?? appointment.specialization) · \(appointment.specialization)")
                                .font(.appTitle(16))
                                .foregroundColor(AppTheme.navy)
                            VStack(alignment: .leading, spacing: 6) {
                                Label("\(AppointmentDateHelper.displayDate(from: appointment.date)) · \(appointment.slot)", systemImage: "calendar")
                                Label(clinicName(for: appointment.clinicId), systemImage: "mappin")
                                Label {
                                    TranslatedText(text: "In-person")
                                } icon: {
                                    Image(systemName: "stethoscope")
                                }
                            }
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)

                            HStack(spacing: 10) {
                                PillButton(title: "View details", style: .outline) {
                                    viewModel.actionAppointment = appointment
                                    showingDetails = true
                                }
                                PillButton(title: "Reschedule", style: .outline) {
                                    viewModel.actionAppointment = appointment
                                    viewModel.actionType = "reschedule"
                                    viewModel.actionDate = Date()
                                    viewModel.actionSlot = nil
                                    Task { await viewModel.loadActionAvailability() }
                                    showingActionSheet = true
                                }
                                PillButton(title: "Cancel", style: .danger) {
                                    viewModel.actionAppointment = appointment
                                    viewModel.actionType = "cancel"
                                    showingActionSheet = true
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private var bookingSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let error = viewModel.formError {
                SectionCard(padding: 16) {
                    Text(error)
                        .font(.appBody(12))
                        .foregroundColor(.red)
                }
            }

            if appState.authToken == nil {
                SectionCard(padding: 16) {
                    HStack {
                        TranslatedText(text: "Sign in to book an appointment and keep your visit history in one place.")
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                        Spacer()
                        PillButton(title: "Sign in", style: .primary) {}
                    }
                }
            }

            SectionCard(padding: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    TranslatedText(text: "Select Specialist")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.muted)
                        .textCase(.uppercase)
                        .tracking(1.2)
                    Picker("Specialist", selection: $viewModel.selectedSpecialization) {
                        ForEach(viewModel.specializationOptions, id: \.self) { option in
                            Text(option).tag(option)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding(10)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(AppTheme.border, lineWidth: 1)
                    )

                    TranslatedText(text: "Select Clinic")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.muted)
                        .textCase(.uppercase)
                        .tracking(1.2)
                    Picker("Clinic", selection: $viewModel.selectedClinicId) {
                        ForEach(viewModel.clinicsForSpecialization) { clinic in
                            Text(clinic.name).tag(clinic.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding(10)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(AppTheme.border, lineWidth: 1)
                    )
                }
            }

            SectionCard(padding: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    TranslatedText(text: "Select Doctor")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.muted)
                        .textCase(.uppercase)
                        .tracking(1.2)
                    if viewModel.doctorsForSelection.isEmpty {
                        TranslatedText(text: "We will reserve the next available doctor for this clinic based on your selection.")
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                    } else {
                        ForEach(viewModel.doctorsForSelection) { doctor in
                            Button {
                                viewModel.selectedDoctorId = doctor.id
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        Text(doctor.name)
                                            .font(.appBody(14, weight: .semibold))
                                            .foregroundColor(AppTheme.navy)
                                        Spacer()
                                        ShadowBadge(
                                            text: String(format: "%.1f", doctor.rating),
                                            icon: "star.fill",
                                            background: AppTheme.warningLight,
                                            foreground: AppTheme.warning
                                        )
                                    }
                                    Text(doctor.specialization)
                                        .font(.appBody(12))
                                        .foregroundColor(AppTheme.muted)
                                    WrapChipRow(items: doctor.languages)
                                }
                                .padding(12)
                                .background(viewModel.selectedDoctorId == doctor.id ? AppTheme.lightBlue : Color.white)
                                .cornerRadius(16)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .stroke(AppTheme.border, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            SectionCard(padding: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    TranslatedText(text: "Select Date")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.muted)
                        .textCase(.uppercase)
                        .tracking(1.2)
                    DatePicker("", selection: Binding($viewModel.selectedDate, replacingNilWith: Date()), displayedComponents: .date)
                        .datePickerStyle(.graphical)
                        .labelsHidden()
                }
            }

            SectionCard(padding: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    TranslatedText(text: "Available Time Slots")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.muted)
                        .textCase(.uppercase)
                        .tracking(1.2)

                    if let notice = viewModel.availabilityNotice {
                        Text(notice)
                            .font(.appBody(12))
                            .foregroundColor(.red)
                    }

                    if viewModel.isLoadingSlots {
                        LoadingCard(title: "Loading slots", subtitle: "Checking clinic availability.")
                    } else if viewModel.availabilitySlots.isEmpty {
                        TranslatedText(text: "No slots available for the selected date.")
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                    } else {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            ForEach(viewModel.availabilitySlots, id: \.self) { slot in
                                Button(slot) {
                                    viewModel.selectedSlot = slot
                                }
                                .font(.appBody(12, weight: .semibold))
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity)
                                .background(viewModel.selectedSlot == slot ? AppTheme.accent : Color.white)
                                .foregroundColor(viewModel.selectedSlot == slot ? .white : AppTheme.navy)
                                .cornerRadius(14)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(AppTheme.border, lineWidth: viewModel.selectedSlot == slot ? 0 : 1)
                                )
                            }
                        }
                    }
                }
            }

            SectionCard(padding: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    TranslatedText(text: "Your details")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.muted)
                        .textCase(.uppercase)
                        .tracking(1.2)
                    TextField("Full name", text: $viewModel.patientName)
                        .textFieldStyle(.roundedBorder)
                    TextField("Email", text: $viewModel.patientEmail)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.emailAddress)
                    TextField("Phone", text: $viewModel.patientPhone)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.phonePad)
                    TextEditor(text: $viewModel.notes)
                        .frame(minHeight: 90)
                        .padding(6)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(AppTheme.border, lineWidth: 1)
                        )
                }
            }

            if let intakeForm = viewModel.intakeForm, !intakeForm.questions.isEmpty {
                SectionCard(padding: 20) {
                    VStack(alignment: .leading, spacing: 12) {
                        TranslatedText(text: intakeForm.isRequired ? "Intake form required" : "Optional intake form")
                            .font(.appBody(12, weight: .semibold))
                            .foregroundColor(AppTheme.primary)
                        ForEach(intakeForm.questions) { question in
                            IntakeQuestionView(question: question, value: viewModel.intakeResponses[question.id]) { value in
                                viewModel.updateIntakeResponse(question: question, value: value)
                            }
                            if let error = viewModel.intakeErrors[question.id] {
                                Text(error)
                                    .font(.appBody(11))
                                    .foregroundColor(.red)
                            }
                        }
                    }
                }
            }

            SectionCard(padding: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    TranslatedText(text: "Booking Summary")
                        .font(.appTitle(18))
                        .foregroundColor(AppTheme.navy)

                    SummaryRow(label: "Specialization", value: viewModel.selectedSpecializationLabel)
                    SummaryRow(label: "Doctor", value: viewModel.selectedDoctor?.name ?? "Any available doctor")
                    SummaryRow(label: "Date & Time", value: summaryDateTime)
                    SummaryRow(label: "Clinic", value: clinicLabel)

                    PillButton(title: viewModel.isSubmitting ? "Sending request..." : "Send appointment request", style: .primary) {
                        guard let token = appState.authToken else { return }
                        Task { await viewModel.submitAppointment(token: token) }
                    }
                    .disabled(viewModel.isSubmitting)
                }
            }
        }
    }

    private var summaryDateTime: String {
        guard let date = viewModel.selectedDate else { return "Not selected" }
        let formatted = AppointmentDateHelper.displayDate(from: date)
        if let slot = viewModel.selectedSlot {
            return "\(formatted), \(slot)"
        }
        return formatted
    }

    private var clinicLabel: String {
        viewModel.clinics.first(where: { $0.id == viewModel.selectedClinicId })?.name ?? "Select a clinic"
    }

    private func clinicName(for clinicId: String) -> String {
        viewModel.clinics.first(where: { $0.id == clinicId })?.name ?? clinicId
    }

    private func confirmationView(_ confirmation: AppointmentCreateResponse) -> some View {
        VStack(alignment: .center, spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundColor(.green)
            TranslatedText(text: "Request received")
                .font(.appTitle(22))
                .foregroundColor(AppTheme.navy)
            TranslatedText(text: "Your request was sent to the clinic. We will email you once it is confirmed.")
                .font(.appBody(12))
                .foregroundColor(AppTheme.muted)
                .multilineTextAlignment(.center)

            SectionCard(padding: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    SummaryRow(label: "Request ID", value: confirmation.id)
                    SummaryRow(label: "Clinic", value: clinicLabel)
                    SummaryRow(label: "Patient", value: viewModel.patientName)
                    SummaryRow(label: "Date", value: summaryDateTime)
                }
            }

            PillButton(title: "Back to appointments", style: .outline) {
                viewModel.confirmation = nil
                viewModel.mode = .upcoming
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct AppointmentDetailsSheet: View {
    let appointment: AppointmentResponseItem?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                if let appointment {
                    SummaryRow(label: "Doctor", value: appointment.doctorName ?? appointment.specialization)
                    SummaryRow(label: "Specialization", value: appointment.specialization)
                    SummaryRow(label: "Date", value: AppointmentDateHelper.displayDate(from: appointment.date))
                    SummaryRow(label: "Time", value: appointment.slot)
                    SummaryRow(label: "Clinic", value: appointment.clinicId)
                }
            }
            .padding(20)
            .navigationTitle("Appointment details")
        }
    }
}

struct AppointmentActionSheet: View {
    @ObservedObject var viewModel: AppointmentViewModel
    let token: String

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                TranslatedText(text: viewModel.actionType == "cancel" ? "Cancel appointment" : "Reschedule appointment")
                    .font(.appTitle(18))
                TextField("Reason", text: $viewModel.actionReason)
                    .textFieldStyle(.roundedBorder)

                if viewModel.actionType == "reschedule" {
                    DatePicker("New date", selection: Binding($viewModel.actionDate, replacingNilWith: Date()), displayedComponents: .date)
                        .datePickerStyle(.graphical)
                        .onChange(of: viewModel.actionDate) { _, _ in
                            Task { await viewModel.loadActionAvailability() }
                        }

                    if viewModel.isLoadingActionSlots {
                        LoadingCard(title: "Loading slots", subtitle: "Checking clinic availability.")
                    } else if !viewModel.actionSlots.isEmpty {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            ForEach(viewModel.actionSlots, id: \.self) { slot in
                                Button(slot) {
                                    viewModel.actionSlot = slot
                                }
                                .font(.appBody(12, weight: .semibold))
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity)
                                .background(viewModel.actionSlot == slot ? AppTheme.accent : Color.white)
                                .foregroundColor(viewModel.actionSlot == slot ? .white : AppTheme.navy)
                                .cornerRadius(14)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(AppTheme.border, lineWidth: viewModel.actionSlot == slot ? 0 : 1)
                                )
                            }
                        }
                    } else {
                        TranslatedText(text: "No slots available")
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                    }
                }

                if let error = viewModel.actionError {
                    Text(error)
                        .font(.appBody(11))
                        .foregroundColor(.red)
                }

                PillButton(title: viewModel.isActionSubmitting ? "Updating..." : "Submit", style: .primary) {
                    Task { await viewModel.submitAction(token: token) }
                }
                .disabled(viewModel.isActionSubmitting)
            }
            .padding(20)
            .navigationTitle("Appointment update")
        }
    }
}

struct IntakeQuestionView: View {
    let question: IntakeQuestion
    let value: IntakeAnswerValue?
    let onChange: (IntakeAnswerValue) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            TranslatedText(text: question.label)
                .font(.appBody(12, weight: .semibold))
                .foregroundColor(AppTheme.navy)
            if let description = question.description {
                TranslatedText(text: description)
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)
            }

            switch question.questionType {
            case "short-text":
                TextField(question.label, text: Binding(
                    get: { value.stringValue },
                    set: { onChange(.string($0)) }
                ))
                .textFieldStyle(.roundedBorder)
            case "long-text":
                TextEditor(text: Binding(
                    get: { value.stringValue },
                    set: { onChange(.string($0)) }
                ))
                .frame(minHeight: 80)
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(AppTheme.border, lineWidth: 1)
                )
            case "number":
                TextField("0", text: Binding(
                    get: { value.stringValue },
                    set: { onChange(.number(Double($0) ?? 0)) }
                ))
                .textFieldStyle(.roundedBorder)
                .keyboardType(.numberPad)
            case "date":
                TextField("YYYY-MM-DD", text: Binding(
                    get: { value.stringValue },
                    set: { onChange(.string($0)) }
                ))
                .textFieldStyle(.roundedBorder)
            case "boolean":
                Picker("", selection: Binding(
                    get: {
                        switch value {
                        case .some(.bool(let boolValue)):
                            return boolValue ? "yes" : "no"
                        default:
                            return ""
                        }
                    },
                    set: {
                        if $0 == "" { return }
                        onChange(.bool($0 == "yes"))
                    }
                )) {
                    TranslatedText(text: "Select").tag("")
                    TranslatedText(text: "Yes").tag("yes")
                    TranslatedText(text: "No").tag("no")
                }
                .pickerStyle(.segmented)
            case "single-choice":
                Picker("", selection: Binding(
                    get: { value.stringValue },
                    set: { onChange(.string($0)) }
                )) {
                    ForEach(question.options, id: \.self) { option in
                        TranslatedText(text: option).tag(option)
                    }
                }
                .pickerStyle(.menu)
            case "multiple-choice":
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(question.options, id: \.self) { option in
                        Toggle(isOn: Binding(
                            get: { value.arrayValue.contains(option) },
                            set: { newValue in
                                var set = value.arrayValue
                                if newValue {
                                    set.append(option)
                                } else {
                                    set.removeAll { $0 == option }
                                }
                                onChange(.stringArray(set))
                            }
                        )) {
                            TranslatedText(text: option)
                        }
                    }
                }
            default:
                TranslatedText(text: "File uploads are collected by the clinic.")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)
            }
        }
    }
}

struct SummaryRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            TranslatedText(text: label)
                .font(.appBody(11))
                .foregroundColor(AppTheme.muted)
            Spacer()
            Text(value)
                .font(.appBody(12))
                .foregroundColor(AppTheme.navy)
        }
    }
}

private extension IntakeAnswerValue? {
    var stringValue: String {
        switch self {
        case .some(.string(let value)):
            return value
        case .some(.number(let value)):
            return value == 0 ? "" : String(value)
        case .some(.bool(let value)):
            return value ? "yes" : ""
        case .some(.stringArray(let value)):
            return value.joined(separator: ", ")
        case .none:
            return ""
        }
    }

    var boolValue: Bool {
        switch self {
        case .some(.bool(let value)):
            return value
        default:
            return false
        }
    }

    var arrayValue: [String] {
        switch self {
        case .some(.stringArray(let value)):
            return value
        default:
            return []
        }
    }
}

private extension AppointmentDateHelper {
    static func displayDate(from value: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: value) {
            return displayDate(from: date)
        }
        return value
    }

    static func displayDate(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

private extension Binding where Value == Date {
    init(_ source: Binding<Date?>, replacingNilWith defaultValue: Date) {
        self.init(
            get: { source.wrappedValue ?? defaultValue },
            set: { source.wrappedValue = $0 }
        )
    }
}
