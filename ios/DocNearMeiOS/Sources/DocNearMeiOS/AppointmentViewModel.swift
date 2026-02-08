import Foundation

@MainActor
final class AppointmentViewModel: ObservableObject {
    enum ViewMode {
        case booking
        case upcoming
    }

    @Published var mode: ViewMode = .upcoming
    @Published var clinics: [ClinicProfile] = []
    @Published var doctors: [ClinicDoctor] = []
    @Published var appointments: [AppointmentResponseItem] = []
    @Published var isLoading = false
    @Published var isLoadingAppointments = false
    @Published var isLoadingSlots = false
    @Published var isLoadingActionSlots = false
    @Published var availabilitySlots: [String] = []
    @Published var actionSlots: [String] = []
    @Published var availabilityNotice: String?
    @Published var intakeForm: IntakeFormConfig?
    @Published var intakeResponses: [String: IntakeAnswerValue] = [:]
    @Published var intakeErrors: [String: String] = [:]
    @Published var formError: String?
    @Published var actionError: String?
    @Published var isSubmitting = false
    @Published var isActionSubmitting = false

    @Published var selectedSpecialization = ""
    @Published var selectedClinicId = ""
    @Published var selectedDoctorId: String? = nil
    @Published var selectedDate: Date? = nil
    @Published var selectedSlot: String? = nil
    @Published var notes = ""
    @Published var patientName = ""
    @Published var patientEmail = ""
    @Published var patientPhone = ""

    @Published var actionType: String? = nil
    @Published var actionAppointment: AppointmentResponseItem? = nil
    @Published var actionReason = ""
    @Published var actionDate: Date? = nil
    @Published var actionSlot: String? = nil

    @Published var confirmation: AppointmentCreateResponse? = nil

    func loadInitial(token: String?) async {
        if isLoading { return }
        isLoading = true
        formError = nil
        do {
            let clinicResponse: ClinicListResponse = try await APIClient.shared.request("/api/clinics")
            clinics = clinicResponse.clinics
            let doctorResponse: ClinicDoctorsResponse = try await APIClient.shared.request("/api/clinics/doctors")
            doctors = doctorResponse.doctors
            if selectedSpecialization.isEmpty {
                selectedSpecialization = specializationOptions.first ?? ""
            }
            if selectedClinicId.isEmpty {
                selectedClinicId = clinicsForSpecialization.first?.id ?? ""
            }
            if let token {
                await loadAppointments(token: token)
                await loadProfile(token: token)
            }
            await loadIntakeForm()
        } catch {
            formError = error.localizedDescription
        }
        isLoading = false
    }

    func loadProfile(token: String) async {
        do {
            let response: PatientProfileResponse = try await APIClient.shared.request("/api/profile", token: token)
            if patientName.isEmpty {
                patientName = response.profile.name
            }
            if patientEmail.isEmpty {
                patientEmail = response.profile.email
            }
            if patientPhone.isEmpty {
                patientPhone = response.profile.phone ?? ""
            }
        } catch {
            // Ignore profile load failures to keep booking available.
        }
    }

    func loadAppointments(token: String) async {
        isLoadingAppointments = true
        defer { isLoadingAppointments = false }
        do {
            let response: AppointmentListResponse = try await APIClient.shared.request("/api/appointments/me", token: token)
            appointments = response.appointments
        } catch {
            formError = error.localizedDescription
        }
    }

    func loadAvailability() async {
        guard let selectedDate, !selectedClinicId.isEmpty else {
            availabilitySlots = []
            availabilityNotice = nil
            return
        }
        isLoadingSlots = true
        defer { isLoadingSlots = false }
        do {
            let dateKey = AppointmentDateHelper.dateKey(for: selectedDate)
            let response: AvailabilityResponse = try await APIClient.shared.request("/api/availability?date=\(dateKey)&clinicId=\(selectedClinicId)")
            availabilitySlots = response.slots
            availabilityNotice = response.isClosed == true ? (response.reason ?? "Clinic is closed for this date.") : nil
        } catch {
            availabilitySlots = []
            availabilityNotice = error.localizedDescription
        }
    }

