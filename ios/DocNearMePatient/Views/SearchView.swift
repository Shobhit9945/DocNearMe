import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var appState: AppState
    @State private var query = ""
    @State private var selectedSpecialization = "All"
    @State private var selectedLanguage = "All"
    @State private var doctors: [ClinicDoctor] = []

    var body: some View {
        VStack(spacing: 12) {
            TextField("Search clinics or specializations", text: $query)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 16)

            HStack {
                Picker("Specialization", selection: $selectedSpecialization) {
                    ForEach(specializations, id: \.self) { specialization in
                        Text(specialization).tag(specialization)
                    }
                }
                .pickerStyle(.menu)

                Picker("Language", selection: $selectedLanguage) {
                    ForEach(languages, id: \.self) { language in
                        Text(language).tag(language)
                    }
                }
                .pickerStyle(.menu)
            }
            .padding(.horizontal, 16)

            if filteredClinics.isEmpty {
                ContentUnavailableView("No clinics found", systemImage: "magnifyingglass")
            } else {
                List(filteredClinics) { clinic in
                    NavigationLink {
                        ClinicDetailView(clinic: clinic)
                    } label: {
                        ClinicRow(clinic: clinic)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Search")
        .task {
            await appState.loadClinics()
            await loadDoctors()
        }
    }

    private func loadDoctors() async {
        do {
            let response: ClinicDoctorsResponse = try await APIClient.shared.request("/api/clinics/doctors")
            doctors = response.doctors
        } catch {
            appState.errorMessage = error.localizedDescription
        }
    }

    private var specializations: [String] {
        let list = appState.clinics.flatMap { $0.specializations }
        return ["All"] + Array(Set(list)).sorted()
    }

    private var languages: [String] {
        let list = doctors.flatMap { $0.languages }
        return ["All"] + Array(Set(list)).sorted()
    }

    private var filteredClinics: [ClinicProfile] {
        appState.clinics.filter { clinic in
            let matchesQuery = query.isEmpty ||
                clinic.name.localizedCaseInsensitiveContains(query) ||
                clinic.location.localizedCaseInsensitiveContains(query) ||
                clinic.specializations.contains(where: { $0.localizedCaseInsensitiveContains(query) })
            let matchesSpecialization = selectedSpecialization == "All" ||
                clinic.specializations.contains(selectedSpecialization)
            let matchesLanguage = selectedLanguage == "All" ||
                doctors.filter { $0.clinicId == clinic.id }
                    .flatMap { $0.languages }
                    .contains(selectedLanguage)
            return matchesQuery && matchesSpecialization && matchesLanguage
        }
    }
}

private struct ClinicRow: View {
    let clinic: ClinicProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(clinic.name)
                .font(.headline)
            Text(clinic.location)
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                Label(clinic.distance, systemImage: "location")
                Label(String(format: "%.1f", clinic.rating), systemImage: "star.fill")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    NavigationStack {
        SearchView()
            .environmentObject(AppState())
    }
}
