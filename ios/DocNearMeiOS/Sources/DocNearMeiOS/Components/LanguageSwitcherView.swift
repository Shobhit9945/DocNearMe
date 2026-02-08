import SwiftUI

struct LanguageSwitcherView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Menu {
            ForEach(appState.availableLanguages, id: \.self) { language in
                Button(language) {
                    appState.selectedLanguage = language
                }
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "globe")
                    .font(.system(size: 14, weight: .semibold))
                Text(appState.selectedLanguage)
            }
            .font(.appBody(12, weight: .semibold))
            .foregroundColor(Color(red: 0.2, green: 0.27, blue: 0.34))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.white)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.06), radius: 4, x: 0, y: 2)
        }
    }
}
