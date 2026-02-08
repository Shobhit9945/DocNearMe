import CoreLocation
import SwiftUI
import UIKit

struct HeroSlide: Identifiable {
    let id = UUID()
    let title: String
    let headline: String
    let description: String
    let cta: String
    let imagePath: String
    let gradient: [Color]
    let action: (() -> Void)?
}

struct HowVisitStep: Identifiable {
    let id = UUID()
    let title: String
    let body: String
    let helper: String?
    let note: String?
    let usesTrustChip: Bool
}

struct StepBodyView: View {
    let text: String

    var body: some View {
        let parts = text
            .split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        if parts.count <= 1 {
            TranslatedText(text: text)
                .font(.appBody(13))
                .foregroundColor(AppTheme.muted)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(parts.indices, id: \.self) { index in
                    HStack(alignment: .top, spacing: 8) {
                        Circle()
                            .fill(AppTheme.muted)
                            .frame(width: 6, height: 6)
                            .padding(.top, 6)
                        TranslatedText(text: String(parts[index]))
                            .font(.appBody(13))
                            .foregroundColor(AppTheme.muted)
                    }
                }
            }
        }
    }
}

struct NoteChipView: View {
    let text: String
    let usesTrustStyle: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: usesTrustStyle ? "lock.fill" : "info.circle.fill")
                .foregroundColor(usesTrustStyle ? AppTheme.primary : AppTheme.muted)
            TranslatedText(text: text)
                .font(.appBody(11))
                .foregroundColor(AppTheme.muted)
        }
        .padding(12)
        .background(usesTrustStyle ? Color(red: 0.95, green: 0.96, blue: 1.0) : Color(red: 0.97, green: 0.97, blue: 0.98))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
    }
}

struct HomeView: View {
    @EnvironmentObject private var tabRouter: TabRouter
    @EnvironmentObject private var appState: AppState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @StateObject private var locationModel = LocationViewModel()
    @StateObject private var addressSearch = AddressSearchViewModel()

    @State private var isEditingLocation = false
    @State private var manualInput = ""
    @State private var showSuggestions = false
    @State private var manualError = ""
    @State private var currentSlide = 0
    @State private var isResolvingAddress = false
    @State private var showDocDaisyBanner = true
    @State private var showLoginPrompt = false
    @State private var showHowVisits = false
    @State private var howVisitStep = 0
    @AppStorage("dnm_login_prompted") private var hasPromptedLogin = false

    private let timer = Timer.publish(every: 5, on: .main, in: .common).autoconnect()

    private var isCompactWidth: Bool {
        horizontalSizeClass == .compact
    }

