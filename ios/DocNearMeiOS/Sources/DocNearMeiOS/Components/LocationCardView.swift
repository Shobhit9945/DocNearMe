import SwiftUI

struct LocationCardView: View {
    let title: String
    let location: String
    let status: String
    let isManual: Bool
    let editLabel: String
    let onEdit: () -> Void
    let onUseGPS: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(red: 0.92, green: 0.96, blue: 1.0))
                Image(systemName: "location.north.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundColor(Color(red: 0.0, green: 0.54, blue: 1.0))
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 4) {
                TranslatedText(text: title)
                    .font(.appBody(12, weight: .semibold))
                    .foregroundColor(AppTheme.muted)
                    .textCase(.uppercase)
                    .tracking(1.1)
                Text(location)
                    .font(.appBody(16, weight: .bold))
                    .foregroundColor(AppTheme.navy)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                TranslatedText(text: status)
                    .font(.appBody(12, weight: .regular))
                    .foregroundColor(AppTheme.muted)

                HStack(spacing: 8) {
                    if isManual {
                        TranslatedText(text: "Manual address")
                            .font(.appBody(11, weight: .semibold))
                            .foregroundColor(Color(red: 0.09, green: 0.28, blue: 0.81))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color(red: 0.91, green: 0.95, blue: 1.0))
                            .clipShape(Capsule())
                    }
                    Button(action: onEdit) {
                        TranslatedText(text: editLabel)
                            .font(.appBody(12, weight: .semibold))
                            .foregroundColor(Color(red: 0.0, green: 0.54, blue: 1.0))
                    }
                    if isManual {
                        Button(action: onUseGPS) {
                            TranslatedText(text: "Use GPS instead")
                                .font(.appBody(12, weight: .semibold))
                                .foregroundColor(AppTheme.muted)
                        }
                    }
                }
                .padding(.top, 6)
            }
        }
        .padding(16)
        .background(Color(red: 0.91, green: 0.95, blue: 1.0))
        .cornerRadius(20)
    }
}
