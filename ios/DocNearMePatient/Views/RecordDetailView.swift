import SwiftUI

struct RecordDetailView: View {
    @EnvironmentObject private var appState: AppState
    let recordId: String
    @State private var record: MedicalRecordDetail? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let record {
                Text(record.name)
                    .font(.title2.weight(.bold))
                Text(record.type)
                    .foregroundStyle(.secondary)
                Text("Uploaded \(DateFormatters.shared.format(dateString: record.createdAt))")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Divider()

                Text("Size: \(record.size) bytes")
                    .font(.body)

                Text("Data stored securely. Decryption is handled when you download or share the file.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Spacer()
            } else {
                ProgressView("Loading record...")
            }
        }
        .padding(20)
        .navigationTitle("Record")
        .task {
            record = await appState.fetchMedicalRecordDetail(id: recordId)
        }
    }
}

#Preview {
    NavigationStack {
        RecordDetailView(recordId: "preview")
            .environmentObject(AppState())
    }
}
