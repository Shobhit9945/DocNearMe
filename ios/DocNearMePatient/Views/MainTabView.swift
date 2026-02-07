import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                HomeView()
            }
            .tabItem {
                Label("Home", systemImage: "house")
            }

            NavigationStack {
                SearchView()
            }
            .tabItem {
                Label("Search", systemImage: "magnifyingglass")
            }

            NavigationStack {
                AppointmentsView()
            }
            .tabItem {
                Label("Visits", systemImage: "calendar")
            }

            NavigationStack {
                RecordsView()
            }
            .tabItem {
                Label("Records", systemImage: "doc.text")
            }

            NavigationStack {
                ProfileView()
            }
            .tabItem {
                Label("Profile", systemImage: "person")
            }
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(AppState())
}
