import CoreLocation
import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var tabRouter: TabRouter
    @StateObject private var viewModel = SearchViewModel()
    @StateObject private var addressSearch = AddressSearchViewModel()

    @State private var query = ""
    @State private var specializationFilter = "all"
    @State private var languageFilter = "all"
    @State private var distanceFilter = "any"
    @State private var resultType: ResultType = .all
    @State private var locationInput = ""
    @State private var showLocationSuggestions = false
    @State private var selectedLocation: PlaceLocation? = nil
    @State private var clinicLocations: [String: PlaceLocation] = [:]
    @State private var loadingClinicLocationIds: Set<String> = []

    enum ResultType: String, CaseIterable {
        case all = "All"
        case doctor = "Doctors"
        case clinic = "Clinics"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                filterCard
                resultsSection
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
            await viewModel.load()
            await prefetchClinicLocations()
        }
        .onChange(of: distanceFilter) { _, _ in
            Task { await prefetchClinicLocations() }
        }
        .onChange(of: selectedLocation) { _, _ in
            Task { await prefetchClinicLocations() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            TranslatedText(text: "Search")
                .font(.appTitle(24))
                .foregroundColor(AppTheme.navy)
            TranslatedText(text: "specialists, clinics and hospitals nearby.")
                .font(.appBody(12))
                .foregroundColor(AppTheme.muted)
        }
    }

    private var filterCard: some View {
        SectionCard(padding: 20) {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        TranslatedText(text: "Find care fast")
                            .font(.appTitle(18))
                            .foregroundColor(AppTheme.navy)
                        TranslatedText(text: "Search by doctor, clinic, or specialization in Beppu.")
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                    }
                    Spacer()
                    ShadowBadge(
                        text: "\(visibleDoctors.count + visibleClinics.count) matches",
                        icon: "sparkles",
                        background: AppTheme.lightBlue,
                        foreground: AppTheme.primary
                    )
                }

                VStack(spacing: 12) {
                    filterField(label: "Location") {
                        VStack(alignment: .leading, spacing: 6) {
                            TextField("Enter city or address", text: $locationInput)
                                .textFieldStyle(.roundedBorder)
                                .onChange(of: locationInput) { _, newValue in
                                    selectedLocation = nil
                                    showLocationSuggestions = true
                                    Task { await addressSearch.fetchSuggestions(input: newValue) }
                                }

                            if showLocationSuggestions {
                                VStack(alignment: .leading, spacing: 0) {
                                    if addressSearch.isLoading {
                                        TranslatedText(text: "Searching locations...")
                                            .font(.appBody(11))
                                            .foregroundColor(AppTheme.muted)
                                            .padding(8)
                                    } else if !addressSearch.errorMessage.isEmpty {
                                        Text(addressSearch.errorMessage)
                                            .font(.appBody(11))
                                            .foregroundColor(.red)
                                            .padding(8)
                                    } else {
                                        ForEach(addressSearch.suggestions) { suggestion in
                                            Button(suggestion.description) {
                                                Task {
                                                    do {
                                                        let payload = try await addressSearch.fetchPlaceDetails(placeId: suggestion.placeId)
                                                        locationInput = payload.address
                                                        selectedLocation = payload.location
                                                        showLocationSuggestions = false
                                                    } catch {
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
                        }
                    }

                    filterField(label: "Search term") {
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(AppTheme.muted)
                            TextField("Search doctors, clinics, or services", text: $query)
                                .textFieldStyle(.plain)
                        }
                        .padding(10)
                        .background(Color.white)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(AppTheme.border, lineWidth: 1)
                        )
                    }

                    filterField(label: "Specialization") {
                        Picker("Specialization", selection: $specializationFilter) {
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

                    filterField(label: "Language") {
                        Picker("Language", selection: $languageFilter) {
                            ForEach(languageOptions, id: \.self) { value in
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

                    filterField(label: "Distance") {
                        Picker("Distance", selection: $distanceFilter) {
                            ForEach(["any", "2", "5", "10", "20"], id: \.self) { value in
                                TranslatedText(text: distanceLabel(value)).tag(value)
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

                    filterField(label: "Result type") {
                        HStack(spacing: 8) {
                            ForEach(ResultType.allCases, id: \.self) { option in
                                Button {
                                    resultType = option
                                } label: {
                                    TranslatedText(text: option.rawValue)
                                        .font(.appBody(11, weight: .semibold))
                                        .padding(.vertical, 8)
                                        .frame(maxWidth: .infinity)
                                        .background(resultType == option ? AppTheme.navy : Color.white)
                                        .foregroundColor(resultType == option ? .white : AppTheme.muted)
                                        .cornerRadius(16)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                                .stroke(AppTheme.border, lineWidth: resultType == option ? 0 : 1)
                                        )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private var resultsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            if viewModel.isLoading {
                LoadingCard(title: "Loading search", subtitle: "Preparing clinics and doctors for you.")
            } else if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.appBody(12))
                    .foregroundColor(.red)
            } else {
                if !visibleDoctors.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        TranslatedText(text: "Doctors")
                            .font(.appTitle(16))
                            .foregroundColor(AppTheme.navy)
                        ForEach(visibleDoctors) { doctor in
                            DoctorCardView(doctor: doctor, clinicName: clinicName(for: doctor.clinicId)) {
                                tabRouter.selection = .clinics
                            } onBook: {
                                tabRouter.selection = .appointment
                            }
                        }
                    }
                }

                if !visibleClinics.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        TranslatedText(text: "Clinics")
                            .font(.appTitle(16))
                            .foregroundColor(AppTheme.navy)
                        ForEach(visibleClinics) { clinic in
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
        let values = viewModel.clinics.flatMap { $0.specializations }
        let unique = Array(Set(values)).sorted()
        return ["all"] + unique
    }

    private var languageOptions: [String] {
        let values = viewModel.doctors.flatMap { $0.languages }
        let unique = Array(Set(values)).sorted()
        return ["all"] + unique
    }

    private var filteredDoctors: [ClinicDoctor] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return viewModel.doctors.filter { doctor in
            let clinicName = clinicName(for: doctor.clinicId).lowercased()
            let matchesQuery = normalizedQuery.isEmpty || doctor.name.lowercased().contains(normalizedQuery) ||
                doctor.specialization.lowercased().contains(normalizedQuery) || clinicName.contains(normalizedQuery)
            let matchesSpec = specializationFilter == "all" || doctor.specialization.lowercased().contains(specializationFilter.lowercased())
            let matchesLang = languageFilter == "all" || doctor.languages.contains(where: { $0.lowercased() == languageFilter.lowercased() })
            return matchesQuery && matchesSpec && matchesLang
        }
    }

    private var filteredClinics: [ClinicProfile] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return viewModel.clinics.filter { clinic in
            let matchesQuery = normalizedQuery.isEmpty || clinic.name.lowercased().contains(normalizedQuery) ||
                clinic.location.lowercased().contains(normalizedQuery) ||
                clinic.specializations.contains(where: { $0.lowercased().contains(normalizedQuery) })
            let matchesSpec = specializationFilter == "all" || clinic.specializations.contains(where: { $0.lowercased().contains(specializationFilter.lowercased()) })
            let matchesLang = languageFilter == "all" || clinicLanguages[clinic.id, default: []].contains(languageFilter.lowercased())
            let matchesDistance: Bool = {
                guard let limit = distanceLimitKm else { return true }
                guard let distance = distanceForClinic(clinic) else { return false }
                return distance <= limit
            }()
            return matchesQuery && matchesSpec && matchesLang && matchesDistance
        }
    }

    private var visibleDoctors: [ClinicDoctor] {
        resultType == .clinic ? [] : filteredDoctors
    }

    private var visibleClinics: [ClinicProfile] {
        resultType == .doctor ? [] : filteredClinics
    }

    private var clinicLanguages: [String: Set<String>] {
        var map: [String: Set<String>] = [:]
        for doctor in viewModel.doctors {
            var set = map[doctor.clinicId] ?? []
            doctor.languages.forEach { set.insert($0.lowercased()) }
            map[doctor.clinicId] = set
        }
        return map
    }

    private func clinicName(for clinicId: String) -> String {
        viewModel.clinics.first(where: { $0.id == clinicId })?.name ?? "Clinic"
    }

    private var distanceLimitKm: Double? {
        guard selectedLocation != nil else { return nil }
        switch distanceFilter {
        case "2": return 2
        case "5": return 5
        case "10": return 10
        case "20": return 20
        default: return nil
        }
    }

    private func distanceLabel(_ value: String) -> String {
        switch value {
        case "2": return "Within 2 km"
        case "5": return "Within 5 km"
        case "10": return "Within 10 km"
        case "20": return "Within 20 km"
        default: return "Any distance"
        }
    }

    private func distanceForClinic(_ clinic: ClinicProfile) -> Double? {
        guard let userCoordinate = coordinate(from: selectedLocation) else { return nil }
        guard let placeId = clinic.googlePlaceId, let clinicLocation = clinicLocations[placeId] else { return nil }
        guard let clinicCoordinate = coordinate(from: clinicLocation) else { return nil }
        return DistanceCalculator.kmBetween(userCoordinate, clinicCoordinate)
    }

    private func coordinate(from location: PlaceLocation?) -> CLLocationCoordinate2D? {
        guard let lat = location?.lat, let lng = location?.lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    private func prefetchClinicLocations() async {
        guard distanceLimitKm != nil else { return }
        for clinic in viewModel.clinics {
            await loadClinicLocation(for: clinic)
        }
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

struct DoctorCardView: View {
    let doctor: ClinicDoctor
    let clinicName: String
    let onView: () -> Void
    let onBook: () -> Void

    var body: some View {
        SectionCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(doctor.name)
                            .font(.appTitle(16))
                            .foregroundColor(AppTheme.navy)
                        TranslatedText(text: doctor.specialization)
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                        Text(clinicName)
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                    }
                    Spacer()
                    ShadowBadge(
                        text: String(format: "%.1f", doctor.rating),
                        icon: "star.fill",
                        background: AppTheme.warningLight,
                        foreground: AppTheme.warning
                    )
                }

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 80), spacing: 8)], alignment: .leading, spacing: 8) {
                    ForEach(doctor.languages, id: \.self) { language in
                        ChipView(text: language)
                    }
                }

                TranslatedText(text: "Next availability: \(doctor.nextAvailable)")
                    .font(.appBody(12))
                    .foregroundColor(AppTheme.muted)

                HStack(spacing: 10) {
                    PillButton(title: "View clinic", style: .outline, action: onView)
                    PillButton(title: "Book appointment", style: .primary, action: onBook)
                }
            }
        }
    }
}
