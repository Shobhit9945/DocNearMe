import SwiftUI

struct QuickActionTile: View {
    let title: String
    let systemImage: String
    let background: Color
    let minHeight: CGFloat
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                Image(systemName: systemImage)
                    .font(.system(size: 32, weight: .semibold))
                TranslatedText(text: title)
                    .font(.appBody(14, weight: .medium))
                    .multilineTextAlignment(.center)
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: minHeight)
            .foregroundColor(.white)
            .background(background)
            .cornerRadius(20)
            .shadow(color: Color(red: 0.09, green: 0.22, blue: 0.42).opacity(0.05), radius: 10, x: 2, y: 0)
        }
        .buttonStyle(.plain)
    }
}
