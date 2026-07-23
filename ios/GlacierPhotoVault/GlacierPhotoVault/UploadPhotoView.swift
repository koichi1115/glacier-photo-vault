//
//  UploadPhotoView.swift
//  GlacierPhotoVault
//
//  Created by Claude
//

import SwiftUI
import PhotosUI

struct UploadPhotoView: View {
    @ObservedObject var viewModel: PhotoViewModel
    @Environment(\.dismiss) var dismiss

    @State private var selectedImage: UIImage?
    @State private var title = ""
    @State private var description = ""
    @State private var tagInput = ""
    @State private var tags: [String] = []
    @State private var showingImagePicker = false
    @State private var isUploading = false

    var body: some View {
        NavigationView {
            Form {
                Section {
                    if let image = selectedImage {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 200)
                            .cornerRadius(8)
                    }

                    Button(action: { showingImagePicker = true }) {
                        Label(
                            selectedImage == nil ? "写真を選択" : "写真を変更",
                            systemImage: "photo.on.rectangle.angled"
                        )
                    }
                } header: {
                    Text("写真")
                }

                Section {
                    TextField("タイトル（オプション）", text: $title)

                    TextField("説明（オプション）", text: $description, axis: .vertical)
                        .lineLimit(3...5)
                } header: {
                    Text("詳細")
                }

                Section {
                    HStack {
                        TextField("タグを入力", text: $tagInput)
                        Button(action: addTag) {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(.blue)
                        }
                        .disabled(tagInput.isEmpty)
                    }

                    if !tags.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(tags, id: \.self) { tag in
                                    HStack {
                                        Text(tag)
                                            .font(.caption)
                                        Button(action: { removeTag(tag) }) {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.caption)
                                        }
                                    }
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.blue.opacity(0.1))
                                    .foregroundColor(.blue)
                                    .cornerRadius(12)
                                }
                            }
                        }
                    }
                } header: {
                    Text("タグ")
                }

                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Glacier Deep Archiveに保管", systemImage: "archivebox")
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        Text("• 超低コストの長期保管\n• アップロード時は無料\n• 取り出しには12-48時間必要")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                Section {
                    Button(action: upload) {
                        if isUploading {
                            HStack {
                                ProgressView()
                                Text("アップロード中...")
                            }
                            .frame(maxWidth: .infinity)
                        } else {
                            Text("Glacier Deep Archiveにアップロード")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(selectedImage == nil || isUploading)
                }
            }
            .navigationTitle("写真をアップロード")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("キャンセル") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingImagePicker) {
                ImagePicker(image: $selectedImage)
            }
        }
    }

    private func addTag() {
        let trimmed = tagInput.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty && !tags.contains(trimmed) {
            tags.append(trimmed)
            tagInput = ""
        }
    }

    private func removeTag(_ tag: String) {
        tags.removeAll { $0 == tag }
    }

    private func upload() {
        guard let image = selectedImage else { return }

        isUploading = true

        Task {
            guard let data = image.jpegData(compressionQuality: 0.9) else {
                isUploading = false
                return
            }
            let fileName = "photo_\(Int(Date().timeIntervalSince1970)).jpg"
            await viewModel.uploadFile(
                data: data,
                fileName: fileName,
                mimeType: "image/jpeg",
                title: title.isEmpty ? nil : title,
                description: description.isEmpty ? nil : description,
                tags: tags
            )

            isUploading = false
            dismiss()
        }
    }
}

// Image Picker
struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) var dismiss

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.filter = .images
        config.selectionLimit = 1

        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: ImagePicker

        init(_ parent: ImagePicker) {
            self.parent = parent
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            parent.dismiss()

            guard let provider = results.first?.itemProvider else { return }

            if provider.canLoadObject(ofClass: UIImage.self) {
                provider.loadObject(ofClass: UIImage.self) { image, error in
                    DispatchQueue.main.async {
                        self.parent.image = image as? UIImage
                    }
                }
            }
        }
    }
}

#Preview {
    UploadPhotoView(viewModel: PhotoViewModel())
}
