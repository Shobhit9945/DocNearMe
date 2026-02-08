import SwiftUI

struct LoadingCard: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Color(red: 0.9, green: 0.87, blue: 1.0))
                        .frame(width: 56, height: 56)
                    Image(systemName: "sparkles")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(AppTheme.purple)
                }
                VStack(alignment: .leading, spacing: 4) {
                    TranslatedText(text: title)
                        .font(.appBody(15, weight: .semibold))
                        .foregroundColor(Color(red: 0.12, green: 0.12, blue: 0.12))
                    TranslatedText(text: subtitle)
                        .font(.appBody(13))
                        .foregroundColor(AppTheme.muted)
                }
                Spacer()
                ProgressView()
                    .tint(AppTheme.purple)
            }

            RoundedRectangle(cornerRadius: 999)
                .fill(Color(red: 0.95, green: 0.95, blue: 0.96))
                .frame(height: 8)
                .overlay(
                    RoundedRectangle(cornerRadius: 999)
                        .fill(
                            LinearGradient(
                                colors: [AppTheme.purpleLight, AppTheme.purple, AppTheme.accent],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: 120, height: 8)
                        .offset(x: -40)
                        .animation(.easeInOut(duration: 1.6).repeatForever(autoreverses: false), value: UUID())
                )

            TranslatedText(text: "This usually takes a few seconds on first load.")
                .font(.appBody(11))
                .foregroundColor(AppTheme.muted)
        }
        .padding(20)
        .background(AppTheme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .cornerRadius(20)
    }
}
