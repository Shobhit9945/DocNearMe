import SwiftUI

struct DocDaisyView: View {
    @EnvironmentObject private var appState: AppState
    @State private var input = ""

    var body: some View {
        VStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(appState.chatMessages, id: \.self) { message in
                            HStack {
                                if message.sender == "user" {
                                    Spacer()
                                }
                                Text(message.text)
                                    .padding(12)
                                    .background(message.sender == "user" ? Color.teal.opacity(0.2) : Color(.secondarySystemBackground))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                if message.sender != "user" {
                                    Spacer()
                                }
                            }
                        }
                    }
                    .padding()
                }
                .onChange(of: appState.chatMessages.count) { _ in
                    if let last = appState.chatMessages.last {
                        proxy.scrollTo(last, anchor: .bottom)
                    }
                }
            }

            HStack {
                TextField("Ask DocDaisy...", text: $input)
                    .textFieldStyle(.roundedBorder)
                Button("Send") {
                    Task {
                        await appState.sendDocDaisyMessage(input)
                        input = ""
                    }
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
        }
        .navigationTitle("DocDaisy")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        DocDaisyView()
            .environmentObject(AppState())
    }
}
