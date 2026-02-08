import SwiftUI

@main
struct DocNearMeApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var clinicStore = ClinicStore()
    @StateObject private var tabRouter = TabRouter()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environmentObject(appState)
                .environmentObject(clinicStore)
                .environmentObject(tabRouter)
        }
    }
}
