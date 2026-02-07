import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var showDocDaisy = false

    private let steps: [String] = [
        "Search by specialization or symptoms.",
        "Request a visit that fits your schedule.",
        "Share medical info only if you want.",
        "We keep you updated before your visit.",
        "Pay directly at the clinic."
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Welcome back, \(appState.profile?.name ?? "")")
                    .font(.title2.weight(.semibold))

                InfoCard(title: "Your privacy comes first", message: "DocNearMe encrypts shared data and never sells your information.")

                HStack(spacing: 12) {
                    ActionCard(title: "Book a visit", subtitle: "Find a doctor", systemImage: "calendar.badge.plus") {
                        // Navigation handled in tab
                    }
                    ActionCard(title: "Medical vault", subtitle: "View records", systemImage: "doc.text.magnifyingglass") {
                        // Navigation handled in tab
                    }
                }

                Button {
                    showDocDaisy = true
                } label: {
                    HStack {
                        Image(systemName: "sparkles")
                        Text("Ask DocDaisy")
                        Spacer()
                        Image(systemName: "chevron.right")
                    }
                }
                .buttonStyle(.bordered)

                VStack(alignment: .leading, spacing: 12) {
                    Text("How visits work")
                        .font(.headline)
                    ForEach(steps.indices, id: \.self) { index in
                        HStack(alignment: .top, spacing: 12) {
                            Text("\(index + 1)")
                                .font(.caption.weight(.bold))
                                .frame(width: 24, height: 24)
                                .background(Circle().fill(Color.teal.opacity(0.2)))
                            Text(steps[index])
                                .font(.subheadline)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Next appointment")
                        .font(.headline)
                    if let appointment = appState.appointments.first {
                        AppointmentRow(
                            appointment: appointment,
                            clinicName: appState.clinics.first(where: { $0.id == appointment.clinicId })?.name
                        )
                    } else {
                        Text("No upcoming visits yet.")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(20)
        }
        .navigationTitle("Home")
        .task {
            await appState.refreshAll()
        }
        .sheet(isPresented: $showDocDaisy) {
            NavigationStack {
                DocDaisyView()
            }
        }
    }
}

#Preview {
    NavigationStack {
        HomeView()
            .environmentObject(AppState())
    }
}
