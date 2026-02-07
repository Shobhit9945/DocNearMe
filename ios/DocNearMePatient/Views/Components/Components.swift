import SwiftUI

struct InfoCard: View {
    let title: String
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.teal.opacity(0.1)))
    }
}

struct ActionCard: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: systemImage)
                    .font(.title2)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16).fill(Color(.systemBackground)))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.2)))
        }
        .buttonStyle(.plain)
    }
}

struct AppointmentRow: View {
    let appointment: AppointmentResponseItem
    let clinicName: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(clinicLabel)
                .font(.subheadline.weight(.semibold))
            if let doctor = appointment.doctorName {
                Text("\(doctor) · \(appointment.specialization)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text("\(formattedDate) · \(appointment.slot)")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(appointment.status)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(statusColor)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    private var formattedDate: String {
        DateFormatters.shared.format(dateString: appointment.date)
    }

    private var clinicLabel: String {
        clinicName ?? appointment.clinicId
    }

    private var statusColor: Color {
        switch appointment.status {
        case "CONFIRMED":
            return .green
        case "PENDING_CLINIC", "RESCHEDULE_REQUESTED":
            return .orange
        case "COMPLETED":
            return .blue
        case "DECLINED", "CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC", "NO_SHOW":
            return .red
        default:
            return .secondary
        }
    }
}

struct LegalNoticeView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("By continuing past this page, you agree to our Terms of Service, Cookie Policy, Privacy Policy and Content Policies. All trademarks are properties of their respective owners.")
            Text("2025-2026 © DocNearMe™ Ltd. All rights reserved.")
        }
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
}

enum DateFormatters {
    static let shared = DateFormatters()

    private let isoFormatter: ISO8601DateFormatter
    private let fallbackFormatter: ISO8601DateFormatter
    private let displayFormatter: DateFormatter

    private init() {
        isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        fallbackFormatter = ISO8601DateFormatter()
        fallbackFormatter.formatOptions = [.withInternetDateTime]
        displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .none
    }

    func format(dateString: String) -> String {
        if let date = isoFormatter.date(from: dateString) ?? fallbackFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }
        return dateString
    }

    func isoDateString(from date: Date) -> String {
        isoFormatter.string(from: date)
    }

    func dateKey(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
