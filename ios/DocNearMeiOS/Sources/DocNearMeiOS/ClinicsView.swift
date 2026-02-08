import CoreLocation
import SwiftUI

struct ClinicsView: View {
    @EnvironmentObject private var tabRouter: TabRouter
    @EnvironmentObject private var clinicStore: ClinicStore
    @EnvironmentObject private var appState: AppState
    @StateObject private var locationModel = LocationViewModel()
    @StateObject private var addressSearch = AddressSearchViewModel()

    @State private var selectedSpecialization = "all"
    @State private var minRating = 0.0
    @State private var isEditingLocation = false
    @State private var manualInput = ""
    @State private var showSuggestions = false
    @State private var manualError = ""
    @State private var clinicLocations: [String: PlaceLocation] = [:]
    @State private var loadingClinicLocationIds: Set<String> = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                SectionCard(padding: 20) { filterCard }
                clinicList
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 120)
        }
        .background(AppTheme.background.ignoresSafeArea())
        .overlay(alignment: .topTrailing) {
            LanguageSwitcherView()
                .padding(.top, 12)
                .padding(.trailing, 16)
        }
        .task {
            await clinicStore.loadClinics()
        }
        .onAppear {
            applyDocDaisyRecommendation()
        }
        .onChange(of: clinicStore.clinics.count) { _, _ in
            applyDocDaisyRecommendation()
        }
        .onChange(of: appState.docDaisyRecommendedSpecialization) { _, _ in
            applyDocDaisyRecommendation()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            TranslatedText(text: "Clinics")
                .font(.appBody(10, weight: .semibold))
                .foregroundColor(AppTheme.muted)
                .textCase(.uppercase)
                .tracking(2)

            TranslatedText(text: "Discover care for \(selectedLabel)")
                .font(.appTitle(24))
                .foregroundColor(AppTheme.navy)

            TranslatedText(text: "\(filteredClinics.count) options in Beppu updated just now based on your specialty.")
                .font(.appBody(12))
                .foregroundColor(AppTheme.muted)

            LocationCardView(
                title: "Live location",
                location: locationModel.currentLocation,
                status: locationModel.errorMessage.isEmpty ? locationModel.statusText : locationModel.errorMessage,
                isManual: locationModel.manualLocation != nil,
                editLabel: locationModel.manualLocation != nil ? "Edit address" : "Enter address manually",
                onEdit: { isEditingLocation = true },
                onUseGPS: {
                    isEditingLocation = false
                    locationModel.clearManualLocation()
                }
            )

            if isEditingLocation {
                VStack(alignment: .leading, spacing: 8) {
                    TextField("Type your address", text: $manualInput)
                        .textFieldStyle(.roundedBorder)
                        .onChange(of: manualInput) { _, newValue in
                            showSuggestions = true
                            Task { await addressSearch.fetchSuggestions(input: newValue) }
                        }

                    HStack {
                        PillButton(title: "Save", style: .primary) {
                            Task {
                                do {
                                    let formatted = try await addressSearch.geocodeAddress(manualInput)
                                    locationModel.setManualLocation(formatted, coordinates: nil)
                                    manualInput = formatted
                                    manualError = ""
                                    isEditingLocation = false
                                    showSuggestions = false
                                } catch {
                                    manualError = error.localizedDescription
                                }
                            }
                        }
                        PillButton(title: "Cancel", style: .outline) {
                            isEditingLocation = false
                            manualError = ""
                        }
                    }

                    if showSuggestions {
                        VStack(alignment: .leading, spacing: 0) {
                            if addressSearch.isLoading {
                                TranslatedText(text: "Searching address results...")
                                    .font(.appBody(11))
                                    .foregroundColor(AppTheme.muted)
                                    .padding(8)
                            } else if !addressSearch.errorMessage.isEmpty {
                                Text(addressSearch.errorMessage)
                                    .font(.appBody(11))
                                    .foregroundColor(.red)
                                    .padding(8)
                            } else if addressSearch.suggestions.isEmpty, !manualInput.isEmpty {
                                TranslatedText(text: "No matching addresses yet.")
                                    .font(.appBody(11))
                                    .foregroundColor(AppTheme.muted)
                                    .padding(8)
                            } else {
                                ForEach(addressSearch.suggestions) { suggestion in
                                    Button(suggestion.description) {
                                        Task {
                                            do {
                                                let payload = try await addressSearch.fetchPlaceDetails(placeId: suggestion.placeId)
                                                locationModel.setManualLocation(payload.address, coordinates: coordinate(from: payload.location))
                                                manualInput = payload.address
                                                manualError = ""
                                                isEditingLocation = false
                                                showSuggestions = false
                                            } catch {
                                                manualError = error.localizedDescription
                                            }
                                        }
                                    }
                                    .font(.appBody(12))
                                    .foregroundColor(AppTheme.navy)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 8)
                                }
                            }
                        }
                        .background(Color.white)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(AppTheme.border, lineWidth: 1)
                        )
                    }

                    if !manualError.isEmpty {
                        Text(manualError)
                            .font(.appBody(11))
                            .foregroundColor(.red)
                    }
                }
            }
        }
    }

    private var filterCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                TranslatedText(text: "\(selectedLabel) specialists near you")
                    .font(.appBody(13))
                    .foregroundColor(AppTheme.navy)
                TranslatedText(text: "\(filteredClinics.count) care centers available in Beppu")
                    .font(.appTitle(18))
                    .foregroundColor(AppTheme.navy)
                TranslatedText(text: "Filter by specialization and rating to narrow the list.")
                    .font(.appBody(12))
                    .foregroundColor(AppTheme.muted)
            }

            VStack(alignment: .leading, spacing: 12) {
                filterField(label: "Specialization") {
                    Picker("Specialization", selection: $selectedSpecialization) {
                        ForEach(specializationOptions, id: \.self) { value in
                            TranslatedText(text: value).tag(value)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(AppTheme.border, lineWidth: 1)
                    )
                }

                filterField(label: "Minimum rating") {
                    VStack(alignment: .leading, spacing: 8) {
                        Slider(value: $minRating, in: 0...5, step: 0.1)
                            .tint(AppTheme.purple)
                        ShadowBadge(
                            text: String(format: "%.1f+", minRating),
                            icon: "star.fill",
                            background: AppTheme.softPurple,
                            foreground: AppTheme.purple
                        )
                    }
                }
            }
        }
    }

    private var clinicList: some View {
        VStack(alignment: .leading, spacing: 16) {
            if clinicStore.isLoading {
                LoadingCard(title: "Loading clinics", subtitle: "Fetching the latest availability from nearby providers.")
            } else if let errorMessage = clinicStore.errorMessage {
                Text(errorMessage)
                    .font(.appBody(12))
                    .foregroundColor(.red)
            } else {
                ForEach(filteredClinics) { clinic in
                    ClinicCardView(
                        clinic: clinic,
                        distanceKm: distanceForClinic(clinic),
                        showActions: true,
                        onView: { tabRouter.selection = .clinics },
                        onBook: { tabRouter.selection = .appointment }
                    )
                    .task {
                        await loadClinicLocation(for: clinic)
                    }
                }

                if filteredClinics.isEmpty {
                    SectionCard {
                        VStack(spacing: 12) {
                            TranslatedText(text: "No clinics match this specialty yet. Try another selection or chat with DocDaisy.")
                                .font(.appBody(12))
                                .foregroundColor(AppTheme.muted)
                                .multilineTextAlignment(.center)

                            PillButton(title: "Ask DocDaisy", style: .outline) {
                                appState.openDocDaisy = true
                            }
                        }
                    }
                }
            }
        }
    }

    private func filterField<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            TranslatedText(text: label)
                .font(.appBody(12, weight: .semibold))
                .foregroundColor(AppTheme.navy)
            content()
        }
    }

    private var specializationOptions: [String] {
        let values = clinicStore.clinics.flatMap { $0.specializations }
        let unique = Array(Set(values)).sorted()
        return ["all"] + unique
    }

    private var selectedLabel: String {
        selectedSpecialization == "all" ? "All specializations" : selectedSpecialization
    }

    private var filteredClinics: [ClinicProfile] {
        clinicStore.clinics.filter { clinic in
            let specMatch = selectedSpecialization == "all" || clinic.specializations.contains(where: { $0.lowercased() == selectedSpecialization.lowercased() })
            let ratingMatch = clinic.rating >= minRating
            return specMatch && ratingMatch
        }
    }

    private func applyDocDaisyRecommendation() {
        guard let recommendation = appState.docDaisyRecommendedSpecialization?.trimmingCharacters(in: .whitespacesAndNewlines),
              !recommendation.isEmpty else { return }
        let match = specializationOptions.first(where: { $0.caseInsensitiveCompare(recommendation) == .orderedSame })
        selectedSpecialization = match ?? "all"
        if !clinicStore.clinics.isEmpty {
            appState.docDaisyRecommendedSpecialization = nil
        }
    }

    private func distanceForClinic(_ clinic: ClinicProfile) -> Double? {
        guard let userCoordinate = locationModel.activeCoordinates else { return nil }
        guard let placeId = clinic.googlePlaceId, let clinicLocation = clinicLocations[placeId] else { return nil }
        guard let clinicCoordinate = coordinate(from: clinicLocation) else { return nil }
        return DistanceCalculator.kmBetween(userCoordinate, clinicCoordinate)
    }

    private func coordinate(from location: PlaceLocation?) -> CLLocationCoordinate2D? {
        guard let lat = location?.lat, let lng = location?.lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    private func loadClinicLocation(for clinic: ClinicProfile) async {
        guard let placeId = clinic.googlePlaceId, !placeId.isEmpty else { return }
        guard clinicLocations[placeId] == nil else { return }
        guard !loadingClinicLocationIds.contains(placeId) else { return }
        loadingClinicLocationIds.insert(placeId)
        defer { loadingClinicLocationIds.remove(placeId) }
        do {
            if let location = try await addressSearch.fetchPlaceLocation(placeId: placeId) {
                clinicLocations[placeId] = location
            }
        } catch {
        }
    }
}
