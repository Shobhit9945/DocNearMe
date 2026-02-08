import SwiftUI

@MainActor
final class ClinicDetailViewModel: ObservableObject {
    @Published var clinic: ClinicProfile?
    @Published var doctors: [ClinicDoctor] = []
    @Published var reviews: [ClinicReview] = []
    @Published var averageRating: Double = 0
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load(clinicId: String) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        do {
            let clinicResponse: ClinicProfileResponse = try await APIClient.shared.request("/api/clinics/\(clinicId)")
            clinic = clinicResponse.clinic

            let doctorsResponse: ClinicDoctorsResponse = try await APIClient.shared.request("/api/clinics/\(clinicId)/doctors")
            doctors = doctorsResponse.doctors

            let reviewResponse: ClinicReviewListResponse = try await APIClient.shared.request("/api/clinics/\(clinicId)/reviews")
            reviews = reviewResponse.reviews
            averageRating = reviewResponse.averageRating
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

struct ClinicDetailView: View {
    let clinicId: String
    @StateObject private var viewModel = ClinicDetailViewModel()

    var body: some View {
        ScrollView {
            if viewModel.isLoading {
                LoadingCard(title: "Loading clinic details...", subtitle: "Fetching clinic profile and reviews.")
                    .padding(16)
            } else if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .foregroundColor(.red)
                    .padding(16)
            } else if let clinic = viewModel.clinic {
                VStack(alignment: .leading, spacing: 20) {
                    header(for: clinic)
                    SectionCard { specializations(for: clinic) }
                    SectionCard { doctorsSection }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 120)
            }
        }
        .background(AppTheme.background.ignoresSafeArea())
        .overlay(alignment: .topTrailing) {
            LanguageSwitcherView()
                .padding(.top, 12)
                .padding(.trailing, 16)
        }
        .task {
            await viewModel.load(clinicId: clinicId)
        }
    }

    private func header(for clinic: ClinicProfile) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(clinic.name)
                .font(.appTitle(26))
                .foregroundColor(AppTheme.navy)

            HStack(spacing: 8) {
                Image(systemName: "mappin")
                    .foregroundColor(AppTheme.accent)
                Text(clinic.location)
                    .font(.appBody(12))
                    .foregroundColor(AppTheme.muted)
                Spacer()
                if let url = mapsURL(for: clinic) {
                    Link(destination: url) {
                        TranslatedText(text: "Get directions")
                            .font(.appBody(11, weight: .semibold))
                            .foregroundColor(AppTheme.primary)
                    }
                }
            }

            HStack(spacing: 10) {
                ShadowBadge(
                    text: String(format: "%.1f", viewModel.averageRating),
                    icon: "star.fill",
                    background: AppTheme.warningLight,
                    foreground: AppTheme.warning
                )
                Label(clinic.patients, systemImage: "person.2")
                    .font(.appBody(12))
                    .foregroundColor(AppTheme.muted)
                Label(clinic.nextAvailability, systemImage: "calendar")
                    .font(.appBody(12))
                    .foregroundColor(AppTheme.muted)
            }

            AsyncImage(url: URL(string: clinic.image)) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Rectangle().fill(AppTheme.border)
            }
            .frame(height: 220)
            .cornerRadius(24)
        }
    }

    private func specializations(for clinic: ClinicProfile) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            TranslatedText(text: "Specializations")
                .font(.appTitle(18))
                .foregroundColor(AppTheme.navy)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 80), spacing: 8)], alignment: .leading, spacing: 8) {
                ForEach(clinic.specializations, id: \.self) { specialization in
                    ChipView(text: specialization)
                }
            }
        }
    }

    private var doctorsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                TranslatedText(text: "Doctors by specialization")
                    .font(.appTitle(18))
                    .foregroundColor(AppTheme.navy)
                Spacer()
                PillButton(title: "Book appointment", style: .primary) {}
            }

            ForEach(viewModel.doctors) { doctor in
                VStack(alignment: .leading, spacing: 6) {
                    Text(doctor.name)
                        .font(.appBody(14, weight: .semibold))
                    TranslatedText(text: "\(doctor.specialization) · \(doctor.languages.joined(separator: ", "))")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.muted)
                    TranslatedText(text: "Next availability: \(doctor.nextAvailable)")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.muted)
                    HStack {
                        Image(systemName: "star.fill")
                            .foregroundColor(AppTheme.warning)
                        Text(String(format: "%.1f", doctor.rating))
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.warning)
                    }
                }
                .padding(12)
                .background(Color(red: 0.97, green: 0.98, blue: 1.0))
                .cornerRadius(16)
            }
        }
    }

    private func mapsURL(for clinic: ClinicProfile) -> URL? {
        let query = clinic.location.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? clinic.location
        if let placeId = clinic.googlePlaceId, !placeId.isEmpty {
            let url = "https://www.google.com/maps/search/?api=1&query=\(query)&query_place_id=\(placeId)"
            return URL(string: url)
        }
        return URL(string: "https://www.google.com/maps/search/?api=1&query=\(query)")
    }
}
