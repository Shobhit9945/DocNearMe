import CryptoKit
import PDFKit
import SwiftUI
import UIKit
import UniformTypeIdentifiers

private let consentVersion = "2024-09-01"
private let consentText = "I consent to the secure storage of my encrypted medical records on DocNearMe servers. I understand the files are encrypted in my browser and only I can decrypt them."
private let maxUploadSizeBytes = 8 * 1024 * 1024

struct MedicalRecordsView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var tabRouter: TabRouter

    @State private var records: [VaultDocListItem] = []
    @State private var previewRecord: PreviewRecord? = nil
    @State private var errorMessage: String? = nil
    @State private var infoMessage: String? = nil
    @State private var isEncrypting = false
    @State private var isLoading = false
    @State private var isUploading = false
    @State private var consentStatus: MedicalConsentStatusResponse? = nil
    @State private var showConsentDialog = false
    @State private var isConsentSubmitting = false
    @State private var editingRecordId: String? = nil
    @State private var renameValue = ""
    @State private var isRenaming = false
    @State private var vaultKeyStatus: VaultKeyGetResponse? = nil
    @State private var showRecovery = false
    @State private var hasLocalKey = false
    @State private var isImporting = false

    private var token: String? { appState.authToken }
    private var email: String? { appState.user?.email }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                consentDialogAnchor
                if token == nil {
                    signInCard
                }
                contentGrid
                if let previewRecord {
                    previewSection(previewRecord)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 120)
        }
        .background(AppTheme.background.ignoresSafeArea())
        .overlay(alignment: .topTrailing) {
            LanguageSwitcherView()
                .padding(.top, 12)
                .padding(.trailing, 16)
        }
        .sheet(isPresented: $showConsentDialog) {
            ConsentSheet(
                consentText: consentText,
                isSubmitting: isConsentSubmitting,
                onDecline: {
                    showConsentDialog = false
                    tabRouter.selection = .home
                },
                onAgree: {
                    Task { await handleConsentSubmit() }
                }
            )
            .presentationDetents([.medium])
        }
        .fileImporter(
            isPresented: $isImporting,
            allowedContentTypes: [.pdf, .image],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                Task { await handleFileSelection(url: url) }
            case .failure(let error):
                errorMessage = error.localizedDescription
            }
        }
        .task {
            await refreshAll()
        }
        .onChange(of: appState.authToken) { _, _ in
            Task { await refreshAll() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            TranslatedText(text: "Medical Records Vault")
                .font(.appTitle(24))
                .foregroundColor(AppTheme.navy)
            TranslatedText(text: "Upload PDFs or images, encrypt them on your device, and store them securely.")
                .font(.appBody(12))
                .foregroundColor(AppTheme.muted)
            HStack(spacing: 6) {
                Image(systemName: "shield.checkerboard")
                    .foregroundColor(AppTheme.primary)
                TranslatedText(text: "Client-side encrypted")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.primary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(red: 0.96, green: 0.98, blue: 1.0))
            .cornerRadius(999)
        }
    }

    private var consentDialogAnchor: some View {
        Group {
            if showConsentDialog {
                EmptyView()
            }
        }
    }

    private var signInCard: some View {
        SectionCard(padding: 20) {
            VStack(alignment: .leading, spacing: 10) {
                TranslatedText(text: "Sign in to access your vault")
                    .font(.appTitle(18))
                    .foregroundColor(AppTheme.navy)
                TranslatedText(text: "Your encrypted records are tied to your account so you can access them on any device.")
                    .font(.appBody(12))
                    .foregroundColor(AppTheme.muted)
                PillButton(title: "Login", style: .primary) {
                    tabRouter.selection = .profile
                }
            }
        }
    }

    private var contentGrid: some View {
        VStack(spacing: 16) {
            uploadSection
            recordsSection
        }
    }

    private var uploadSection: some View {
        SectionCard(padding: 20) {
            VStack(alignment: .leading, spacing: 16) {
                if needsVaultSetup, let token {
                    VaultSetupView(token: token, email: email) {
                        Task { await handleVaultSetupComplete() }
                    }
                } else if needsUnlock, let key = vaultKeyStatus?.key {
                    VaultUnlockView(vaultKey: key, email: email) {
                        handleVaultUnlocked()
                    } onStartRecovery: {
                        showRecovery = true
                    }
                } else if needsRecovery, let key = vaultKeyStatus?.key, let token {
                    VaultRecoveryView(vaultKey: key, token: token, email: email) {
                        Task { await handleVaultRecovered() }
                    } onCancel: {
                        showRecovery = false
                    }
                } else {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "square.and.arrow.up")
                            .foregroundColor(AppTheme.primary)
                            .font(.system(size: 24))
                        VStack(alignment: .leading, spacing: 4) {
                            TranslatedText(text: "Upload a medical record")
                                .font(.appTitle(16))
                                .foregroundColor(AppTheme.navy)
                            TranslatedText(text: "Files are encrypted on your device before they are stored on DocNearMe.")
                                .font(.appBody(12))
                                .foregroundColor(AppTheme.muted)
                        }
                    }

                    PillButton(title: "Select file", style: .primary) {
                        isImporting = true
                    }
                    .disabled(!vaultReady || isUploading)

                    TranslatedText(text: recordsCountLabel)
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)

                    if isEncrypting {
                        TranslatedText(text: "Encrypting your file...")
                            .font(.appBody(11))
                            .foregroundColor(AppTheme.muted)
                    }
                    if isUploading {
                        TranslatedText(text: "Uploading encrypted file...")
                            .font(.appBody(11))
                            .foregroundColor(AppTheme.muted)
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.appBody(11))
                            .foregroundColor(.red)
                    }
                    if let infoMessage {
                        Text(infoMessage)
                            .font(.appBody(11))
                            .foregroundColor(.green)
                    }

                    SectionCard(padding: 14) {
                        VStack(alignment: .leading, spacing: 6) {
                            TranslatedText(text: "Privacy-first storage")
                                .font(.appBody(12, weight: .semibold))
                                .foregroundColor(AppTheme.navy)
                            TranslatedText(text: "Your vault key never leaves your device. DocNearMe only stores encrypted files and wrapped keys.")
                                .font(.appBody(11))
                                .foregroundColor(AppTheme.muted)
                        }
                    }
                }
            }
        }
    }

    private var recordsSection: some View {
        SectionCard(padding: 20) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    TranslatedText(text: "Your encrypted files")
                        .font(.appTitle(16))
                        .foregroundColor(AppTheme.navy)
                    Spacer()
                    TranslatedText(text: "View or delete")
                        .font(.appBody(10))
                        .foregroundColor(AppTheme.muted)
                }

                if token != nil, !vaultReady {
                    TranslatedText(text: "Unlock your vault to view and manage encrypted records.")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.muted)
                }

                if vaultReady && isLoading {
                    TranslatedText(text: "Loading your records...")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.muted)
                }

                if vaultReady && !isLoading && records.isEmpty {
                    TranslatedText(text: "Upload a record to see it listed here.")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.muted)
                }

                ForEach(records) { record in
                    recordRow(record)
                }
            }
        }
    }

    private func recordRow(_ record: VaultDocListItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "doc.text")
                    .foregroundColor(AppTheme.primary)
                VStack(alignment: .leading, spacing: 4) {
                    if editingRecordId == record.id {
                        TextField("Filename", text: $renameValue)
                            .textFieldStyle(.roundedBorder)
                        HStack(spacing: 8) {
                            PillButton(title: isRenaming ? "Saving..." : "Save", style: .primary) {
                                Task { await handleRenameSave(recordId: record.id) }
                            }
                            .disabled(isRenaming)
                            PillButton(title: "Cancel", style: .outline) {
                                handleRenameCancel()
                            }
                        }
                    } else {
                        Text(record.name)
                            .font(.appBody(13, weight: .semibold))
                            .foregroundColor(AppTheme.navy)
                        Text(recordSubtitle(record))
                            .font(.appBody(11))
                            .foregroundColor(AppTheme.muted)
                    }
                }
                Spacer()
                HStack(spacing: 8) {
                    PillButton(title: "View", style: .outline) {
                        Task { await handleView(record) }
                    }
                    if editingRecordId != record.id {
                        Button {
                            handleRenameStart(record)
                        } label: {
                            Image(systemName: "pencil")
                        }
                        .foregroundColor(AppTheme.muted)
                    }
                    Button {
                        Task { await handleDelete(recordId: record.id) }
                    } label: {
                        Image(systemName: "trash")
                    }
                    .foregroundColor(AppTheme.danger)
                }
            }
        }
        .padding(12)
        .background(Color.white)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .cornerRadius(16)
    }

    private func previewSection(_ record: PreviewRecord) -> some View {
        SectionCard(padding: 20) {
            VStack(alignment: .leading, spacing: 12) {
                Text(record.name)
                    .font(.appTitle(16))
                    .foregroundColor(AppTheme.navy)
                TranslatedText(text: "Decrypted locally for viewing only.")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)
                if record.type.hasPrefix("image/"), let image = UIImage(data: record.data) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 320)
                        .cornerRadius(12)
                } else if record.type == "application/pdf" {
                    PDFPreviewView(data: record.data)
                        .frame(height: 320)
                        .cornerRadius(12)
                } else {
                    TranslatedText(text: "Your file is ready.")
                        .font(.appBody(12))
                        .foregroundColor(AppTheme.muted)
                }
                PillButton(title: "Close preview", style: .outline) {
                    previewRecord = nil
                }
            }
        }
    }

    private var recordsCountLabel: String {
        if records.isEmpty {
            return "No records uploaded yet."
        }
        if appState.selectedLanguageCode == "ja" {
            return "\(records.count)件の暗号化された記録がアカウントに保存されています。"
        }
        let suffix = records.count == 1 ? "record" : "records"
        return "\(records.count) encrypted \(suffix) stored in your account."
    }

    private var hasServerKey: Bool { vaultKeyStatus?.hasKey == true }
    private var needsVaultSetup: Bool { token != nil && consentStatus?.hasConsented == true && !hasServerKey }
    private var needsUnlock: Bool { token != nil && hasServerKey && !hasLocalKey && !showRecovery }
    private var needsRecovery: Bool { token != nil && hasServerKey && showRecovery }
    private var vaultReady: Bool { token != nil && hasServerKey && hasLocalKey }

    private func recordSubtitle(_ record: VaultDocListItem) -> String {
        let date = formattedDate(record.createdAt)
        let kb = record.size / 1024.0
        return "\(date) · \(String(format: "%.1f", kb)) KB"
    }

    private func formattedDate(_ value: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: value) {
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .none
            return display.string(from: date)
        }
        return value
    }

    private func refreshAll() async {
        guard let token else {
            records = []
            consentStatus = nil
            vaultKeyStatus = nil
            hasLocalKey = false
            showConsentDialog = false
            return
        }
        hasLocalKey = MedicalVault.getStoredVaultKey(email: email) != nil
        await refreshConsentStatus(token)
        await refreshRecords(token)
        await refreshVaultKeyStatus(token)
    }

    private func refreshRecords(_ token: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: VaultDocListResponse = try await APIClient.shared.request("/api/vault/docs", token: token)
            records = response.docs.map { VaultDocListItem(summary: $0) }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshConsentStatus(_ token: String) async {
        do {
            let response: MedicalConsentStatusResponse = try await APIClient.shared.request("/api/medical-records/consent", token: token)
            consentStatus = response
            if response.hasConsented == false {
                showConsentDialog = true
            } else {
                showConsentDialog = false
            }
        } catch {
            consentStatus = MedicalConsentStatusResponse(hasConsented: false, consentedAt: nil, consentVersion: consentVersion)
        }
    }

    private func refreshVaultKeyStatus(_ token: String) async {
        do {
            let response: VaultKeyGetResponse = try await APIClient.shared.request("/api/vault/keys", token: token)
            vaultKeyStatus = response
        } catch {
            vaultKeyStatus = VaultKeyGetResponse(hasKey: false, key: nil)
        }
    }

    private func handleConsentSubmit() async {
        guard let token else { return }
        errorMessage = nil
        infoMessage = nil
        isConsentSubmitting = true
        defer { isConsentSubmitting = false }
        do {
            let payload = MedicalConsentRequest(consentVersion: consentVersion, consentText: consentText)
            let response: MedicalConsentResponse = try await APIClient.shared.request(
                "/api/medical-records/consent",
                method: .post,
                body: payload,
                token: token
            )
            consentStatus = MedicalConsentStatusResponse(
                hasConsented: true,
                consentedAt: response.consentedAt,
                consentVersion: response.consentVersion
            )
            showConsentDialog = false
            infoMessage = "Consent saved. You can now upload your records."
        } catch {
            errorMessage = "Unable to save your consent. Please try again."
        }
    }

    private func handleVaultSetupComplete() async {
        guard let token else { return }
        await refreshVaultKeyStatus(token)
        hasLocalKey = true
        showRecovery = false
        infoMessage = "Vault setup complete. Your device is ready."
    }

    private func handleVaultUnlocked() {
        hasLocalKey = true
        showRecovery = false
        infoMessage = "Vault unlocked on this device."
    }

    private func handleVaultRecovered() async {
        guard let token else { return }
        await refreshVaultKeyStatus(token)
        hasLocalKey = true
        showRecovery = false
        infoMessage = "Vault password updated."
    }

    private func handleFileSelection(url: URL) async {
        guard vaultReady else { return }
        errorMessage = nil
        infoMessage = nil

        guard url.startAccessingSecurityScopedResource() else {
            errorMessage = "Unable to access this file."
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        do {
            let data = try Data(contentsOf: url)
            let fileSize = data.count
            guard fileSize <= maxUploadSizeBytes else {
                errorMessage = "Please upload files under 8MB."
                return
            }

            let type = mimeType(for: url)
            guard type == "application/pdf" || type.hasPrefix("image/") else {
                errorMessage = "Only PDF or image files are supported."
                return
            }

            let fileName = url.lastPathComponent
            await handleUpload(data: data, fileName: fileName, mimeType: type)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func handleUpload(data: Data, fileName: String, mimeType: String) async {
        guard let token else {
            errorMessage = "Please sign in to upload medical records."
            return
        }
        guard consentStatus?.hasConsented == true else {
            errorMessage = "Please provide consent before uploading medical records."
            return
        }
        guard let key = MedicalVault.getStoredVaultKey(email: email) else {
            errorMessage = "Unlock your vault on this device before uploading new records."
            return
        }

        isEncrypting = true
        isUploading = true
        defer {
            isEncrypting = false
            isUploading = false
        }

        do {
            let docId = UUID().uuidString
            let userId = userIdFromToken(token) ?? (email ?? "unknown")
            let aad = "\(userId):\(docId)"
            let encrypted = try MedicalVault.encryptDoc(key, data: data, aad: aad)

            let payload = VaultDocCreateRequest(
                id: docId,
                name: fileName,
                type: mimeType,
                size: Double(data.count),
                iv: encrypted.iv,
                ciphertext: encrypted.ciphertext,
                aad: encrypted.aad
            )

            let response: VaultDocCreateResponse = try await APIClient.shared.request(
                "/api/vault/docs",
                method: .post,
                body: payload,
                token: token
            )

            records.insert(VaultDocListItem(summary: response.doc), at: 0)
            infoMessage = "Encrypted record saved to your account."
            hasLocalKey = true
        } catch {
            errorMessage = "Unable to encrypt the file. Please try again."
        }
    }

    private func handleView(_ record: VaultDocListItem) async {
        errorMessage = nil
        guard let token else {
            errorMessage = "Please sign in again to access your records."
            return
        }
        guard let key = MedicalVault.getStoredVaultKey(email: email) else {
            errorMessage = "Unlock your vault on this device to view encrypted records."
            return
        }

        do {
            let detail: VaultDocDetail
            if let iv = record.iv, let ciphertext = record.ciphertext {
                detail = VaultDocDetail(
                    id: record.id,
                    name: record.name,
                    type: record.type,
                    size: record.size,
                    createdAt: record.createdAt,
                    iv: iv,
                    ciphertext: ciphertext,
                    aad: record.aad
                )
            } else {
                let response: VaultDocFetchResponse = try await APIClient.shared.request(
                    "/api/vault/docs?docId=\(record.id)",
                    token: token
                )
                detail = response.doc
                records = records.map { item in
                    if item.id == detail.id {
                        var updated = item
                        updated.iv = detail.iv
                        updated.ciphertext = detail.ciphertext
                        updated.aad = detail.aad
                        return updated
                    }
                    return item
                }
            }

            let decrypted = try MedicalVault.decryptDoc(key, payload: detail)
            previewRecord = PreviewRecord(name: record.name, type: record.type, data: decrypted, recordId: record.id)
        } catch {
            if vaultKeyStatus?.hasKey == true {
                MedicalVault.clearLocalVaultKey(email: email)
                hasLocalKey = false
                errorMessage = "Unable to decrypt this file. Unlock your vault with your Vault Password to sync this device."
                return
            }
            errorMessage = "Unable to decrypt this file on this device. Make sure you're using the same device."
        }
    }

    private func handleDelete(recordId: String) async {
        guard let token else { return }
        errorMessage = nil
        infoMessage = nil
        do {
            let response: VaultDocDeleteResponse = try await APIClient.shared.request(
                "/api/vault/docs/\(recordId)",
                method: .delete,
                token: token
            )
            if response.success {
                records.removeAll { $0.id == recordId }
                if previewRecord?.recordId == recordId {
                    previewRecord = nil
                }
                infoMessage = "Record deleted."
            } else {
                throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: "Unable to delete record."])
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func handleRenameStart(_ record: VaultDocListItem) {
        editingRecordId = record.id
        renameValue = record.name
        errorMessage = nil
        infoMessage = nil
    }

    private func handleRenameCancel() {
        editingRecordId = nil
        renameValue = ""
    }

    private func handleRenameSave(recordId: String) async {
        guard let token else {
            errorMessage = "Please sign in to rename your records."
            return
        }
        let trimmed = renameValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "Please enter a file name."
            return
        }
        errorMessage = nil
        infoMessage = nil
        isRenaming = true
        defer { isRenaming = false }

        do {
            let response: VaultDocRenameResponse = try await APIClient.shared.request(
                "/api/vault/docs/\(recordId)",
                method: .patch,
                body: ["name": trimmed],
                token: token
            )
            records = records.map { record in
                record.id == recordId ? VaultDocListItem(summary: response.doc) : record
            }
            editingRecordId = nil
            renameValue = ""
            infoMessage = "Record renamed."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func mimeType(for url: URL) -> String {
        if let type = UTType(filenameExtension: url.pathExtension),
           let mime = type.preferredMIMEType {
            return mime
        }
        return "application/octet-stream"
    }

    private func userIdFromToken(_ token: String) -> String? {
        let parts = token.split(separator: ".")
        guard parts.count > 1 else { return nil }
        let payload = String(parts[1])
        var base64 = payload.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let padding = 4 - base64.count % 4
        if padding < 4 {
            base64.append(String(repeating: "=", count: padding))
        }
        guard let data = Data(base64Encoded: base64) else { return nil }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return json["sub"] as? String
    }
}

struct VaultDocListItem: Identifiable {
    let id: String
    let name: String
    let type: String
    let size: Double
    let createdAt: String
    var iv: String?
    var ciphertext: String?
    var aad: String?

    init(summary: VaultDocSummary) {
        id = summary.id
        name = summary.name
        type = summary.type
        size = summary.size
        createdAt = summary.createdAt
    }
}

struct PreviewRecord: Identifiable {
    let id = UUID()
    let name: String
    let type: String
    let data: Data
    let recordId: String
}

struct PDFPreviewView: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.backgroundColor = UIColor.systemBackground
        return view
    }

    func updateUIView(_ uiView: PDFView, context: Context) {
        uiView.document = PDFDocument(data: data)
    }
}

struct ConsentSheet: View {
    let consentText: String
    let isSubmitting: Bool
    let onDecline: () -> Void
    let onAgree: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            TranslatedText(text: "Medical data consent required")
                .font(.appTitle(18))
                .foregroundColor(AppTheme.navy)
            TranslatedText(text: consentText)
                .font(.appBody(12))
                .foregroundColor(AppTheme.muted)

            HStack {
                PillButton(title: "Decline", style: .outline, action: onDecline)
                PillButton(title: isSubmitting ? "Saving consent..." : "Agree and continue", style: .primary, action: onAgree)
                    .disabled(isSubmitting)
            }
        }
        .padding(20)
    }
}

struct VaultSetupView: View {
    let token: String
    let email: String?
    let onComplete: () -> Void

    @State private var step: Step = .password
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var recoveryKey = ""
    @State private var recoveryAcknowledged = false
    @State private var errorMessage: String? = nil
    @State private var isSaving = false

    enum Step {
        case password
        case recovery
        case success
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "shield.checkerboard")
                    .foregroundColor(AppTheme.primary)
                VStack(alignment: .leading, spacing: 4) {
                    TranslatedText(text: "Set up your vault")
                        .font(.appTitle(16))
                        .foregroundColor(AppTheme.navy)
                    TranslatedText(text: "Choose a Vault Password and save your Recovery Key. DocNearMe cannot reset your vault.")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                }
            }

            switch step {
            case .password:
                passwordStep
            case .recovery:
                recoveryStep
            case .success:
                successStep
            }
        }
    }

    private var passwordStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            SecureField("Vault Password", text: $password)
                .textFieldStyle(.roundedBorder)
            SecureField("Confirm Vault Password", text: $confirmPassword)
                .textFieldStyle(.roundedBorder)
            passwordChecks
            if let errorMessage {
                Text(errorMessage)
                    .font(.appBody(11))
                    .foregroundColor(.red)
            }
            PillButton(title: "Continue", style: .primary) {
                handleContinue()
            }
        }
    }

    private var recoveryStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionCard(padding: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    TranslatedText(text: "Save your Recovery Key")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.navy)
                    TranslatedText(text: "This key is shown only once. Keep it offline or in a password manager.")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                    Text(recoveryKey)
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundColor(AppTheme.navy)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .cornerRadius(10)
                }
            }

            Toggle(isOn: $recoveryAcknowledged) {
                TranslatedText(text: "I saved this recovery key securely.")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)
            }

            HStack {
                PillButton(title: "Copy", style: .outline) {
                    UIPasteboard.general.string = recoveryKey
                }
                ShareLink(item: recoveryKey) {
                    TranslatedText(text: "Share")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.primary)
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.appBody(11))
                    .foregroundColor(.red)
            }

            PillButton(title: isSaving ? "Creating vault..." : "Create vault", style: .primary) {
                Task { await handleCreateVault() }
            }
            .disabled(isSaving)

            TranslatedText(text: "If you lose both your Vault Password and Recovery Key, your vault cannot be recovered.")
                .font(.appBody(10))
                .foregroundColor(AppTheme.muted)
        }
    }

    private var successStep: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionCard(padding: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    TranslatedText(text: "Vault setup complete")
                        .font(.appBody(12, weight: .semibold))
                        .foregroundColor(AppTheme.navy)
                    TranslatedText(text: "DocNearMe cannot reset your vault password. Keep your recovery key safe.")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                }
            }
            PillButton(title: "Continue to vault", style: .primary, action: onComplete)
        }
    }

    private var passwordChecks: some View {
        let checks = passwordStrength(password)
        return VStack(alignment: .leading, spacing: 4) {
            Text("• 12+ characters").foregroundColor(checks.lengthOk ? .green : AppTheme.muted)
            Text("• Lowercase letter").foregroundColor(checks.hasLower ? .green : AppTheme.muted)
            Text("• Uppercase letter").foregroundColor(checks.hasUpper ? .green : AppTheme.muted)
            Text("• Number").foregroundColor(checks.hasNumber ? .green : AppTheme.muted)
            Text("• Symbol").foregroundColor(checks.hasSymbol ? .green : AppTheme.muted)
        }
        .font(.appBody(10))
    }

    private func handleContinue() {
        let checks = passwordStrength(password)
        guard checks.lengthOk && checks.hasLower && checks.hasUpper && checks.hasNumber && checks.hasSymbol else {
            errorMessage = "Use a strong password with mixed characters."
            return
        }
        guard password == confirmPassword else {
            errorMessage = "Passwords do not match."
            return
        }
        recoveryKey = MedicalVault.generateRecoveryKey()
        errorMessage = nil
        step = .recovery
    }

    private func handleCreateVault() async {
        guard recoveryAcknowledged else {
            errorMessage = "Please confirm that you saved your recovery key."
            return
        }

        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        do {
            let dek = SymmetricKey(size: .bits256)
            let passwordWrapped = try MedicalVault.wrapDEK(dek, secret: password)
            let recoveryWrapped = try MedicalVault.wrapDEK(dek, secret: recoveryKey)

            let payload = VaultKeyCreateRequest(
                dekWrappedByPassword: passwordWrapped.wrappedKey,
                dekWrappedByRecovery: recoveryWrapped.wrappedKey,
                kdfSaltPassword: passwordWrapped.kdfSalt,
                kdfSaltRecovery: recoveryWrapped.kdfSalt,
                kdfParams: passwordWrapped.kdfParams,
                aead: passwordWrapped.aead,
                wrapIvPassword: passwordWrapped.wrapIv,
                wrapIvRecovery: recoveryWrapped.wrapIv
            )

            let response: VaultKeyUpsertResponse = try await APIClient.shared.request(
                "/api/vault/keys",
                method: .post,
                body: payload,
                token: token
            )
            guard response.success else { throw NSError(domain: "DocNearMe", code: 0) }

            MedicalVault.storeLocalVaultKey(email: email, key: dek)
            step = .success
        } catch {
            errorMessage = "Unable to create your vault."
            step = .recovery
        }
    }

    private func passwordStrength(_ password: String) -> (lengthOk: Bool, hasLower: Bool, hasUpper: Bool, hasNumber: Bool, hasSymbol: Bool) {
        let lengthOk = password.count >= 12
        let hasLower = password.range(of: "[a-z]", options: .regularExpression) != nil
        let hasUpper = password.range(of: "[A-Z]", options: .regularExpression) != nil
        let hasNumber = password.range(of: "[0-9]", options: .regularExpression) != nil
        let hasSymbol = password.range(of: "[^A-Za-z0-9]", options: .regularExpression) != nil
        return (lengthOk, hasLower, hasUpper, hasNumber, hasSymbol)
    }
}

