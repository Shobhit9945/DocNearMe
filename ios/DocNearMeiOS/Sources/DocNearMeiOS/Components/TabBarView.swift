import SwiftUI

enum RootTab: Int, CaseIterable {
    case home
    case search
    case clinics
    case appointment
    case profile

    var title: String {
        switch self {
        case .home: return "Home"
        case .search: return "Search"
        case .clinics: return "Clinics"
        case .appointment: return "Appointment"
        case .profile: return "Profile"
        }
    }

    var systemImage: String {
        switch self {
        case .home: return "house"
        case .search: return "magnifyingglass"
        case .clinics: return "building.2"
        case .appointment: return "calendar"
        case .profile: return "person"
        }
    }
}

struct TabBarView: View {
    @Binding var selection: RootTab

    var body: some View {
        VStack(spacing: 0) {
            Divider().background(AppTheme.border)
            HStack {
                ForEach(RootTab.allCases, id: \.self) { tab in
                    Button {
                        selection = tab
                    } label: {
                        VStack(spacing: 6) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(selection == tab ? AppTheme.tabHighlight : Color.clear)
                                    .frame(width: 32, height: 32)
                                Image(systemName: tab.systemImage)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(selection == tab ? AppTheme.primary : AppTheme.muted)
                            }
                            TranslatedText(text: tab.title)
                                .font(.appBody(10, weight: selection == tab ? .semibold : .regular))
                                .foregroundColor(selection == tab ? AppTheme.primary : AppTheme.muted)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 12)
            .background(AppTheme.tabBackground.opacity(0.95))
            .background(.ultraThinMaterial)
        }
    }
}
