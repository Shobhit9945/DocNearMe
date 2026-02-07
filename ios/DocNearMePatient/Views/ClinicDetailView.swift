import SwiftUI

struct ClinicDetailView: View {
    @EnvironmentObject private var appState: AppState
    let clinic: ClinicProfile
    @State private var doctors: [ClinicDoctor] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(clinic.name)
                        .font(.title2.weight(.bold))
                    Text(clinic.location)
                        .foregroundStyle(.secondary)
                    HStack {
                        Label(String(format: "%.1f", clinic.rating), systemImage: "star.fill")
                        Text("·")
                        Label(clinic.distance, systemImage: "location")
                        Text("·")
                        Text(clinic.nextAvailability)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Specializations")
                        .font(.headline)
                    WrapTags(tags: clinic.specializations)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Doctors")
                        .font(.headline)
                    if doctors.isEmpty {
                        Text("No doctors listed yet.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(doctors) { doctor in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(doctor.name)
                                    .font(.subheadline.weight(.semibold))
                                Text(doctor.specialization)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text("Next available: \(doctor.nextAvailable)")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
                        }
                    }
                }

                NavigationLink {
                    AppointmentsView(preselectedClinic: clinic)
                } label: {
                    Text("Request a visit")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(20)
        }
        .navigationTitle("Clinic")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadDoctors()
        }
    }

    private func loadDoctors() async {
        do {
            let response: ClinicDoctorsResponse = try await APIClient.shared.request("/api/clinics/\(clinic.id)/doctors")
            doctors = response.doctors
        } catch {
            appState.errorMessage = error.localizedDescription
        }
    }
}

private struct WrapTags: View {
    let tags: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], spacing: 8) {
            ForEach(tags, id: \.self) { tag in
                Text(tag)
                    .font(.caption)
                    .padding(.vertical, 6)
                    .padding(.horizontal, 10)
                    .background(Capsule().fill(Color.teal.opacity(0.15)))
            }
        }
    }
}

#Preview {
    NavigationStack {
        ClinicDetailView(clinic: ClinicProfile(
            id: "preview",
            name: "Preview Clinic",
            type: "Clinic",
            rating: 4.6,
            patients: "120",
            distance: "2.1 km",
            location: "Tokyo",
            image: "",
            specializations: ["Family Medicine"],
            nextAvailability: "Tomorrow",
            immediateWoundCare: false,
            googlePlaceId: nil,
            phone: nil,
            email: nil
        ))
        .environmentObject(AppState())
    }
}
