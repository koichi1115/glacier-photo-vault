//
//  FilesBackupView.swift
//  GlacierPhotoVault
//
//  「ファイル」フォルダバックアップの画面
//

import SwiftUI
import UniformTypeIdentifiers

struct FilesBackupView: View {
    @StateObject private var manager = FilesBackupManager.shared
    @State private var showingFolderPicker = false

    var body: some View {
        List {
            Section {
                Text("iOSの仕様上、「ファイル」全体の自動バックアップはできません。バックアップしたいフォルダを追加してください。")
                    .font(DADSTypography.caption)
                    .foregroundColor(DADSColor.textSecondary)
            }

            Section {
                ForEach(manager.folders) { folder in
                    HStack {
                        Image(systemName: "folder.fill")
                            .foregroundColor(DADSColor.primary)
                        Text(folder.name)
                        Spacer()
                    }
                }
                .onDelete { indexSet in
                    for index in indexSet {
                        manager.removeFolder(manager.folders[index])
                    }
                }

                Button {
                    showingFolderPicker = true
                } label: {
                    Label("フォルダを追加", systemImage: "plus")
                }
            } header: {
                Text("バックアップ対象フォルダ")
            }

            Section {
                if manager.isBackingUp {
                    VStack(alignment: .leading, spacing: DADSSpacing.xs) {
                        if let name = manager.currentItemName {
                            Text(name)
                                .font(DADSTypography.small)
                                .foregroundColor(DADSColor.textSecondary)
                                .lineLimit(1)
                        }
                        ProgressView(
                            value: Double(manager.completedCount),
                            total: Double(max(1, manager.completedCount + manager.pendingCount))
                        )
                        Text("\(manager.completedCount)件完了 / 残り\(manager.pendingCount)件")
                            .font(DADSTypography.small)
                            .foregroundColor(DADSColor.textSecondary)
                    }
                    .padding(.vertical, DADSSpacing.xs)

                    Button(role: .destructive) {
                        manager.cancelBackup()
                    } label: {
                        Label("中断", systemImage: "stop.circle")
                            .frame(maxWidth: .infinity)
                    }
                } else {
                    Button {
                        Task { await manager.startBackup() }
                    } label: {
                        Label("フォルダをバックアップ", systemImage: "icloud.and.arrow.up")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(manager.folders.isEmpty)
                }

                if let error = manager.lastError {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .font(DADSTypography.small)
                        .foregroundColor(DADSColor.error)
                }
            }
        }
        .navigationTitle("ファイルバックアップ")
        .navigationBarTitleDisplayMode(.inline)
        .fileImporter(
            isPresented: $showingFolderPicker,
            allowedContentTypes: [.folder],
            allowsMultipleSelection: false
        ) { result in
            if case .success(let urls) = result, let url = urls.first {
                manager.addFolder(url: url)
            }
        }
    }
}

#Preview {
    NavigationView { FilesBackupView() }
}
