import SwiftUI

enum AppTheme {
    static let background = Color(red: 0.98, green: 0.98, blue: 1.0)
    static let foreground = Color(red: 0.0, green: 0.18, blue: 0.33)
    static let primary = Color(red: 0.09, green: 0.28, blue: 0.81)
    static let accent = Color(red: 0.0, green: 0.54, blue: 1.0)
    static let muted = Color(red: 0.55, green: 0.61, blue: 0.68)
    static let card = Color.white
    static let border = Color(red: 0.84, green: 0.92, blue: 1.0)
    static let surface = Color(red: 0.96, green: 0.97, blue: 0.99)

    static let navy = Color(red: 0.0, green: 0.18, blue: 0.33)
    static let purple = Color(red: 0.23, green: 0.07, blue: 0.86)
    static let purpleLight = Color(red: 0.49, green: 0.33, blue: 1.0)
    static let lightBlue = Color(red: 0.91, green: 0.95, blue: 1.0)
    static let softPurple = Color(red: 0.95, green: 0.93, blue: 1.0)
    static let warning = Color(red: 0.69, green: 0.42, blue: 0.0)
    static let warningLight = Color(red: 1.0, green: 0.95, blue: 0.78)
    static let danger = Color(red: 0.98, green: 0.31, blue: 0.31)
    static let tabBackground = Color.white
    static let tabHighlight = Color(red: 0.96, green: 0.98, blue: 1.0)
    static let shadow = Color.black.opacity(0.06)
    static let shadowStrong = Color.black.opacity(0.15)
}

extension Font {
    static func appTitle(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .custom(montserratName(for: weight), size: size)
    }

    static func appBody(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom(montserratName(for: weight), size: size)
    }

    private static func montserratName(for weight: Font.Weight) -> String {
        switch weight {
        case .black, .heavy:
            return "Montserrat-ExtraBold"
        case .bold:
            return "Montserrat-Bold"
        case .semibold:
            return "Montserrat-SemiBold"
        case .medium:
            return "Montserrat-Medium"
        default:
            return "Montserrat-Regular"
        }
    }
}
