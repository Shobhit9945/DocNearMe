import Foundation

@MainActor
final class SearchViewModel: ObservableObject {
    @Published var clinics: [ClinicProfile] = []
    @Published var doctors: [ClinicDoctor] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        do {
            let clinicResponse: ClinicListResponse = try await APIClient.shared.request("/api/clinics")
            clinics = clinicResponse.clinics
            let doctorResponse: ClinicDoctorsResponse = try await APIClient.shared.request("/api/clinics/doctors")
            doctors = doctorResponse.doctors
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
