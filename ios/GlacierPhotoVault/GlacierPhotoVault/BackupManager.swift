//
//  BackupManager.swift
//  GlacierPhotoVault
//
//  写真ライブラリの差分バックアップエンジン。
//  台帳（アップロード済みアセットの記録）と差分検出、逐次アップロードを担う。
//
//  将来: iOS 26.1+ の PHBackgroundResourceUploadExtension
//  （com.apple.photos.background-upload）をextensionターゲットとして追加し、
//  本エンジンの台帳を共有してバックグラウンド自動化する。
//

import Foundation
import Photos
import Network
import SwiftUI

// MARK: - Ledger（台帳）

/// アップロード済みアセットの永続台帳（Application Support配下のJSONファイル）
final class BackupLedger {
    private var entries: [String: String] // localIdentifier -> s3 relativePath
    private let fileURL: URL
    private let queue = DispatchQueue(label: "com.glacierphotovault.ledger")

    init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("GlacierPhotoVault", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("backup-ledger.json")

        if let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode([String: String].self, from: data) {
            entries = decoded
        } else {
            entries = [:]
        }
    }

    func isUploaded(_ localIdentifier: String) -> Bool {
        queue.sync { entries[localIdentifier] != nil }
    }

    func markUploaded(_ localIdentifier: String, path: String) {
        queue.sync {
            entries[localIdentifier] = path
            if let data = try? JSONEncoder().encode(entries) {
                try? data.write(to: fileURL, options: .atomic)
            }
        }
    }

    var count: Int { queue.sync { entries.count } }
}

// MARK: - BackupManager

@MainActor
final class BackupManager: ObservableObject {
    static let shared = BackupManager()

    enum State: Equatable {
        case idle
        case scanning
        case backingUp
        case paused(reason: String)
    }

    @Published var state: State = .idle
    @Published var totalCount = 0
    @Published var completedCount = 0
    @Published var pendingCount = 0
    @Published var currentItemName: String?
    @Published var lastError: String?
    @Published var authorizationStatus: PHAuthorizationStatus = .notDetermined

    /// WiFi接続時のみバックアップする設定
    @AppStorage("wifiOnlyBackup") var wifiOnly = true

    private let ledger = BackupLedger()
    private var cancelRequested = false
    private let pathMonitor = NWPathMonitor()
    private var isOnWifi = false

    private init() {
        authorizationStatus = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        pathMonitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isOnWifi = path.usesInterfaceType(.wifi) || path.usesInterfaceType(.wiredEthernet)
            }
        }
        pathMonitor.start(queue: DispatchQueue(label: "com.glacierphotovault.network"))
    }

    /// フォトライブラリのフルアクセスを要求
    func requestAuthorization() async {
        let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        authorizationStatus = status
    }

    /// 未バックアップ件数を数える（軽量スキャン）
    func scanPending() {
        guard authorizationStatus == .authorized || authorizationStatus == .limited else { return }
        state = .scanning

        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        let assets = PHAsset.fetchAssets(with: options)

        var pending = 0
        assets.enumerateObjects { [ledger] asset, _, _ in
            if !ledger.isUploaded(asset.localIdentifier) { pending += 1 }
        }
        totalCount = assets.count
        pendingCount = pending
        state = .idle
    }

    /// 差分バックアップを実行（フォアグラウンド逐次）
    func startBackup() async {
        guard state == .idle || state == .scanning else { return }
        guard authorizationStatus == .authorized || authorizationStatus == .limited else {
            await requestAuthorization()
            guard authorizationStatus == .authorized || authorizationStatus == .limited else { return }
        }

        cancelRequested = false
        lastError = nil
        state = .backingUp

        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        let assets = PHAsset.fetchAssets(with: options)
        totalCount = assets.count

        var pendingAssets: [PHAsset] = []
        assets.enumerateObjects { [ledger] asset, _, _ in
            if !ledger.isUploaded(asset.localIdentifier) { pendingAssets.append(asset) }
        }
        pendingCount = pendingAssets.count
        completedCount = 0

        for asset in pendingAssets {
            if cancelRequested { break }
            if wifiOnly && !isOnWifi {
                state = .paused(reason: "WiFi接続待ち")
                return
            }

            do {
                try await uploadAsset(asset)
                completedCount += 1
                pendingCount = max(0, pendingCount - 1)
            } catch {
                // 個別の失敗は記録して続行（次回リトライ対象として台帳に載せない）
                lastError = "\(currentItemName ?? "item"): \(error.localizedDescription)"
            }
        }

        currentItemName = nil
        state = .idle
    }

    func cancelBackup() {
        cancelRequested = true
    }

    // MARK: - Asset upload

    private func uploadAsset(_ asset: PHAsset) async throws {
        guard let resource = primaryResource(for: asset) else {
            throw APIError.invalidImage
        }

        currentItemName = resource.originalFilename

        let data = try await resourceData(resource)
        let mimeType = mimeTypeForFilename(resource.originalFilename, mediaType: asset.mediaType)
        // アセットIDでパスを一意化（同名ファイルの衝突回避）
        let safeId = asset.localIdentifier.replacingOccurrences(of: "/", with: "_")
        let relativePath = "library/\(safeId)/\(resource.originalFilename)"

        _ = try await APIClient.shared.uploadFile(
            data: data,
            fileName: resource.originalFilename,
            mimeType: mimeType,
            relativePath: relativePath,
            title: resource.originalFilename,
            tags: asset.mediaType == .video ? ["video", "auto-backup"] : ["photo", "auto-backup"]
        )

        ledger.markUploaded(asset.localIdentifier, path: relativePath)
    }

    /// オリジナル品質のプライマリリソースを選択（編集版より元データを優先）
    private func primaryResource(for asset: PHAsset) -> PHAssetResource? {
        let resources = PHAssetResource.assetResources(for: asset)
        let preferred: [PHAssetResourceType] = asset.mediaType == .video
            ? [.video, .fullSizeVideo]
            : [.photo, .fullSizePhoto]
        for type in preferred {
            if let r = resources.first(where: { $0.type == type }) { return r }
        }
        return resources.first
    }

    private func resourceData(_ resource: PHAssetResource) async throws -> Data {
        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true // iCloud最適化ストレージからの取得を許可

        return try await withCheckedThrowingContinuation { continuation in
            var buffer = Data()
            PHAssetResourceManager.default().requestData(
                for: resource,
                options: options
            ) { chunk in
                buffer.append(chunk)
            } completionHandler: { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: buffer)
                }
            }
        }
    }

    private func mimeTypeForFilename(_ filename: String, mediaType: PHAssetMediaType) -> String {
        let ext = (filename as NSString).pathExtension.lowercased()
        switch ext {
        case "jpg", "jpeg": return "image/jpeg"
        case "png": return "image/png"
        case "heic": return "image/heic"
        case "heif": return "image/heif"
        case "gif": return "image/gif"
        case "tiff", "tif": return "image/tiff"
        case "dng": return "image/x-adobe-dng"
        case "webp": return "image/webp"
        case "mov": return "video/quicktime"
        case "mp4": return "video/mp4"
        case "m4v": return "video/x-m4v"
        default:
            return mediaType == .video ? "video/mp4" : "application/octet-stream"
        }
    }
}
