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
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        let url = try buildURL(path: path, queryItems: queryItems)
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
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws {
        let url = try buildURL(path: path, queryItems: queryItems)
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

    private func buildURL(path: String, queryItems: [URLQueryItem]?) throws -> URL {
        let base = AppConfig.baseURL.appendingPathComponent(path)
        guard let queryItems, !queryItems.isEmpty else { return base }
        guard var components = URLComponents(url: base, resolvingAgainstBaseURL: false) else {
            throw APIError(message: "Invalid URL components.")
        }
        components.queryItems = queryItems
        guard let url = components.url else {
            throw APIError(message: "Unable to build request URL.")
        }
        return url
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
