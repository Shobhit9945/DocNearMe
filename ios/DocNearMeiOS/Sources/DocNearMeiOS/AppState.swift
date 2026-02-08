import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @Published var authToken: String? {
        didSet { TokenStore.shared.token = authToken }
    }
    @Published var user: AuthUser?
    @Published var selectedLanguage: String = "English"
    @Published var appointmentEntryMode: String? = nil
    @Published var openMedicalRecords: Bool = false
    @Published var openDocDaisy: Bool = false
    @Published var docDaisyRecommendedSpecialization: String? = nil
    @Published var pendingTabSelection: RootTab? = nil

    let availableLanguages: [String] = [
        "Japanese",
        "English",
        "Indonesian",
        "Burmese",
        "Bangla",
        "Arabic",
        "Hindi",
        "Filipino",
        "Thai",
        "Chinese",
        "Korean",
        "Mexican",
        "Vietnamese",
    ]

    var selectedLanguageCode: String {
        switch selectedLanguage {
        case "Japanese": return "ja"
        case "English": return "en"
        case "Indonesian": return "id"
        case "Burmese": return "my"
        case "Bangla": return "bn"
        case "Arabic": return "ar"
        case "Hindi": return "hi"
        case "Filipino": return "fil"
        case "Thai": return "th"
        case "Chinese": return "zh"
        case "Korean": return "ko"
        case "Mexican": return "es"
        case "Vietnamese": return "vi"
        default: return "en"
        }
    }

    init() {
        authToken = TokenStore.shared.token
    }

    func signOut() {
        authToken = nil
        user = nil
        TokenStore.shared.clear()
    }
}
