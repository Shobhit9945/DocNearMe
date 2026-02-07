import Foundation

struct APIError: LocalizedError {
    let message: String

    var errorDescription: String? { message }
}

final class APIClient {
    static let shared = APIClient()
    private init() {}

    func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        token: String? = nil,
        body: Encodable? = nil
    ) async throws -> T {
        let url = AppConfig.baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError(message: "Invalid server response.")
        }
        if !(200...299).contains(httpResponse.statusCode) {
            let message = APIClient.decodeErrorMessage(from: data) ?? "Request failed (\(httpResponse.statusCode))."
            throw APIError(message: message)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func requestEmpty(
        _ path: String,
        method: String = "POST",
        token: String? = nil,
        body: Encodable? = nil
    ) async throws {
        let url = AppConfig.baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError(message: "Invalid server response.")
        }
        if !(200...299).contains(httpResponse.statusCode) {
            throw APIError(message: "Request failed (\(httpResponse.statusCode)).")
        }
    }

    private static func decodeErrorMessage(from data: Data) -> String? {
        guard let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let error = payload["error"] as? String { return error }
        if let message = payload["message"] as? String { return message }
        return nil
    }
}

struct AnyEncodable: Encodable {
    private let encoder: (Encoder) throws -> Void

    init(_ encodable: Encodable) {
        encoder = encodable.encode
    }

    func encode(to encoder: Encoder) throws {
        try self.encoder(encoder)
    }
}
