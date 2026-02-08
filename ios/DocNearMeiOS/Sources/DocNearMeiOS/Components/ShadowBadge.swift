import SwiftUI

struct ShadowBadge: View {
    let text: String
    let icon: String
    let background: Color
    let foreground: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
            TranslatedText(text: text)
        }
        .font(.appBody(11, weight: .semibold))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(background)
        .foregroundColor(foreground)
        .clipShape(Capsule())
        .shadow(color: AppTheme.shadow, radius: 6, x: 0, y: 3)
    }
}
