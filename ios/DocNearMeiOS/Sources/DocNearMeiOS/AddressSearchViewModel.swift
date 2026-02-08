import Foundation

struct AddressSuggestion: Identifiable, Hashable {
    let id = UUID()
    let description: String
    let placeId: String
}

struct PlaceDetailsPayload {
    let address: String
    let location: PlaceLocation?
}

@MainActor
final class AddressSearchViewModel: ObservableObject {
    @Published var suggestions: [AddressSuggestion] = []
    @Published var isLoading = false
    @Published var errorMessage: String = ""

    private var sessionToken = UUID().uuidString

    func fetchSuggestions(input: String) async {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 3 else {
            suggestions = []
            errorMessage = ""
            return
        }

        isLoading = true
        errorMessage = ""
        do {
            let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
            let path = "/api/google-maps/places/autocomplete?input=\(encoded)&sessionToken=\(sessionToken)"
            let response: PlacesAutocompleteResponse = try await APIClient.shared.request(path)
            if response.status != nil && response.status != "OK" {
                if response.status == "ZERO_RESULTS" {
                    suggestions = []
                } else {
                    throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: response.error_message ?? "Unable to fetch address suggestions."])
                }
            }
            suggestions = response.predictions?.compactMap {
                guard let description = $0.description, let placeId = $0.place_id else { return nil }
                return AddressSuggestion(description: description, placeId: placeId)
            } ?? []
        } catch {
            errorMessage = error.localizedDescription
            suggestions = []
        }
        isLoading = false
    }

    func fetchPlaceDetails(placeId: String) async throws -> PlaceDetailsPayload {
        let encoded = placeId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? placeId
        let path = "/api/google-maps/places/details?placeId=\(encoded)&sessionToken=\(sessionToken)"
        let response: PlacesDetailsResponse = try await APIClient.shared.request(path)
        if response.status != nil && response.status != "OK" {
            throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: response.error_message ?? "Unable to load location details."])
        }
        sessionToken = UUID().uuidString
        guard let formatted = response.result?.formatted_address else {
            throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: "Location coordinates were not available."])
        }
        return PlaceDetailsPayload(address: formatted, location: response.result?.geometry?.location)
    }

    func fetchPlaceLocation(placeId: String) async throws -> PlaceLocation? {
        let encoded = placeId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? placeId
        let path = "/api/google-maps/places/details?placeId=\(encoded)"
        let response: PlacesDetailsResponse = try await APIClient.shared.request(path)
        if response.status != nil && response.status != "OK" {
            throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: response.error_message ?? "Unable to load location details."])
        }
        return response.result?.geometry?.location
    }

    func geocodeAddress(_ address: String) async throws -> String {
        let trimmed = address.trimmingCharacters(in: .whitespacesAndNewlines)
        let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
        let path = "/api/google-maps/geocode?address=\(encoded)"
        let response: GeocodeResponse = try await APIClient.shared.request(path)
        if response.status != nil && response.status != "OK" {
            throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: response.error_message ?? "Unable to verify this address."])
        }
        guard let formatted = response.results?.first?.formatted_address else {
            throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: "Unable to verify this address."])
        }
        return formatted
    }

    static func reverseGeocode(lat: Double, lng: Double) async throws -> String {
        let path = "/api/google-maps/geocode?latlng=\(lat),\(lng)"
        let response: GeocodeResponse = try await APIClient.shared.request(path)
        if response.status != nil && response.status != "OK" {
            throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: response.error_message ?? "Geocoding failed."])
        }
        guard let formatted = response.results?.first?.formatted_address else {
            throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: "Geocoding failed."])
        }
        return formatted
    }
}

struct PlacesAutocompleteResponse: Codable {
    let status: String?
    let error_message: String?
    let predictions: [AutocompletePrediction]?
}

struct AutocompletePrediction: Codable {
    let description: String?
    let place_id: String?
}

struct PlacesDetailsResponse: Codable {
    let status: String?
    let error_message: String?
    let result: PlaceDetailsResult?
}

struct PlaceDetailsResult: Codable {
    let formatted_address: String?
    let geometry: PlaceGeometry?
}

struct PlaceGeometry: Codable {
    let location: PlaceLocation?
}

struct PlaceLocation: Codable, Equatable {
    let lat: Double?
    let lng: Double?
}

struct GeocodeResponse: Codable {
    let status: String?
    let error_message: String?
    let results: [GeocodeResult]?
}

struct GeocodeResult: Codable {
    let formatted_address: String?
}
