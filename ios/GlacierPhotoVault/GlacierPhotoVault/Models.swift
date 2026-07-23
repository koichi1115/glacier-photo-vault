//
//  Models.swift
//  GlacierPhotoVault
//
//  Created by Claude
//

import Foundation

enum PhotoStatus: String, Codable {
    case uploading = "uploading"
    case archived = "archived"
    case restoreRequested = "restore_requested"
    case restoring = "restoring"
    case restored = "restored"
    case failed = "failed"

    var displayName: String {
        switch self {
        case .uploading: return "アップロード中"
        case .archived: return "アーカイブ済み"
        case .restoreRequested: return "復元リクエスト済み"
        case .restoring: return "復元中"
        case .restored: return "復元完了"
        case .failed: return "失敗"
        }
    }

    var color: String {
        switch self {
        case .uploading: return "blue"
        case .archived: return "gray"
        case .restoreRequested: return "yellow"
        case .restoring: return "orange"
        case .restored: return "green"
        case .failed: return "red"
        }
    }
}

struct Photo: Codable, Identifiable {
    let id: String
    let userId: String
    let filename: String
    let originalName: String
    let mimeType: String
    let size: Int64
    let title: String?
    let description: String?
    let tags: [String]
    let s3Key: String
    let glacierArchiveId: String?
    let status: PhotoStatus
    let uploadedAt: Int64
    let restoredUntil: Int64?
    let thumbnailUrl: String?

    var uploadDate: Date {
        Date(timeIntervalSince1970: TimeInterval(uploadedAt) / 1000)
    }

    var restoredUntilDate: Date? {
        guard let restoredUntil = restoredUntil else { return nil }
        return Date(timeIntervalSince1970: TimeInterval(restoredUntil) / 1000)
    }

    var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: size, countStyle: .file)
    }
}

struct PhotoStats: Codable {
    let totalPhotos: Int
    let totalSize: Int64
    let archived: Int
    let restoring: Int
    let restored: Int

    var formattedTotalSize: String {
        ByteCountFormatter.string(fromByteCount: totalSize, countStyle: .file)
    }
}

struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: String?
}

struct PhotosResponse: Codable {
    let success: Bool
    let photos: [Photo]
    let count: Int?
}

struct PhotoResponse: Codable {
    let success: Bool
    let photo: Photo
    let message: String?
}

struct StatsResponse: Codable {
    let success: Bool
    let stats: PhotoStats
}

struct RestoreResponse: Codable {
    let success: Bool
    let message: String?
    let tier: String?
    let estimatedHours: Int?
}

struct StatusResponse: Codable {
    let success: Bool
    let photoId: String?
    let status: PhotoStatus
}

struct DownloadResponse: Codable {
    let success: Bool
    let downloadUrl: String
    let expiresIn: Int?
}

// MARK: - Auth

struct TokenResponse: Codable {
    let accessToken: String
    let refreshToken: String
}

struct AuthUser: Codable {
    let userId: String
    let email: String?
    let provider: String?
    let displayName: String?
    let profilePhoto: String?
}

struct MeResponse: Codable {
    let user: AuthUser
}

struct APIErrorBody: Codable {
    let error: String?
    let message: String?
}

struct SuccessResponse: Codable {
    let success: Bool
}

// MARK: - Direct upload (presigned)

struct UploadInitRequest: Codable {
    let fileName: String
    let relativePath: String?
    let size: Int
    let mimeType: String
}

struct UploadPartURL: Codable {
    let partNumber: Int
    let url: String
}

struct UploadInitResponse: Codable {
    let success: Bool
    let uploadType: String // "single" | "multipart"
    let key: String
    let url: String?
    let requiredHeaders: [String: String]?
    let uploadId: String?
    let partSize: Int?
    let partUrls: [UploadPartURL]?
}

struct UploadPartETag: Codable {
    let partNumber: Int
    let etag: String
}

struct UploadCompleteRequest: Codable {
    let key: String
    let uploadId: String?
    let parts: [UploadPartETag]?
    let fileName: String
    let mimeType: String
    let title: String?
    let description: String?
    let tags: [String]
    let thumbnail: String?
}

struct UploadAbortRequest: Codable {
    let key: String
    let uploadId: String
}

// MARK: - Billing

struct SubscriptionInfo: Codable {
    let status: String
    let platform: String?
    let tier: String?
    let storageLimitBytes: Int64?
    let trialEnd: Int64?
    let currentPeriodEnd: Int64?
}

struct SubscriptionResponse: Codable {
    let success: Bool
    let subscription: SubscriptionInfo?
    let hasSubscription: Bool
    let isValid: Bool?
    let trialDaysRemaining: Int?
}
