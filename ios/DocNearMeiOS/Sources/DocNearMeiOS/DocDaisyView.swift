import SwiftUI

struct DocDaisyMessage: Identifiable, Codable {
    let id: UUID
    let sender: Sender
    let text: String

    init(id: UUID = UUID(), sender: Sender, text: String) {
        self.id = id
        self.sender = sender
        self.text = text
    }

    enum Sender: String, Codable {
        case user
        case bot
    }
}

struct DocDaisyView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var tabRouter: TabRouter

    @State private var messages: [DocDaisyMessage] = [
        DocDaisyMessage(
            sender: .bot,
            text: "Hello! I'm DocDaisy, your AI Assistant. Please describe your main symptom so I can ask a few follow-up questions."
        )
    ]
    @State private var input = ""
    @State private var inputError = ""
    @State private var isLoading = false
    @State private var relevantTurns = 0
    @State private var recommendedSpecialization: String?
    @State private var lastConclusionReply: String?
    @State private var lastConclusionUnavailable = false
    @State private var inputPrompt = "Describe your symptoms"

    var body: some View {
        VStack(spacing: 0) {
            header

            if appState.authToken == nil {
                signInPrompt
            } else {
                chatView
                composer
            }
        }
        .background(AppTheme.background.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    appState.openDocDaisy = false
                } label: {
                    TranslatedText(text: "Close")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.primary)
                }
            }
        }
        .onAppear {
            Task { await updateInputPrompt() }
        }
        .onChange(of: appState.selectedLanguage) { _, _ in
            Task { await updateInputPrompt() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            TranslatedText(text: "DocDaisy")
                .font(.appTitle(22))
                .foregroundColor(AppTheme.navy)
            TranslatedText(text: "AI symptom guidance and clinic suggestions")
                .font(.appBody(12))
                .foregroundColor(AppTheme.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .background(AppTheme.background)
    }

    private var signInPrompt: some View {
        VStack(alignment: .leading, spacing: 16) {
            TranslatedText(text: "Sign in to chat with DocDaisy")
                .font(.appTitle(18))
                .foregroundColor(AppTheme.navy)
            TranslatedText(text: "Your chat stays tied to your DocNearMe account so we can guide you to the right care.")
                .font(.appBody(12))
                .foregroundColor(AppTheme.muted)

            HStack(spacing: 12) {
                PillButton(title: "Go to profile", style: .primary) {
                    appState.pendingTabSelection = .profile
                    appState.openDocDaisy = false
                }
                PillButton(title: "Close", style: .outline) {
                    appState.openDocDaisy = false
                }
            }
        }
        .padding(20)
        .background(AppTheme.card)
        .cornerRadius(20)
        .padding(.horizontal, 16)
        .padding(.top, 24)
    }

    private var chatView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(messages) { message in
                        ChatBubble(message: message)
                            .id(message.id)
                    }

                    if isLoading {
                        HStack(spacing: 8) {
                            ProgressView()
                            TranslatedText(text: "DocDaisy is thinking...")
                                .font(.appBody(11))
                                .foregroundColor(AppTheme.muted)
                        }
                        .padding(.leading, 4)
                    }

                    if let specialization = recommendedSpecialization {
                        recommendationCard(for: specialization)
                    }

                    if lastConclusionUnavailable {
                        TranslatedText(text: "DocDaisy could not determine a specialization. Try adding more details or ask again.")
                            .font(.appBody(11))
                            .foregroundColor(AppTheme.muted)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
            .onChange(of: messages.count) { _, _ in
                if let last = messages.last {
                    withAnimation(.easeOut) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !inputError.isEmpty {
                TranslatedText(text: inputError)
                    .font(.appBody(11))
                    .foregroundColor(.red)
            }

            HStack(spacing: 10) {
                TextField("", text: $input, prompt: Text(inputPrompt), axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...4)

                Button {
                    Task { await sendMessage() }
                } label: {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 40, height: 40)
                        .background(AppTheme.primary)
                        .cornerRadius(12)
                }
                .disabled(isLoading)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.white)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(AppTheme.border),
            alignment: .top
        )
    }

    private func recommendationCard(for specialization: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            TranslatedText(text: "Recommended specialization")
                .font(.appBody(11, weight: .semibold))
                .foregroundColor(AppTheme.muted)
                .textCase(.uppercase)

            TranslatedText(text: specialization)
                .font(.appTitle(18))
                .foregroundColor(AppTheme.navy)

            if let reply = lastConclusionReply {
                TranslatedText(text: reply)
                    .font(.appBody(12))
                    .foregroundColor(AppTheme.muted)
            }

            HStack(spacing: 12) {
                PillButton(title: "Find clinics", style: .primary) {
                    appState.docDaisyRecommendedSpecialization = specialization
                    appState.pendingTabSelection = .clinics
                    appState.openDocDaisy = false
                }
                PillButton(title: "Re-evaluate", style: .outline) {
                    handleReevaluation()
                }
            }
        }
        .padding(14)
        .background(Color(red: 0.95, green: 0.97, blue: 1.0))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
    }

    private func handleReevaluation() {
        recommendedSpecialization = nil
        lastConclusionReply = nil
        lastConclusionUnavailable = false
        appState.docDaisyRecommendedSpecialization = nil
        messages.append(
            DocDaisyMessage(
                sender: .bot,
                text: "Okay, let's reassess together. Share any changes or add more details so I can refine the recommendation."
            )
        )
    }

    private func sendMessage() async {
        guard !isLoading else { return }
        let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedInput.isEmpty else {
            inputError = "Please enter a message so I can help."
            messages.append(
                DocDaisyMessage(
                    sender: .bot,
                    text: "I didn't quite catch that. Please share a bit more detail so I can help."
                )
            )
            return
        }

        inputError = ""
        isLoading = true
        recommendedSpecialization = nil
        lastConclusionReply = nil
        lastConclusionUnavailable = false

        let userMessage = DocDaisyMessage(sender: .user, text: trimmedInput)
        let conversation = messages + [userMessage]
        messages = conversation
        input = ""

        do {
            let shouldConclude = relevantTurns + 1 >= 5
            let mode: DocDaisyMode = shouldConclude ? .conclusion : .followup
            let response = try await requestDocDaisy(mode: mode, conversation: conversation, relevantTurns: relevantTurns)

            messages.append(DocDaisyMessage(sender: .bot, text: response.reply))

            if response.relevant != false {
                relevantTurns += 1
            }

            if let specialization = response.specialization, specialization != "Unsure" {
                recommendedSpecialization = specialization
                lastConclusionReply = response.reply
                appState.docDaisyRecommendedSpecialization = specialization
            } else if shouldConclude {
                lastConclusionUnavailable = true
                lastConclusionReply = response.reply
                appState.docDaisyRecommendedSpecialization = nil
            }
        } catch {
            messages.append(
                DocDaisyMessage(
                    sender: .bot,
                    text: "Sorry, I'm having trouble connecting right now. Please try again in a moment."
                )
            )
        }

        isLoading = false
    }

    private func requestDocDaisy(
        mode: DocDaisyMode,
        conversation: [DocDaisyMessage],
        relevantTurns: Int
    ) async throws -> DocDaisyResponse {
        let lastUserMessage = conversation.last(where: { $0.sender == .user })?.text ?? ""
        let conversationHeader: String? = {
            guard let data = try? JSONEncoder().encode(conversation),
                  let json = String(data: data, encoding: .utf8),
                  json.count <= 6000 else { return nil }
            return json
        }()

        let payload = DocDaisyRequest(
            mode: mode.rawValue,
            messages: conversation,
            conversationHistory: conversation,
            history: conversation,
            message: lastUserMessage,
            relevantTurns: relevantTurns
        )

        let url = AppConfig.apiBaseURL.appendingPathComponent("api/docdaisy/respond")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(mode.rawValue, forHTTPHeaderField: "x-docdaisy-mode")

        if let encodedMessage = encodeHeaderValue(lastUserMessage) {
            request.setValue(encodedMessage, forHTTPHeaderField: "x-docdaisy-message-b64")
        }
        if let conversationHeader,
           let encodedConversation = encodeHeaderValue(conversationHeader) {
            request.setValue(encodedConversation, forHTTPHeaderField: "x-docdaisy-conversation-b64")
        }

        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw NSError(domain: "DocDaisy", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: body])
        }
        return try JSONDecoder().decode(DocDaisyResponse.self, from: data)
    }

    private func encodeHeaderValue(_ value: String) -> String? {
        guard !value.isEmpty else { return nil }
        return value.data(using: .utf8)?.base64EncodedString()
    }

    private func updateInputPrompt() async {
        let translated = await TranslationService.shared.translate(
            text: "Describe your symptoms",
            targetLanguage: appState.selectedLanguageCode
        )
        inputPrompt = translated
    }
}

struct ChatBubble: View {
    let message: DocDaisyMessage

    var body: some View {
        HStack {
            if message.sender == .user {
                Spacer(minLength: 32)
            }

            Group {
                if message.sender == .user {
                    Text(message.text)
                } else {
                    TranslatedText(text: message.text)
                }
            }
            .font(.appBody(13))
            .foregroundColor(message.sender == .user ? .white : AppTheme.navy)
            .padding(12)
            .background(message.sender == .user ? AppTheme.primary : AppTheme.lightBlue)
            .cornerRadius(16)
            .frame(maxWidth: 260, alignment: message.sender == .user ? .trailing : .leading)

            if message.sender == .bot {
                Spacer(minLength: 32)
            }
        }
    }
}

private enum DocDaisyMode: String {
    case followup
    case conclusion
}

private struct DocDaisyRequest: Encodable {
    let mode: String
    let messages: [DocDaisyMessage]
    let conversationHistory: [DocDaisyMessage]
    let history: [DocDaisyMessage]
    let message: String
    let relevantTurns: Int
}

private struct DocDaisyResponse: Decodable {
    let reply: String
    let specialization: String?
    let relevant: Bool?
    let mode: String?
}