    func loadActionAvailability() async {
        guard let actionDate, let actionAppointment else {
            actionSlots = []
            return
        }
        isLoadingActionSlots = true
        defer { isLoadingActionSlots = false }
        do {
            let dateKey = AppointmentDateHelper.dateKey(for: actionDate)
            let response: AvailabilityResponse = try await APIClient.shared.request("/api/availability?date=\(dateKey)&clinicId=\(actionAppointment.clinicId)")
            actionSlots = response.slots
        } catch {
            actionSlots = []
        }
    }

    func loadIntakeForm() async {
        guard !selectedClinicId.isEmpty else {
            intakeForm = nil
            return
        }
        do {
            let response: ClinicIntakeFormResponse = try await APIClient.shared.request("/api/clinics/\(selectedClinicId)/intake-form")
            intakeForm = response.form
            intakeResponses = [:]
            intakeErrors = [:]
        } catch {
            intakeForm = nil
        }
    }

    func submitAppointment(token: String) async {
        formError = nil
        intakeErrors = [:]
        guard validateForm() else { return }
        guard let selectedDate, let selectedSlot else { return }

        isSubmitting = true
        defer { isSubmitting = false }

        let preferredStart = AppointmentDateHelper.dateTime(from: selectedDate, slot: selectedSlot)
        let preferredEnd = preferredStart.addingTimeInterval(30 * 60)
        let intakePayload = buildIntakePayload()

        let payload = AppointmentCreateRequest(
            clinicId: selectedClinicId,
            preferredStart: preferredStart.isoString,
            preferredEnd: preferredEnd.isoString,
            patientName: patientName.trimmingCharacters(in: .whitespacesAndNewlines),
            patientPhone: patientPhone.trimmingCharacters(in: .whitespacesAndNewlines),
            patientEmail: patientEmail.trimmingCharacters(in: .whitespacesAndNewlines),
            note: notes.isEmpty ? nil : notes,
            serviceId: nil,
            specialization: selectedSpecializationLabel,
            doctorName: selectedDoctor?.name,
            slot: selectedSlot,
            sharedRecord: nil,
            intakeResponse: intakePayload
        )

        do {
            let response: AppointmentCreateResponse = try await APIClient.shared.request(
                "/api/appointments/request",
                method: .post,
                body: payload,
                token: token
            )
            confirmation = response
        } catch {
            formError = error.localizedDescription
        }
    }

    func submitAction(token: String) async {
        guard let actionType, let actionAppointment else { return }
        guard !actionReason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            actionError = "Please provide a reason before submitting."
            return
        }

