import Foundation

enum AppConfig {
    static let defaultBaseURL = "http://localhost:8080"

    static var baseURL: URL {
        if let stored = UserDefaults.standard.string(forKey: "DocNearMeAPIBaseURL"),
           let url = URL(string: stored) {
            return url
        }
        return URL(string: defaultBaseURL)!
    }
}
