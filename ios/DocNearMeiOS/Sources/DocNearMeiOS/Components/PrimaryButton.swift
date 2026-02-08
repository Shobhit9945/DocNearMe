import SwiftUI

struct PrimaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.appBody(14, weight: .semibold))
                .foregroundColor(.white)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity)
                .background(AppTheme.primary)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }
}