        isActionSubmitting = true
        defer { isActionSubmitting = false }
        do {
            if actionType == "cancel" {
                let payload = AppointmentCancelRequest(reason: actionReason.trimmingCharacters(in: .whitespacesAndNewlines))
                _ = try await APIClient.shared.request(
                    "/api/appointments/\(actionAppointment.id)/cancel",
                    method: .patch,
                    body: payload,
                    token: token
                ) as AppointmentCancelResponse
            } else {
                guard let actionDate, let actionSlot else {
                    actionError = "Please choose a new date and time."
                    return
                }
                let payload = AppointmentRescheduleRequest(
                    date: actionDate.isoString,
                    slot: actionSlot,
                    reason: actionReason.trimmingCharacters(in: .whitespacesAndNewlines)
                )
                _ = try await APIClient.shared.request(
                    "/api/appointments/\(actionAppointment.id)/reschedule",
                    method: .patch,
                    body: payload,
                    token: token
                ) as AppointmentRescheduleResponse
            }
            await loadAppointments(token: token)
            resetAction()
        } catch {
            actionError = error.localizedDescription
        }
    }

    func resetAction() {
        actionType = nil
        actionAppointment = nil
        actionReason = ""
        actionDate = nil
        actionSlot = nil
        actionError = nil
        actionSlots = []
    }

    func updateIntakeResponse(question: IntakeQuestion, value: IntakeAnswerValue) {
        intakeResponses[question.id] = value
        intakeErrors[question.id] = nil
    }

    private func validateForm() -> Bool {
        var hasErrors = false
        if patientName.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 {
            formError = "Please enter your full name."
            hasErrors = true
        }
        if !patientEmail.contains("@") {
            formError = "Please enter a valid email address."
            hasErrors = true
        }
        if patientPhone.trimmingCharacters(in: .whitespacesAndNewlines).count < 7 {
            formError = "Please enter a valid phone number."
            hasErrors = true
        }
        if selectedClinicId.isEmpty || selectedDate == nil || selectedSlot == nil {
            formError = "Please select a clinic, date, and time."
            hasErrors = true
        }

        if let intakeForm, intakeForm.deliveryTiming == "booking", intakeForm.isRequired {
            var localErrors: [String: String] = [:]
            for question in intakeForm.questions where question.required {
                if intakeResponses[question.id] == nil {
                    localErrors[question.id] = "This field is required."
                }
            }
            intakeErrors = localErrors
            if !localErrors.isEmpty {
                hasErrors = true
            }
        }

        return !hasErrors
    }

    private func buildIntakePayload() -> IntakeFormResponsePayload? {
        guard let intakeForm, intakeForm.deliveryTiming == "booking" else { return nil }
        let responses = intakeForm.questions.compactMap { question -> IntakeFormAnswerPayload? in
            guard let value = intakeResponses[question.id] else { return nil }
            return IntakeFormAnswerPayload(
                questionId: question.id,
                label: question.label,
                questionType: question.questionType,
                dataType: question.dataType,
                value: value
            )
        }
        return responses.isEmpty ? nil : IntakeFormResponsePayload(responses: responses, submittedAt: nil)
    }

    var specializationOptions: [String] {
        let values = clinics.flatMap { $0.specializations }
        let unique = Array(Set(values)).sorted()
        return unique
    }

    var selectedSpecializationLabel: String {
        selectedSpecialization.isEmpty ? "General" : selectedSpecialization
    }

    var clinicsForSpecialization: [ClinicProfile] {
        guard !selectedSpecialization.isEmpty else { return clinics }
        return clinics.filter { clinic in
            clinic.specializations.contains(where: { $0.caseInsensitiveCompare(selectedSpecialization) == .orderedSame })
        }
    }

    var doctorsForSelection: [ClinicDoctor] {
        guard !selectedClinicId.isEmpty else { return [] }
        return doctors.filter { doctor in
            guard doctor.clinicId == selectedClinicId else { return false }
            guard !selectedSpecialization.isEmpty else { return true }
            return doctor.specialization.caseInsensitiveCompare(selectedSpecialization) == .orderedSame
        }
    }

    var selectedDoctor: ClinicDoctor? {
        guard let selectedDoctorId else { return nil }
        return doctorsForSelection.first(where: { $0.id == selectedDoctorId })
    }

    var activeAppointments: [AppointmentResponseItem] {
        appointments.filter { item in
            let status = item.status.uppercased()
            return status != "CANCELLED_BY_PATIENT" && status != "CANCELLED_BY_CLINIC" && status != "DECLINED"
        }
    }
}

enum AppointmentDateHelper {
    static func dateKey(for date: Date) -> String {
        let jst = date.addingTimeInterval(9 * 60 * 60)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        let components = calendar.dateComponents([.year, .month, .day], from: jst)
        let year = components.year ?? 0
        let month = components.month ?? 1
        let day = components.day ?? 1
        return String(format: "%04d-%02d-%02d", year, month, day)
    }

    static func dateTime(from date: Date, slot: String) -> Date {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "h:mm a"
        let timeDate = formatter.date(from: slot) ?? date
        let calendar = Calendar.current
        let timeComponents = calendar.dateComponents([.hour, .minute], from: timeDate)
        var dateComponents = calendar.dateComponents([.year, .month, .day], from: date)
        dateComponents.hour = timeComponents.hour
        dateComponents.minute = timeComponents.minute
        return calendar.date(from: dateComponents) ?? date
    }
}

private extension Date {
    var isoString: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: self)
    }
}
