//
//  FilesBackupManager.swift
//  GlacierPhotoVault
//
//  「ファイル」アプリのフォルダ単位バックアップ。
//  iOSのサンドボックス制約により「全ファイル」への自動アクセスは不可能なため、
//  ユーザーがフォルダピッカーで選択したフォルダを security-scoped bookmark で
//  保持し、そのツリーを差分バックアップする方式をとる。
//

import Foundation
import SwiftUI

struct BackupFolder: Identifiable {
    let id: String       // bookmarkのハッシュ
    let name: String
    let bookmark: Data
}

@MainActor
final class FilesBackupManager: ObservableObject {
    static let shared = FilesBackupManager()

    @Published var folders: [BackupFolder] = []
    @Published var isBackingUp = false
    @Published var completedCount = 0
    @Published var pendingCount = 0
    @Published var currentItemName: String?
    @Published var lastError: String?

    private let bookmarksKey = "filesBackupBookmarks"
    private var cancelRequested = false

    /// アップロード済みファイルの台帳（キー: フォルダID/相対パス/更新日時）
    private var ledger: [String: String]
    private let ledgerURL: URL

    private init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("GlacierPhotoVault", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        ledgerURL = dir.appendingPathComponent("files-ledger.json")
        if let data = try? Data(contentsOf: ledgerURL),
           let decoded = try? JSONDecoder().decode([String: String].self, from: data) {
            ledger = decoded
        } else {
            ledger = [:]
        }
        loadFolders()
    }

    // MARK: - Folder management

    private func loadFolders() {
        guard let stored = UserDefaults.standard.array(forKey: bookmarksKey) as? [Data] else { return }
        folders = stored.compactMap { data in
            var stale = false
            guard let url = try? URL(
                resolvingBookmarkData: data,
                bookmarkDataIsStale: &stale
            ) else { return nil }
            return BackupFolder(
                id: String(data.hashValue),
                name: url.lastPathComponent,
                bookmark: data
            )
        }
    }

    /// フォルダピッカーで選択されたフォルダを登録する
    func addFolder(url: URL) {
        guard url.startAccessingSecurityScopedResource() else {
            lastError = "フォルダへのアクセスに失敗しました"
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        do {
            let bookmark = try url.bookmarkData(
                options: .minimalBookmark,
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )
            var stored = (UserDefaults.standard.array(forKey: bookmarksKey) as? [Data]) ?? []
            stored.append(bookmark)
            UserDefaults.standard.set(stored, forKey: bookmarksKey)
            loadFolders()
        } catch {
            lastError = "フォルダの登録に失敗しました: \(error.localizedDescription)"
        }
    }

    func removeFolder(_ folder: BackupFolder) {
        var stored = (UserDefaults.standard.array(forKey: bookmarksKey) as? [Data]) ?? []
        stored.removeAll { String($0.hashValue) == folder.id }
        UserDefaults.standard.set(stored, forKey: bookmarksKey)
        loadFolders()
    }

    // MARK: - Backup

    func startBackup() async {
        guard !isBackingUp else { return }
        isBackingUp = true
        cancelRequested = false
        lastError = nil
        completedCount = 0

        for folder in folders {
            if cancelRequested { break }
            await backupFolder(folder)
        }

        currentItemName = nil
        isBackingUp = false
    }

    func cancelBackup() {
        cancelRequested = true
    }

    private func backupFolder(_ folder: BackupFolder) async {
        var stale = false
        guard let rootURL = try? URL(
            resolvingBookmarkData: folder.bookmark,
            bookmarkDataIsStale: &stale
        ) else {
            lastError = "\(folder.name): フォルダを解決できません（削除された可能性）"
            return
        }

        guard rootURL.startAccessingSecurityScopedResource() else {
            lastError = "\(folder.name): アクセス権を取得できません"
            return
        }
        defer { rootURL.stopAccessingSecurityScopedResource() }

        let keys: [URLResourceKey] = [.isRegularFileKey, .contentModificationDateKey, .fileSizeKey]
        guard let enumerator = FileManager.default.enumerator(
            at: rootURL,
            includingPropertiesForKeys: keys,
            options: [.skipsHiddenFiles]
        ) else { return }

        var pending: [(URL, String, String)] = [] // (url, relativePath, ledgerKey)
        for case let fileURL as URL in enumerator {
            guard let values = try? fileURL.resourceValues(forKeys: Set(keys)),
                  values.isRegularFile == true else { continue }
            let relPath = fileURL.path.replacingOccurrences(of: rootURL.path + "/", with: "")
            let mtime = values.contentModificationDate?.timeIntervalSince1970 ?? 0
            let ledgerKey = "\(folder.id)/\(relPath)/\(Int(mtime))"
            if ledger[ledgerKey] == nil {
                pending.append((fileURL, relPath, ledgerKey))
            }
        }
        pendingCount = pending.count

        for (fileURL, relPath, ledgerKey) in pending {
            if cancelRequested { break }
            currentItemName = relPath
            do {
                let data = try Data(contentsOf: fileURL)
                let remotePath = "files/\(folder.name)/\(relPath)"
                _ = try await APIClient.shared.uploadFile(
                    data: data,
                    fileName: fileURL.lastPathComponent,
                    mimeType: "application/octet-stream",
                    relativePath: remotePath,
                    title: fileURL.lastPathComponent,
                    tags: ["file", "auto-backup"]
                )
                ledger[ledgerKey] = remotePath
                saveLedger()
                completedCount += 1
                pendingCount = max(0, pendingCount - 1)
            } catch {
                lastError = "\(relPath): \(error.localizedDescription)"
            }
        }
    }

    private func saveLedger() {
        if let data = try? JSONEncoder().encode(ledger) {
            try? data.write(to: ledgerURL, options: .atomic)
        }
    }
}
