import SwiftUI

struct RootTabView: View {
    @EnvironmentObject private var tabRouter: TabRouter
    @EnvironmentObject private var appState: AppState

    init() {
        UITabBar.appearance().isHidden = true
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $tabRouter.selection) {
                NavigationStack {
                    HomeView()
                }
                .tag(RootTab.home)

                NavigationStack {
                    SearchView()
                }
                .tag(RootTab.search)

                NavigationStack {
                    ClinicsView()
                }
                .tag(RootTab.clinics)

                NavigationStack {
                    AppointmentView()
                }
                .tag(RootTab.appointment)

                NavigationStack {
                    ProfileView()
                }
                .tag(RootTab.profile)
            }
            .tint(AppTheme.primary)

            TabBarView(selection: $tabRouter.selection)
        }
        .sheet(isPresented: $appState.openDocDaisy) {
            NavigationStack {
                DocDaisyView()
            }
        }
        .onChange(of: appState.openDocDaisy) { _, isOpen in
            guard !isOpen, let pending = appState.pendingTabSelection else { return }
            tabRouter.selection = pending
            appState.pendingTabSelection = nil
        }
    }
}
