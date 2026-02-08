import Foundation

final class TranslationService {
    static let shared = TranslationService()

    private var cache: [String: String] = [:]
    private let lock = NSLock()

    func translate(text: String, targetLanguage: String) async -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return text }
        if targetLanguage == "en" { return text }

        let cacheKey = "\(targetLanguage)|\(trimmed)"
        if let cached = cachedValue(for: cacheKey) {
            return cached
        }

        do {
            let payload = TranslateRequest(text: trimmed, targetLanguage: targetLanguage, sourceLanguage: "auto")
            let response: TranslateResponse = try await APIClient.shared.request(
                "/api/translate",
                method: .post,
                body: payload
            )
            let translation = response.translation.trimmingCharacters(in: .whitespacesAndNewlines)
            let result = translation.isEmpty ? text : translation
            setCachedValue(result, for: cacheKey)
            return result
        } catch {
            return text
        }
    }

    private func cachedValue(for key: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return cache[key]
    }

    private func setCachedValue(_ value: String, for key: String) {
        lock.lock()
        defer { lock.unlock() }
        cache[key] = value
    }
}
