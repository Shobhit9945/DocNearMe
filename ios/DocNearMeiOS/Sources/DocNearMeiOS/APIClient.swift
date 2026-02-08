import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

enum APIError: Error, LocalizedError {
    case invalidResponse
    case httpStatus(Int)
    case emptyBody
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server."
        case .httpStatus(let status):
            return "Server returned status \(status)."
        case .emptyBody:
            return "Response body was empty."
        case .server(let message):
            return message
        }
    }
}

private struct APIErrorResponse: Decodable {
    let message: String?
    let error: String?
}

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    func request<T: Decodable>(
        _ path: String,
        method: HTTPMethod = .get,
        body: Encodable? = nil,
        token: String? = nil
    ) async throws -> T {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url: URL
        if normalizedPath.contains("?") {
            guard let composedUrl = URL(string: normalizedPath, relativeTo: AppConfig.apiBaseURL) else {
                throw APIError.invalidResponse
            }
            url = composedUrl
        } else {
            url = AppConfig.apiBaseURL.appendingPathComponent(normalizedPath)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            if !data.isEmpty,
               let apiError = try? decoder.decode(APIErrorResponse.self, from: data),
               let message = apiError.message ?? apiError.error {
                throw APIError.server(message)
            }
            throw APIError.httpStatus(httpResponse.statusCode)
        }
        guard !data.isEmpty else {
            throw APIError.emptyBody
        }
        return try decoder.decode(T.self, from: data)
    }
}

struct AnyEncodable: Encodable {
    private let encodeFunc: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        self.encodeFunc = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeFunc(encoder)
    }
}
