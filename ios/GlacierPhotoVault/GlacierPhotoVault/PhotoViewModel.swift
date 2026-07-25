//
//  PhotoViewModel.swift
//  GlacierPhotoVault
//

import Foundation
import SwiftUI
import Combine

@MainActor
class PhotoViewModel: ObservableObject {
    @Published var photos: [Photo] = []
    @Published var stats: PhotoStats?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var uploadProgress: Double?

    private let apiClient = APIClient.shared

    private var userId: String? {
        AuthManager.shared.currentUser?.userId
    }

    /// ログイン直後などにユーザー情報を確定させてから読み込む
    func ensureUserLoaded() async {
        if AuthManager.shared.currentUser == nil, AuthManager.shared.isAuthenticated {
            AuthManager.shared.currentUser = try? await apiClient.getMe()
        }
    }

    func loadPhotos() async {
        await ensureUserLoaded()
        guard let userId else { return }
        isLoading = true
        errorMessage = nil

        do {
            photos = try await apiClient.getUserPhotos(userId: userId)
        } catch {
            errorMessage = "写真の読み込みに失敗しました: \(error.localizedDescription)"
        }

        isLoading = false
    }

    func loadStats() async {
        guard let userId else { return }
        do {
            stats = try await apiClient.getUserStats(userId: userId)
        } catch {
            print("Stats load error: \(error)")
        }
    }

    /// プリサインドURL経由の直接アップロード
    func uploadFile(
        data: Data,
        fileName: String,
        mimeType: String,
        title: String?,
        description: String?,
        tags: [String]
    ) async {
        isLoading = true
        errorMessage = nil
        uploadProgress = 0

        do {
            let photo = try await apiClient.uploadFile(
                data: data,
                fileName: fileName,
                mimeType: mimeType,
                title: title,
                description: description,
                tags: tags,
                progress: { [weak self] p in
                    Task { @MainActor in self?.uploadProgress = p }
                }
            )
            photos.insert(photo, at: 0)
            await loadStats()
        } catch {
            errorMessage = "アップロードに失敗しました: \(error.localizedDescription)"
        }

        isLoading = false
        uploadProgress = nil
    }

    func requestRestore(photoId: String, tier: String) async {
        errorMessage = nil

        do {
            let response = try await apiClient.requestRestore(photoId: photoId, tier: tier)
            await loadPhotos()
            if let hours = response.estimatedHours {
                errorMessage = "復元をリクエストしました（約\(hours)時間）"
            }
        } catch {
            errorMessage = "復元リクエストに失敗しました: \(error.localizedDescription)"
        }
    }

    func checkRestoreStatus(photoId: String) async {
        do {
            _ = try await apiClient.checkRestoreStatus(photoId: photoId)
            await loadPhotos()
        } catch {
            errorMessage = "状態確認に失敗しました: \(error.localizedDescription)"
        }
    }

    func getDownloadURL(photoId: String) async -> String? {
        do {
            return try await apiClient.getDownloadURL(photoId: photoId)
        } catch {
            errorMessage = "ダウンロードURLの取得に失敗しました: \(error.localizedDescription)"
            return nil
        }
    }

    func refresh() async {
        await loadPhotos()
        await loadStats()
    }
}
