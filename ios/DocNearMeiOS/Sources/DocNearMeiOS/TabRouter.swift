import Foundation

@MainActor
final class TabRouter: ObservableObject {
    @Published var selection: RootTab = .home
}
