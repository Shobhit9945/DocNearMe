import CoreLocation
import Foundation

@MainActor
final class LocationViewModel: NSObject, ObservableObject {
    static let defaultAddress = "AP House 5, Ritsumeikan APU, Jumonjibaru 1-5, Beppu City, Oita 874-0011"
    private let manualKey = "docnearme_manual_location"
    private let manager = CLLocationManager()

    @Published var currentLocation: String = "Fetching real-time location..."
    @Published var statusText: String = "Fetching your location..."
    @Published var isFetching = true
    @Published var errorMessage: String = ""
    @Published var manualLocation: String? = nil
    @Published var coordinates: CLLocationCoordinate2D? = nil
    @Published var manualCoordinates: CLLocationCoordinate2D? = nil

    var activeCoordinates: CLLocationCoordinate2D? {
        manualCoordinates ?? coordinates
    }

    override init() {
        super.init()
        manager.delegate = self
        manualLocation = UserDefaults.standard.string(forKey: manualKey)
        if let manualLocation {
            currentLocation = manualLocation
            statusText = "Manual address"
            isFetching = false
        } else {
            requestLocation()
        }
    }

    func requestLocation() {
        manager.requestWhenInUseAuthorization()
        manager.requestLocation()
    }

    func setManualLocation(_ location: String, coordinates: CLLocationCoordinate2D? = nil) {
        let trimmed = location.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        UserDefaults.standard.set(trimmed, forKey: manualKey)
        manualLocation = trimmed
        manualCoordinates = coordinates
        currentLocation = trimmed
        statusText = "Manual address"
        isFetching = false
        self.coordinates = nil
    }

    func clearManualLocation() {
        UserDefaults.standard.removeObject(forKey: manualKey)
        manualLocation = nil
        manualCoordinates = nil
        statusText = "Fetching your location..."
        isFetching = true
        requestLocation()
    }

    private func updateFromCoordinates(_ coordinate: CLLocationCoordinate2D) {
        coordinates = coordinate
        Task {
            do {
                let address = try await AddressSearchViewModel.reverseGeocode(lat: coordinate.latitude, lng: coordinate.longitude)
                currentLocation = address
                statusText = "Updated a moment ago"
                errorMessage = ""
            } catch {
                currentLocation = Self.defaultAddress
                statusText = "Updated a moment ago"
                errorMessage = error.localizedDescription
            }
            isFetching = false
        }
    }
}

extension LocationViewModel: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.first?.coordinate else { return }
        Task { @MainActor in
            self.updateFromCoordinates(coordinate)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            self.errorMessage = "Could not retrieve location. Showing default address."
            self.currentLocation = Self.defaultAddress
            self.statusText = "Updated a moment ago"
            self.isFetching = false
            self.coordinates = nil
        }
    }
}
