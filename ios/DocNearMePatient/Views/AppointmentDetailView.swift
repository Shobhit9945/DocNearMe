import SwiftUI

struct AppointmentDetailView: View {
    let appointment: AppointmentResponseItem
    let clinicName: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(clinicName ?? appointment.clinicId)
                .font(.title2.weight(.bold))

            DetailRow(label: "Doctor", value: appointment.doctorName ?? "TBD")
            DetailRow(label: "Specialization", value: appointment.specialization)
            DetailRow(label: "Date", value: DateFormatters.shared.format(dateString: appointment.date))
            DetailRow(label: "Time", value: appointment.slot)
            DetailRow(label: "Status", value: appointment.status)

            VStack(alignment: .leading, spacing: 8) {
                Text("Notes")
                    .font(.headline)
                Text(appointment.notes?.isEmpty == false ? appointment.notes! : "No notes added.")
                    .foregroundStyle(.secondary)
            }

            if let message = appointment.clinicMessage {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Clinic message")
                        .font(.headline)
                    Text(message)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()
        }
        .padding(20)
        .navigationTitle("Appointment")
    }
}

private struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline.weight(.semibold))
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    NavigationStack {
        AppointmentDetailView(
            appointment: AppointmentResponseItem(
                id: "preview",
                date: "2024-10-01T09:00:00.000Z",
                dateKey: "2024-10-01",
                slot: "09:00",
                preferredStart: "2024-10-01T09:00:00.000Z",
                preferredEnd: "2024-10-01T09:30:00.000Z",
                confirmedStart: nil,
                confirmedEnd: nil,
                status: "PENDING_CLINIC",
                declineReason: nil,
                clinicMessage: nil,
                specialization: "Family Medicine",
                doctorName: "Dr. Smith",
                clinicId: "clinic-id",
                serviceId: nil,
                notes: "Bring records",
                patientName: nil,
                patientPhone: nil,
                patientEmail: nil,
                createdAt: "",
                updatedAt: nil
            ),
            clinicName: "Preview Clinic"
        )
    }
}
