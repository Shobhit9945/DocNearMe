import SwiftUI

struct TranslatedText: View {
    @EnvironmentObject private var appState: AppState
    let text: String
    var showOriginal: Bool = false

    @State private var translated: String = ""

    var body: some View {
        Text(displayText)
            .onAppear { translate() }
            .onChange(of: appState.selectedLanguage) { _, _ in
                translate()
            }
            .onChange(of: text) { _, _ in
                translate()
            }
    }

    private var displayText: String {
        guard appState.selectedLanguageCode != "en" else { return text }
        if translated.isEmpty {
            return showOriginal ? text : text
        }
        return translated
    }

    private func translate() {
        Task {
            let translation = await TranslationService.shared.translate(
                text: text,
                targetLanguage: appState.selectedLanguageCode
            )
            translated = translation
        }
    }
}