    var body: some View {
        GeometryReader { proxy in
            let metrics = HomeMetrics(size: proxy.size, safeArea: proxy.safeAreaInsets, isCompactWidth: isCompactWidth)

            ScrollView {
                VStack(spacing: 16) {
                    headerSection(metrics: metrics)
                        .frame(maxWidth: metrics.contentMaxWidth, alignment: .center)

                    VStack(alignment: .leading, spacing: 20) {
                        heroCarousel(metrics: metrics)
                        quickActions(metrics: metrics)
                        saveTimeBanner(metrics: metrics)
                    }
                    .frame(maxWidth: metrics.contentMaxWidth, alignment: .leading)
                    .padding(.horizontal, metrics.horizontalPadding)
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, metrics.contentBottomPadding + (showDocDaisyBanner ? metrics.bannerInsetHeight : 0))
            }
            .frame(width: proxy.size.width, alignment: .center)
            .clipped()
            .background(AppTheme.background.ignoresSafeArea())
            .overlay(alignment: .bottom) {
                if showDocDaisyBanner {
                    DocDaisyBannerView(action: {
                        appState.openDocDaisy = true
                    }, onClose: {
                        showDocDaisyBanner = false
                    }, imageSize: metrics.docDaisyImageSize)
                    .frame(maxWidth: metrics.contentMaxWidth, alignment: .center)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, metrics.bannerBottomPadding)
                    .transition(.scale)
                }
            }
            .safeAreaInset(edge: .bottom) { Color.clear.frame(height: 0) }
            .sheet(isPresented: $showLoginPrompt) {
                LoginPromptSheet(onLater: {
                    showLoginPrompt = false
                }, onLogin: {
                    showLoginPrompt = false
                    tabRouter.selection = .profile
                })
            }
            .sheet(isPresented: $showHowVisits) {
                HowVisitsSheet(
                    steps: howVisitSteps,
                    currentStep: $howVisitStep,
                    onClose: {
                        showHowVisits = false
                        howVisitStep = 0
                    },
                    onPrimaryAction: {
                        showHowVisits = false
                        howVisitStep = 0
                        tabRouter.selection = .appointment
                    },
                    onDocDaisy: {
                        showHowVisits = false
                        howVisitStep = 0
                        appState.openDocDaisy = true
                    }
                )
                .presentationDetents([.medium, .large])
            }
            .onAppear {
                if appState.authToken == nil && !hasPromptedLogin {
                    showLoginPrompt = true
                    hasPromptedLogin = true
                }
            }
        }
    }

    private func headerSection(metrics: HomeMetrics) -> some View {
        ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 12) {
                LocationCardView(
                    title: "Live location",
                    location: locationModel.currentLocation,
                    status: locationModel.errorMessage.isEmpty ? locationModel.statusText : locationModel.errorMessage,
                    isManual: locationModel.manualLocation != nil,
                    editLabel: locationModel.manualLocation != nil ? "Edit address" : "Enter address manually",
                    onEdit: { isEditingLocation = true },
                    onUseGPS: {
                        isEditingLocation = false
                        locationModel.clearManualLocation()
                    }
                )
                .frame(maxWidth: .infinity, alignment: .center)

                if isEditingLocation {
                    VStack(alignment: .leading, spacing: 10) {
                        TextField("Type your address", text: $manualInput)
                            .font(.appBody(14))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Color.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                            )
                            .onChange(of: manualInput) { _, newValue in
                                showSuggestions = true
                                Task { await addressSearch.fetchSuggestions(input: newValue) }
                            }

                        Button(action: {
                            Task {
                                isResolvingAddress = true
                                defer { isResolvingAddress = false }
                                do {
                                    let formatted = try await addressSearch.geocodeAddress(manualInput)
                                    locationModel.setManualLocation(formatted, coordinates: nil)
                                    manualInput = formatted
                                    manualError = ""
                                    isEditingLocation = false
                                    showSuggestions = false
                                } catch {
                                    manualError = error.localizedDescription
                                }
                            }
                        }) {
                            Text(isResolvingAddress ? "Searching..." : "Save")
                                .font(.appBody(12, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(Color(red: 0.0, green: 0.18, blue: 0.33))
                                .cornerRadius(12)
                                .shadow(color: Color(red: 0.06, green: 0.15, blue: 0.29).opacity(0.18), radius: 6, x: 0, y: 3)
                        }
                        .disabled(isResolvingAddress)

                        if showSuggestions {
                            VStack(alignment: .leading, spacing: 0) {
                                if addressSearch.isLoading {
                                    TranslatedText(text: "Searching address results...")
                                                                .font(.appBody(11))
                                        .foregroundColor(AppTheme.muted)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                } else if !addressSearch.errorMessage.isEmpty {
                                    Text(addressSearch.errorMessage)
                                        .font(.appBody(11))
                                        .foregroundColor(.red)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                } else if addressSearch.suggestions.isEmpty, !manualInput.isEmpty {
                                    TranslatedText(text: "No matching addresses yet.")
                                        .font(.appBody(11))
                                        .foregroundColor(AppTheme.muted)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                } else {
                                    ForEach(addressSearch.suggestions) { suggestion in
                                        Button(suggestion.description) {
                                            Task {
                                                do {
                                                    isResolvingAddress = true
                                                    let payload = try await addressSearch.fetchPlaceDetails(placeId: suggestion.placeId)
                                                    locationModel.setManualLocation(payload.address, coordinates: coordinate(from: payload.location))
                                                    manualInput = payload.address
                                                    manualError = ""
                                                    isEditingLocation = false
                                                    showSuggestions = false
                                                    isResolvingAddress = false
                                                } catch {
                                                    isResolvingAddress = false
                                                    manualError = error.localizedDescription
                                                }
                                            }
                                        }
                                        .font(.appBody(12))
                                        .foregroundColor(AppTheme.navy)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 10)
                                    }
                                }
                            }
                            .background(Color.white)
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Color(red: 0.89, green: 0.91, blue: 0.94), lineWidth: 1)
                            )
                            .shadow(color: Color.black.opacity(0.06), radius: 8, x: 0, y: 6)
                        }

                        if !manualError.isEmpty {
                            Text(manualError)
                                .font(.appBody(11))
                                .foregroundColor(.red)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, metrics.horizontalPadding)
            .padding(.top, metrics.headerTopPadding)
            .padding(.bottom, metrics.headerBottomPadding)
            .background(Color.white)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(Color(red: 0.95, green: 0.96, blue: 0.97))
                    .frame(height: 1)
            }
            .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)

            LanguageSwitcherView()
                .padding(.top, metrics.languageSwitcherTopPadding)
                .padding(.trailing, metrics.horizontalPadding)
        }
    }

    private func heroCarousel(metrics: HomeMetrics) -> some View {
        TabView(selection: $currentSlide) {
            ForEach(Array(slides.enumerated()), id: \.offset) { index, slide in
                VStack(alignment: .leading, spacing: 10) {
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .top, spacing: 12) {
                            heroTextStack(for: slide)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            VStack(alignment: .trailing, spacing: 10) {
                                heroImage(for: slide, size: metrics.heroImageSize)
                                Button(action: { slide.action?() }) {
                                    Text(slide.cta)
                                        .font(.appBody(11, weight: .semibold))
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(Color(red: 0.0, green: 0.18, blue: 0.33))
                                        .cornerRadius(12)
                                        .shadow(color: Color(red: 0.06, green: 0.15, blue: 0.29).opacity(0.15), radius: 6, x: 0, y: 3)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            heroTextStack(for: slide)
                            HStack(alignment: .center, spacing: 12) {
                                heroImage(for: slide, size: metrics.heroImageSize)
                                Button(action: { slide.action?() }) {
                                    Text(slide.cta)
                                        .font(.appBody(11, weight: .semibold))
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(Color(red: 0.0, green: 0.18, blue: 0.33))
                                        .cornerRadius(12)
                                        .shadow(color: Color(red: 0.06, green: 0.15, blue: 0.29).opacity(0.15), radius: 6, x: 0, y: 3)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, minHeight: metrics.heroMinHeight)
                .background(
                    LinearGradient(colors: slide.gradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(Color(red: 0.83, green: 0.92, blue: 1.0), lineWidth: 1)
                )
                .cornerRadius(20)
                .shadow(color: Color(red: 0.87, green: 0.91, blue: 0.93).opacity(0.8), radius: 7, x: 0, y: 1)
                .padding(.horizontal, 2)
                .tag(index)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: metrics.heroHeight)
        .tabViewStyle(PageTabViewStyle(indexDisplayMode: .automatic))
        .onReceive(timer) { _ in
            withAnimation {
                currentSlide = (currentSlide + 1) % slides.count
            }
        }
    }

    private func quickActions(metrics: HomeMetrics) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            QuickActionTile(title: "Book Appointment", systemImage: "clipboard", background: AppTheme.accent, minHeight: metrics.quickActionMinHeight) {
                appState.appointmentEntryMode = "booking"
                tabRouter.selection = .appointment
            }
            QuickActionTile(title: "View Appointments", systemImage: "list.bullet.rectangle", background: AppTheme.accent, minHeight: metrics.quickActionMinHeight) {
                appState.appointmentEntryMode = "upcoming"
                tabRouter.selection = .appointment
            }
            QuickActionTile(title: "Medical Records", systemImage: "heart.text.square", background: AppTheme.accent, minHeight: metrics.quickActionMinHeight) {
                appState.openMedicalRecords = true
                tabRouter.selection = .profile
            }
            QuickActionTile(title: "Emergency SOS", systemImage: "cross.case.fill", background: AppTheme.danger, minHeight: metrics.quickActionMinHeight) {
                if let url = URL(string: "tel:119") {
                    UIApplication.shared.open(url)
                }
            }
        }
    }

    private var slides: [HeroSlide] {
        [
            HeroSlide(
                title: "APPOINTMENT BOOKING NOW AT YOUR FINGERTIPS",
                headline: "WITH DOCNEARME",
                description: "Plan, book and manage visits in seconds.",
                cta: "Learn more",
                imagePath: "applogo.png",
                gradient: [Color(red: 0.98, green: 0.98, blue: 1.0), Color(red: 0.88, green: 0.96, blue: 1.0)],
                action: {
                    howVisitStep = 0
                    showHowVisits = true
                }
            ),
            HeroSlide(
                title: "YOUR HEALTH, YOUR SCHEDULE",
                headline: "FAST CLINIC MATCHING",
                description: "Find nearby clinics and specialists instantly.",
                cta: "Find clinics",
                imagePath: "https://api.builder.io/api/v1/image/assets/TEMP/efd1a0a0a615de8dfe2ff92c5e5efa34e4764d7a?width=584",
                gradient: [Color(red: 0.96, green: 0.98, blue: 1.0), Color(red: 0.86, green: 0.95, blue: 1.0)],
                action: {
                    tabRouter.selection = .clinics
                }
            ),
            HeroSlide(
                title: "CARE THAT MOVES WITH YOU",
                headline: "DOCDAISY SUPPORT",
                description: "Ask questions and get guidance in real time.",
                cta: "Ask DocDaisy",
                imagePath: "docdaisy.png",
                gradient: [Color(red: 0.98, green: 0.97, blue: 1.0), Color(red: 0.91, green: 0.91, blue: 1.0)],
                action: {
                    appState.openDocDaisy = true
                }
            ),
        ]
    }

    private func imageURL(for path: String) -> URL? {
        if path.hasPrefix("http") {
            return URL(string: path)
        }
        return AppConfig.webBaseURL.appendingPathComponent(path)
    }

    private func coordinate(from location: PlaceLocation?) -> CLLocationCoordinate2D? {
        guard let lat = location?.lat, let lng = location?.lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    private func saveTimeBanner(metrics: HomeMetrics) -> some View {
        VStack(alignment: .center, spacing: 12) {
            TranslatedText(text: "SAVE TIME BY AVOIDING LONG QUEUES")
                .font(.appTitle(16))
                .foregroundColor(.black)
            TranslatedText(text: "BOOK YOUR APPOINTMENT WITH THE DOCTOR YOU NEED")
                .font(.appBody(14))
                .foregroundColor(.black)
            AsyncImage(url: URL(string: "https://api.builder.io/api/v1/image/assets/TEMP/efd1a0a0a615de8dfe2ff92c5e5efa34e4764d7a?width=584")) { image in
                image.resizable().scaledToFit()
            } placeholder: {
                Rectangle().fill(AppTheme.border)
            }
            .frame(maxWidth: .infinity)
            .frame(height: metrics.bannerImageHeight)
            .clipped()
            .cornerRadius(16)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [Color(red: 0.98, green: 0.98, blue: 1.0), Color(red: 0.83, green: 0.96, blue: 1.0)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .cornerRadius(20)
    }

    private func heroTextStack(for slide: HeroSlide) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            TranslatedText(text: slide.title)
                .font(.appBody(11, weight: .bold))
                .foregroundColor(AppTheme.navy)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            TranslatedText(text: slide.headline)
                .font(.appTitle(16, weight: .heavy))
                .foregroundColor(AppTheme.navy)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            TranslatedText(text: slide.description)
                .font(.appBody(11, weight: .regular))
                .foregroundColor(AppTheme.muted)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
        }
    }

    private func heroImage(for slide: HeroSlide, size: CGFloat) -> some View {
        AsyncImage(url: imageURL(for: slide.imagePath)) { image in
            image.resizable().scaledToFit()
        } placeholder: {
            Image(systemName: "photo")
                .font(.system(size: 32))
                .foregroundColor(AppTheme.muted)
        }
        .frame(width: size, height: size)
    }


private struct HomeMetrics {
    let horizontalPadding: CGFloat
    let contentMaxWidth: CGFloat
    let headerTopPadding: CGFloat
    let headerBottomPadding: CGFloat
    let languageSwitcherTopPadding: CGFloat
    let heroHeight: CGFloat
    let heroMinHeight: CGFloat
    let heroImageSize: CGFloat
    let quickActionMinHeight: CGFloat
    let bannerImageHeight: CGFloat
    let docDaisyImageSize: CGFloat
    let bannerInsetHeight: CGFloat
    let bannerBottomPadding: CGFloat
    let contentBottomPadding: CGFloat

    init(size: CGSize, safeArea: EdgeInsets, isCompactWidth: Bool) {
        let widthScale = min(size.width / 430, 1.0)
        let heightScale = min(size.height / 900, 1.0)
        let scale = min(max(min(widthScale, heightScale), 0.72), 1.0)

        horizontalPadding = max(18, 20 * scale)
        let availableWidth = max(size.width - horizontalPadding * 2, 0)
        contentMaxWidth = min(availableWidth, 420)
        headerTopPadding = max(8, 14 * scale) + safeArea.top
        headerBottomPadding = max(12, 16 * scale)
        languageSwitcherTopPadding = max(6, 10 * scale) + safeArea.top

        heroMinHeight = max(140, 152 * scale)
        heroHeight = max(heroMinHeight + 8, min(185 * scale, contentMaxWidth * 0.54))
        heroImageSize = max(56, 72 * scale)
        quickActionMinHeight = max(110, 120 * scale)
        bannerImageHeight = max(160, 190 * scale)
        docDaisyImageSize = min(max(96, 140 * scale), contentMaxWidth * 0.28)
        bannerInsetHeight = 120 * scale
        bannerBottomPadding = 96 * scale
        contentBottomPadding = 112 * scale
    }
}
    private var howVisitSteps: [HowVisitStep] {
        [
            HowVisitStep(
                title: "Find the right clinic",
                body: "Search by specialization or describe your symptoms. Not sure which doctor to visit? DocDaisy can guide you.",
                helper: nil,
                note: nil,
                usesTrustChip: false
            ),
            HowVisitStep(
                title: "Request a visit",
                body: "Choose your preferred date and time. We will send a visit request to the clinic on your behalf.",
                helper: "This is a request, not an instant booking.",
                note: nil,
                usesTrustChip: false
            ),
            HowVisitStep(
                title: "Share medical information (optional)",
                body: "You can share symptoms or medical records to help the clinic prepare. Only what you choose is shared, and everything is encrypted.",
                helper: nil,
                note: "Your privacy is our priority. DocNearMe cannot access your medical records.",
                usesTrustChip: true
            ),
            HowVisitStep(
                title: "What happens after you request",
                body: "The clinic will review your request based on availability.\nDocNearMe will keep you updated if anything changes before your visit.",
                helper: nil,
                note: "No payment is made in the app. You pay directly at the clinic. DocNearMe does not charge any fees.",
                usesTrustChip: false
            ),
            HowVisitStep(
                title: "Visit the clinic",
                body: "Go to the clinic at the requested time. At reception, mention that you used DocNearMe App.",
                helper: nil,
                note: nil,
                usesTrustChip: false
            ),
            HowVisitStep(
                title: "After your visit",
                body: "If the clinic provides digital reports or results, you can access them securely in the app — only if you choose to.",
                helper: nil,
                note: nil,
                usesTrustChip: false
            ),
        ]
    }
}

struct LoginPromptSheet: View {
    let onLater: () -> Void
    let onLogin: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                TranslatedText(text: "Welcome to DocNearMe")
                    .font(.appTitle(20))
                    .foregroundColor(AppTheme.navy)
                TranslatedText(text: "Sign in to manage appointments, access records, and get updates.")
                    .font(.appBody(13))
                    .foregroundColor(AppTheme.muted)

                HStack {
                    PillButton(title: "Maybe later", style: .outline, action: onLater)
                    PillButton(title: "Login", style: .primary, action: onLogin)
                }
            }
            .padding(20)
            .presentationDragIndicator(.visible)
        }
    }
}

struct HowVisitsSheet: View {
    let steps: [HowVisitStep]
    @Binding var currentStep: Int
    let onClose: () -> Void
    let onPrimaryAction: () -> Void
    let onDocDaisy: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    TranslatedText(text: "How visits work")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.muted)
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .foregroundColor(AppTheme.muted)
                    }
                }

                HStack(spacing: 8) {
                    TranslatedText(text: "Step")
                    Text("\(currentStep + 1)")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.navy)
                    TranslatedText(text: "of")
                    Text("\(steps.count)")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.navy)
                    Spacer()
                }

                if let step = steps[safe: currentStep] {
                    TranslatedText(text: step.title)
                        .font(.appTitle(20))
                        .foregroundColor(AppTheme.navy)
                    StepBodyView(text: step.body)
                    if let helper = step.helper {
                        TranslatedText(text: helper)
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.primary)
                    }
                    if let note = step.note {
                        NoteChipView(text: note, usesTrustStyle: step.usesTrustChip)
                    }
                }

                Spacer()

                HStack {
                    PillButton(title: "Back", style: .outline) {
                        currentStep = max(currentStep - 1, 0)
                    }
                    .disabled(currentStep == 0)

                    PillButton(title: "Next", style: .primary) {
                        currentStep = min(currentStep + 1, steps.count - 1)
                    }
                    .disabled(currentStep == steps.count - 1)
                }

                if currentStep == steps.count - 1 {
                    VStack(alignment: .leading, spacing: 10) {
                        TranslatedText(text: "Still unsure?")
                            .font(.appTitle(16))
                            .foregroundColor(AppTheme.navy)
                        TranslatedText(text: "Healthcare works differently at every clinic. DocNearMe helps make the process clearer without replacing how clinics work.")
                            .font(.appBody(12))
                            .foregroundColor(AppTheme.muted)
                        HStack {
                            PillButton(title: "Start request", style: .primary, action: onPrimaryAction)
                            PillButton(title: "Ask DocDaisy", style: .outline, action: onDocDaisy)
                        }
                        PillButton(title: "Contact support", style: .outline) {
                            if let url = URL(string: "mailto:docnearme.jp@gmail.com") {
                                UIApplication.shared.open(url)
                            }
                        }
                    }
                    .padding(12)
                    .background(Color(red: 0.96, green: 0.97, blue: 0.98))
                    .cornerRadius(20)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(AppTheme.border, lineWidth: 1)
                    )
                }
            }
            .padding(20)
        }
    }
}

private extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
