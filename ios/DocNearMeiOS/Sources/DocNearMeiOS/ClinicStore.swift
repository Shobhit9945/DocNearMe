import Foundation

@MainActor
final class ClinicStore: ObservableObject {
    @Published var clinics: [ClinicProfile] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func loadClinics() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        do {
            let response: ClinicListResponse = try await APIClient.shared.request("/api/clinics")
            clinics = response.clinics
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
