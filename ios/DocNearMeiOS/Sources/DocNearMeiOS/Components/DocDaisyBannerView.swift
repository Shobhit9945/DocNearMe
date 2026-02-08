import SwiftUI

struct DocDaisyBannerView: View {
    let action: () -> Void
    var onClose: (() -> Void)? = nil
    var imageSize: CGFloat = 120

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Button(action: action) {
                HStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 6) {
                        TranslatedText(text: "Not sure which clinic to visit?")
                            .font(.appBody(16, weight: .bold))
                            .foregroundColor(.black)
                            .lineLimit(2)
                            .minimumScaleFactor(0.9)
                        Text("DOCDAISY")
                            .font(.appTitle(20, weight: .heavy))
                            .foregroundColor(.clear)
                            .overlay(
                                LinearGradient(
                                    colors: [AppTheme.purple, AppTheme.purpleLight],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                                .mask(
                                    Text("DOCDAISY")
                                        .font(.appTitle(20, weight: .heavy))
                                )
                            )
                        TranslatedText(text: "is here for you!")
                            .font(.appBody(16, weight: .semibold))
                            .foregroundColor(.black)
                            .lineLimit(2)
                            .minimumScaleFactor(0.9)
                        TranslatedText(text: "Click on the banner to ask")
                            .font(.appBody(14, weight: .regular))
                            .foregroundColor(.black)
                            .lineLimit(2)
                            .minimumScaleFactor(0.9)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .layoutPriority(1)
                    .fixedSize(horizontal: false, vertical: true)

                    AsyncImage(url: AppConfig.webBaseURL.appendingPathComponent("docdaisy.png")) { image in
                        image.resizable().scaledToFit()
                    } placeholder: {
                        Image(systemName: "sparkles")
                            .font(.system(size: 36, weight: .bold))
                            .foregroundColor(AppTheme.purple)
                    }
                    .frame(width: imageSize, height: imageSize)
                    .padding(.leading, -8)
                }
                .padding(16)
                .background(Color(red: 0.93, green: 0.91, blue: 1.0))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color(red: 0.23, green: 0.07, blue: 0.86), lineWidth: 1)
                )
                .cornerRadius(14)
                .shadow(color: Color.black.opacity(0.15), radius: 9, x: 0, y: 4)
            }
            .buttonStyle(.plain)

            if let onClose {
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(AppTheme.muted)
                        .frame(width: 24, height: 24)
                        .background(Color.white)
                        .clipShape(Circle())
                        .shadow(color: AppTheme.shadow, radius: 4, x: 0, y: 2)
                }
                .offset(x: 8, y: -8)
            }
        }
    }
}
