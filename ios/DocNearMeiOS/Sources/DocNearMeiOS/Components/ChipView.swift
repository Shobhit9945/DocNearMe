import SwiftUI

struct ChipView: View {
    let text: String
    let background: Color
    let foreground: Color

    init(text: String, background: Color = AppTheme.softPurple, foreground: Color = AppTheme.purple) {
        self.text = text
        self.background = background
        self.foreground = foreground
    }

    var body: some View {
        TranslatedText(text: text)
            .font(.appBody(11, weight: .semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(background)
            .foregroundColor(foreground)
            .clipShape(Capsule())
    }
}