struct VaultUnlockView: View {
    let vaultKey: VaultKeyPayload
    let email: String?
    let onUnlocked: () -> Void
    let onStartRecovery: () -> Void

    @State private var password = ""
    @State private var errorMessage: String? = nil
    @State private var attempts = 0
    @State private var cooldownUntil: Date? = nil
    @State private var isSubmitting = false
    @State private var now = Date()

    private let maxAttempts = 5
    private let cooldownSeconds = 30

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "lock.fill")
                    .foregroundColor(AppTheme.primary)
                VStack(alignment: .leading, spacing: 4) {
                    TranslatedText(text: "Unlock your vault")
                        .font(.appTitle(16))
                        .foregroundColor(AppTheme.navy)
                    TranslatedText(text: "Enter your Vault Password to decrypt records on this device.")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                }
            }

            SecureField("Vault Password", text: $password)
                .textFieldStyle(.roundedBorder)

            if let errorMessage {
                Text(errorMessage)
                    .font(.appBody(11))
                    .foregroundColor(.red)
            }

            if let remaining = cooldownRemaining, remaining > 0 {
                Text("Try again in \(remaining) seconds.")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)
            }

            HStack {
                PillButton(title: isSubmitting ? "Unlocking..." : "Unlock vault", style: .primary) {
                    Task { await handleUnlock() }
                }
                .disabled(isSubmitting)
                PillButton(title: "Forgot vault password?", style: .outline, action: onStartRecovery)
            }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { value in
            now = value
        }
    }

    private var cooldownRemaining: Int? {
        guard let cooldownUntil else { return nil }
        let remaining = Int(cooldownUntil.timeIntervalSince(now))
        return max(0, remaining)
    }

    private func handleUnlock() async {
        if let remaining = cooldownRemaining, remaining > 0 {
            errorMessage = "Too many attempts. Please wait a moment."
            return
        }
        guard !password.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Enter your Vault Password to unlock."
            return
        }
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let wrapped = MedicalVault.WrappedDek(
                wrappedKey: vaultKey.dekWrappedByPassword,
                kdfSalt: vaultKey.kdfSaltPassword,
                kdfParams: vaultKey.kdfParams,
                wrapIv: vaultKey.wrapIvPassword,
                aead: vaultKey.aead
            )
            let dek = try MedicalVault.unwrapDEK(payload: wrapped, secret: password)
            MedicalVault.storeLocalVaultKey(email: email, key: dek)
            password = ""
            attempts = 0
            onUnlocked()
        } catch {
            let message = (error as NSError).localizedDescription
            if message.contains("Unsupported KDF") {
                self.errorMessage = message
                return
            }
            attempts += 1
            if attempts >= maxAttempts {
                cooldownUntil = Date().addingTimeInterval(TimeInterval(cooldownSeconds))
            }
            errorMessage = "Incorrect vault password."
        }
    }
}

