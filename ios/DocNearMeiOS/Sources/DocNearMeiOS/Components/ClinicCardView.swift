import SwiftUI

struct ClinicCardView: View {
    let clinic: ClinicProfile
    var distanceKm: Double? = nil
    var showActions: Bool = false
    var onView: (() -> Void)?
    var onBook: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AsyncImage(url: URL(string: clinic.image)) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                ZStack {
                    Rectangle().fill(AppTheme.border)
                    ProgressView()
                }
            }
            .frame(height: 160)
            .clipped()

            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    Text(clinic.name)
                        .font(.appTitle(18))
                        .foregroundColor(AppTheme.navy)
                        .lineLimit(2)
                    Spacer()
                    ShadowBadge(
                        text: String(format: "%.1f", clinic.rating),
                        icon: "star.fill",
                        background: AppTheme.warningLight,
                        foreground: AppTheme.warning
                    )
                }

                Text(clinic.location)
                    .font(.appBody(12))
                    .foregroundColor(AppTheme.muted)
                    .lineLimit(2)

                HStack(spacing: 10) {
                    if !clinic.patients.isEmpty {
                        Label(clinic.patients, systemImage: "person.2")
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                    }
                    if let distanceKm {
                        Label(String(format: "%.1f km", distanceKm), systemImage: "location")
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                    }
                    Label(clinic.nextAvailability, systemImage: "calendar")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.muted)
                }

                WrapChipRow(items: clinic.specializations.prefix(4).map { $0 })

                if showActions {
                    HStack(spacing: 10) {
                        PillButton(title: "View clinic", style: .outline) {
                            onView?()
                        }
                        PillButton(title: "Book appointment", style: .primary) {
                            onBook?()
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(AppTheme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .cornerRadius(24)
        .shadow(color: AppTheme.shadow, radius: 12, x: 0, y: 8)
    }
}

struct WrapChipRow: View {
    let items: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 80), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { item in
                TranslatedText(text: item)
                    .font(.appBody(11, weight: .semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(AppTheme.softPurple)
                    .foregroundColor(AppTheme.purple)
                    .clipShape(Capsule())
            }
        }
    }
}
