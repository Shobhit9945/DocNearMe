import SwiftUI

struct PillButton: View {
    enum Style {
        case primary
        case outline
        case subtle
        case danger
    }

    let title: String
    let style: Style
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            TranslatedText(text: title)
                .font(.appBody(12, weight: .semibold))
                .foregroundColor(foreground)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(background)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(border, lineWidth: style == .outline ? 1 : 0)
                )
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }

    private var foreground: Color {
        switch style {
        case .primary: return .white
        case .outline: return AppTheme.primary
        case .subtle: return AppTheme.navy
        case .danger: return .white
        }
    }

    private var background: Color {
        switch style {
        case .primary: return AppTheme.primary
        case .outline: return .clear
        case .subtle: return AppTheme.lightBlue
        case .danger: return AppTheme.danger
        }
    }

    private var border: Color {
        switch style {
        case .outline: return AppTheme.primary
        default: return .clear
        }
    }
}