struct VaultRecoveryView: View {
    let vaultKey: VaultKeyPayload
    let token: String
    let email: String?
    let onRecovered: () -> Void
    let onCancel: () -> Void

    @State private var step: Step = .verify
    @State private var recoveryKey = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var errorMessage: String? = nil
    @State private var attempts = 0
    @State private var cooldownUntil: Date? = nil
    @State private var isSubmitting = false
    @State private var dek: SymmetricKey? = nil
    @State private var now = Date()

    private let maxAttempts = 5
    private let cooldownSeconds = 30

    enum Step {
        case verify
        case reset
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: step == .verify ? "key.fill" : "arrow.triangle.2.circlepath")
                    .foregroundColor(AppTheme.warning)
                VStack(alignment: .leading, spacing: 4) {
                    TranslatedText(text: "Recover your vault")
                        .font(.appTitle(16))
                        .foregroundColor(AppTheme.navy)
                    TranslatedText(text: "Use your Recovery Key to set a new Vault Password. DocNearMe cannot reset it for you.")
                        .font(.appBody(11))
                        .foregroundColor(AppTheme.muted)
                }
            }

            if step == .verify {
                verifySection
            } else {
                resetSection
            }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { value in
            now = value
        }
    }

    private var verifySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField("Recovery Key", text: $recoveryKey)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 12, weight: .semibold, design: .monospaced))

            if let errorMessage {
                Text(errorMessage)
                    .font(.appBody(11))
                    .foregroundColor(.red)
            }

            if let remaining = cooldownRemaining, remaining > 0 {
                Text("Try again in \(remaining) seconds.")
                    .font(.appBody(11))
                    .foregroundColor(AppTheme.muted)
            }

            HStack {
                PillButton(title: isSubmitting ? "Verifying..." : "Verify recovery key", style: .primary) {
                    Task { await handleVerify() }
                }
                .disabled(isSubmitting)
                PillButton(title: "Back", style: .outline, action: onCancel)
            }
        }
    }

    private var resetSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SecureField("New Vault Password", text: $newPassword)
                .textFieldStyle(.roundedBorder)
            SecureField("Confirm new password", text: $confirmPassword)
                .textFieldStyle(.roundedBorder)

            if let errorMessage {
                Text(errorMessage)
                    .font(.appBody(11))
                    .foregroundColor(.red)
            }

            PillButton(title: isSubmitting ? "Updating..." : "Update vault password", style: .primary) {
                Task { await handleReset() }
            }
            .disabled(isSubmitting)
        }
    }

    private var cooldownRemaining: Int? {
        guard let cooldownUntil else { return nil }
        let remaining = Int(cooldownUntil.timeIntervalSince(now))
        return max(0, remaining)
    }

    private func handleVerify() async {
        if let remaining = cooldownRemaining, remaining > 0 {
            errorMessage = "Too many attempts. Please wait a moment."
            return
        }
        guard !recoveryKey.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Enter your Recovery Key."
            return
        }
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let wrapped = MedicalVault.WrappedDek(
                wrappedKey: vaultKey.dekWrappedByRecovery,
                kdfSalt: vaultKey.kdfSaltRecovery,
                kdfParams: vaultKey.kdfParams,
                wrapIv: vaultKey.wrapIvRecovery,
                aead: vaultKey.aead
            )
            let decrypted = try MedicalVault.unwrapDEK(payload: wrapped, secret: recoveryKey.trimmingCharacters(in: .whitespacesAndNewlines))
            dek = decrypted
            step = .reset
            attempts = 0
        } catch {
            let message = (error as NSError).localizedDescription
            if message.contains("Unsupported KDF") {
                self.errorMessage = message
                return
            }
            attempts += 1
            if attempts >= maxAttempts {
                cooldownUntil = Date().addingTimeInterval(TimeInterval(cooldownSeconds))
            }
            errorMessage = "Incorrect recovery key."
        }
    }

    private func handleReset() async {
        guard let dek else { return }
        guard passwordStrength(newPassword) else {
            errorMessage = "Choose a stronger password (12+ chars with mixed case and numbers)."
            return
        }
        guard newPassword == confirmPassword else {
            errorMessage = "Passwords do not match."
            return
        }
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let wrapped = try MedicalVault.wrapDEK(dek, secret: newPassword)
            let payload = VaultKeyPasswordUpdateRequest(
                dekWrappedByPassword: wrapped.wrappedKey,
                kdfSaltPassword: wrapped.kdfSalt,
                kdfParams: wrapped.kdfParams,
                aead: wrapped.aead,
                wrapIvPassword: wrapped.wrapIv
            )
            let response: VaultKeyUpsertResponse = try await APIClient.shared.request(
                "/api/vault/keys/password",
                method: .put,
                body: payload,
                token: token
            )
            guard response.success else { throw NSError(domain: "DocNearMe", code: 0) }
            MedicalVault.storeLocalVaultKey(email: email, key: dek)
            onRecovered()
        } catch {
            errorMessage = "Unable to update your vault password."
        }
    }

    private func passwordStrength(_ password: String) -> Bool {
        let lengthOk = password.count >= 12
        let hasLower = password.range(of: "[a-z]", options: .regularExpression) != nil
        let hasUpper = password.range(of: "[A-Z]", options: .regularExpression) != nil
        let hasNumber = password.range(of: "[0-9]", options: .regularExpression) != nil
        return lengthOk && hasLower && hasUpper && hasNumber
    }
}
