//
//  BackupView.swift
//  GlacierPhotoVault
//
//  写真ライブラリ一括バックアップの画面
//

import SwiftUI
import Photos

struct BackupView: View {
    @StateObject private var backup = BackupManager.shared
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            List {
                // 権限
                if backup.authorizationStatus != .authorized {
                    Section {
                        VStack(alignment: .leading, spacing: DADSSpacing.sm) {
                            Label("フォトライブラリへのアクセス", systemImage: "photo.badge.exclamationmark")
                                .font(DADSTypography.bodyBold)
                            Text("ライブラリ全体をバックアップするには「すべての写真」へのアクセス許可が必要です。")
                                .font(DADSTypography.caption)
                                .foregroundColor(DADSColor.textSecondary)
                            Button("アクセスを許可") {
                                Task { await backup.requestAuthorization() }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .padding(.vertical, DADSSpacing.xs)
                    }
                }

                // 状態
                Section {
                    HStack {
                        Text("ライブラリ内")
                        Spacer()
                        Text("\(backup.totalCount)件")
                            .foregroundColor(DADSColor.textSecondary)
                    }
                    HStack {
                        Text("未バックアップ")
                        Spacer()
                        Text("\(backup.pendingCount)件")
                            .foregroundColor(backup.pendingCount > 0 ? DADSColor.error : DADSColor.textSecondary)
                    }
                    if backup.state == .backingUp {
                        VStack(alignment: .leading, spacing: DADSSpacing.xs) {
                            if let name = backup.currentItemName {
                                Text(name)
                                    .font(DADSTypography.small)
                                    .foregroundColor(DADSColor.textSecondary)
                                    .lineLimit(1)
                            }
                            ProgressView(
                                value: Double(backup.completedCount),
                                total: Double(max(1, backup.completedCount + backup.pendingCount))
                            )
                            Text("\(backup.completedCount)件完了")
                                .font(DADSTypography.small)
                                .foregroundColor(DADSColor.textSecondary)
                        }
                        .padding(.vertical, DADSSpacing.xs)
                    }
                    if case .paused(let reason) = backup.state {
                        Label(reason, systemImage: "pause.circle")
                            .foregroundColor(DADSColor.textSecondary)
                    }
                    if let error = backup.lastError {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .font(DADSTypography.small)
                            .foregroundColor(DADSColor.error)
                    }
                } header: {
                    Text("バックアップ状況")
                }

                // 設定
                Section {
                    Toggle("WiFi接続時のみバックアップ", isOn: $backup.wifiOnly)
                } header: {
                    Text("設定")
                } footer: {
                    Text("バックアップはGlacier Deep Archiveに保存されます。取り出しには時間がかかりますが、超低コストで保管できます。")
                }

                // 操作
                Section {
                    if backup.state == .backingUp {
                        Button(role: .destructive) {
                            backup.cancelBackup()
                        } label: {
                            Label("バックアップを中断", systemImage: "stop.circle")
                                .frame(maxWidth: .infinity)
                        }
                    } else {
                        Button {
                            Task { await backup.startBackup() }
                        } label: {
                            Label("今すぐバックアップ", systemImage: "icloud.and.arrow.up")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                        }
                        .disabled(backup.authorizationStatus != .authorized && backup.authorizationStatus != .limited)
                    }
                }
            }
            .navigationTitle("ライブラリバックアップ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("閉じる") { dismiss() }
                }
            }
            .task {
                if backup.authorizationStatus == .notDetermined {
                    await backup.requestAuthorization()
                }
                backup.scanPending()
            }
        }
    }
}

#Preview {
    BackupView()
}
