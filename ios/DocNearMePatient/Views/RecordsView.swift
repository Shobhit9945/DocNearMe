import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct RecordsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var showAddRecord = false

    var body: some View {
        List {
            Section {
                ForEach(appState.medicalRecords) { record in
                    NavigationLink {
                        RecordDetailView(recordId: record.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(record.name)
                                .font(.headline)
                            Text(record.type)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text("Uploaded \(DateFormatters.shared.format(dateString: record.createdAt))")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 6)
                    }
                }
            } header: {
                Text("Medical records")
            }
        }
        .navigationTitle("Records")
        .toolbar {
            Button {
                showAddRecord = true
            } label: {
                Label("Add", systemImage: "plus")
            }
        }
        .sheet(isPresented: $showAddRecord) {
            AddRecordView()
        }
        .task {
            await appState.loadMedicalRecords()
        }
    }
}

private struct AddRecordView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var selectedPhotoItem: PhotosPickerItem? = nil
    @State private var selectedFileURL: URL? = nil
    @State private var isUploading = false
    @State private var uploadError: String? = nil
    @State private var showFileImporter = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Record details") {
                    TextField("Title", text: $title)
                    PhotosPicker("Select photo", selection: $selectedPhotoItem, matching: .images)
                    Button("Select PDF") {
                        showFileImporter = true
                    }
                }

                if let uploadError {
                    Text(uploadError)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            }
            .navigationTitle("New record")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Upload") {
                        Task { await uploadRecord() }
                    }
                    .disabled(isUploading)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [UTType.pdf]) { result in
                if case let .success(url) = result {
                    selectedFileURL = url
                }
            }
        }
    }

    private func uploadRecord() async {
        uploadError = nil
        isUploading = true
        defer { isUploading = false }

        do {
            let payload = try await buildPayload()
            let success = await appState.uploadMedicalRecord(payload)
            if success {
                dismiss()
            }
        } catch {
            uploadError = error.localizedDescription
        }
    }

    private func buildPayload() async throws -> MedicalRecordUploadRequest {
        if let item = selectedPhotoItem {
            let data = try await item.loadTransferable(type: Data.self)
            guard let data else { throw APIError(message: "Unable to load selected image.") }
            let mimeType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
            let base64 = data.base64EncodedString()
            return MedicalRecordUploadRequest(
                name: title.isEmpty ? "Photo Record" : title,
                type: mimeType,
                size: data.count,
                iv: randomIv(),
                data: base64
            )
        }

        if let url = selectedFileURL {
            let data = try Data(contentsOf: url)
            let base64 = data.base64EncodedString()
            return MedicalRecordUploadRequest(
                name: title.isEmpty ? "PDF Record" : title,
                type: "application/pdf",
                size: data.count,
                iv: randomIv(),
                data: base64
            )
        }

        throw APIError(message: "Select a photo or PDF first.")
    }

    private func randomIv() -> String {
        let bytes = (0..<12).map { _ in UInt8.random(in: 0...255) }
        return Data(bytes).base64EncodedString()
    }
}

#Preview {
    NavigationStack {
        RecordsView()
            .environmentObject(AppState())
    }
}
