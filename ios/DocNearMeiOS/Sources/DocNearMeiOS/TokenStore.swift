import Foundation

final class TokenStore {
    static let shared = TokenStore()

    private let tokenKey = "docnearme_patient_token"

    var token: String? {
        get { UserDefaults.standard.string(forKey: tokenKey) }
        set {
            if let value = newValue {
                UserDefaults.standard.set(value, forKey: tokenKey)
            } else {
                UserDefaults.standard.removeObject(forKey: tokenKey)
            }
        }
    }

    func clear() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
    }
}
