//
//  APIClient.swift
//  GlacierPhotoVault
//
//  認証付きAPIクライアント + PKCE OAuth認証マネージャ
//

import Foundation
import AuthenticationServices
import CryptoKit
import UIKit

// MARK: - Configuration

enum AppConfig {
    /// バックエンドのベースURL。Info.plist の APIBaseURL で上書き可能。
    static var apiBaseURL: URL {
        if let s = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String,
           let url = URL(string: s), !s.isEmpty {
            return url
        }
        return URL(string: "https://glacier-photo-vault.onrender.com")!
    }

    static let callbackScheme = "glaciervault"
}

// MARK: - Keychain

/// トークン保管用の最小限のKeychainラッパー
enum Keychain {
    private static func query(for key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.glacierphotovault.tokens",
            kSecAttrAccount as String: key,
        ]
    }

    static func set(_ value: String, for key: String) {
        let data = Data(value.utf8)
        var q = query(for: key)
        SecItemDelete(q as CFDictionary)
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(q as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        var q = query(for: key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(_ key: String) {
        SecItemDelete(query(for: key) as CFDictionary)
    }
}

// MARK: - AuthManager

enum AuthProvider: String {
    case google
    case line
}

@MainActor
final class AuthManager: NSObject, ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated: Bool
    @Published var currentUser: AuthUser?

    private var webAuthSession: ASWebAuthenticationSession?

    private override init() {
        isAuthenticated = Keychain.get("accessToken") != nil
        super.init()
    }

    var accessToken: String? { Keychain.get("accessToken") }
    var refreshToken: String? { Keychain.get("refreshToken") }

    /// PKCE付きOAuthサインイン（Google / LINE）
    func signIn(provider: AuthProvider) async throws {
        // PKCE: verifier(乱数) と challenge(S256) を生成
        let verifier = Self.randomURLSafeString(length: 64)
        let challenge = Self.s256(verifier)

        var components = URLComponents(
            url: AppConfig.apiBaseURL.appendingPathComponent("/api/auth/\(provider.rawValue)"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "client", value: "ios"),
        ]

        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: components.url!,
                callbackURLScheme: AppConfig.callbackScheme
            ) { url, error in
                if let url = url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: error ?? APIError.authenticationFailed)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.webAuthSession = session
            session.start()
        }

        guard let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "code" })?.value else {
            throw APIError.authenticationFailed
        }

        try await exchangeCode(code, verifier: verifier)
        currentUser = try? await APIClient.shared.getMe()
    }

    /// 認可コード + code_verifier をトークンに交換
    private func exchangeCode(_ code: String, verifier: String) async throws {
        var request = URLRequest(url: AppConfig.apiBaseURL.appendingPathComponent("/api/auth/token"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["code": code, "code_verifier": verifier])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.authenticationFailed
        }
        let tokens = try JSONDecoder().decode(TokenResponse.self, from: data)
        Keychain.set(tokens.accessToken, for: "accessToken")
        Keychain.set(tokens.refreshToken, for: "refreshToken")
        isAuthenticated = true
    }

    /// Sign in with Apple: 検証済みidentityTokenをバックエンドに渡してトークンを得る
    func signInWithApple(identityToken: String, fullName: String?) async throws {
        var request = URLRequest(url: AppConfig.apiBaseURL.appendingPathComponent("/api/auth/apple"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: String] = ["identityToken": identityToken]
        if let fullName, !fullName.isEmpty { body["fullName"] = fullName }
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.authenticationFailed
        }
        let tokens = try JSONDecoder().decode(TokenResponse.self, from: data)
        Keychain.set(tokens.accessToken, for: "accessToken")
        Keychain.set(tokens.refreshToken, for: "refreshToken")
        isAuthenticated = true
        currentUser = try? await APIClient.shared.getMe()
    }

    /// リフレッシュトークンでアクセストークンを更新。失敗時はfalse。
    func refreshTokens() async -> Bool {
        guard let refresh = refreshToken else { return false }
        do {
            var request = URLRequest(url: AppConfig.apiBaseURL.appendingPathComponent("/api/auth/refresh"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["refreshToken": refresh])

            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return false
            }
            let tokens = try JSONDecoder().decode(TokenResponse.self, from: data)
            Keychain.set(tokens.accessToken, for: "accessToken")
            Keychain.set(tokens.refreshToken, for: "refreshToken")
            return true
        } catch {
            return false
        }
    }

    func signOut() {
        if let refresh = refreshToken {
            var request = URLRequest(url: AppConfig.apiBaseURL.appendingPathComponent("/api/auth/logout"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONEncoder().encode(["refreshToken": refresh])
            URLSession.shared.dataTask(with: request).resume()
        }
        Keychain.delete("accessToken")
        Keychain.delete("refreshToken")
        isAuthenticated = false
        currentUser = nil
    }

    // MARK: PKCE helpers

    private static func randomURLSafeString(length: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        return Data(bytes).base64URLEncodedString()
    }

    private static func s256(_ input: String) -> String {
        let hash = SHA256.hash(data: Data(input.utf8))
        return Data(hash).base64URLEncodedString()
    }
}

extension AuthManager: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return ASPresentationAnchor()
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

// MARK: - APIClient

final class APIClient {
    static let shared = APIClient()
    private init() {}

    private var baseURL: URL { AppConfig.apiBaseURL }

    // MARK: Authenticated request helper

    /// Bearerトークン付きリクエスト。401時は1回だけリフレッシュして再試行。
    private func authorizedData(
        for request: URLRequest,
        retryOnUnauthorized: Bool = true
    ) async throws -> (Data, HTTPURLResponse) {
        var req = request
        guard let token = await AuthManager.shared.accessToken else {
            throw APIError.notAuthenticated
        }
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIError.serverError }

        if http.statusCode == 401 && retryOnUnauthorized {
            if await AuthManager.shared.refreshTokens() {
                return try await authorizedData(for: request, retryOnUnauthorized: false)
            }
            await MainActor.run { AuthManager.shared.signOut() }
            throw APIError.notAuthenticated
        }
        guard (200...299).contains(http.statusCode) else {
            if let apiErr = try? JSONDecoder().decode(APIErrorBody.self, from: data) {
                throw APIError.api(apiErr.message ?? apiErr.error ?? "サーバーエラー")
            }
            throw APIError.serverError
        }
        return (data, http)
    }

    private func getJSON<T: Decodable>(_ path: String) async throws -> T {
        let request = URLRequest(url: baseURL.appendingPathComponent(path))
        let (data, _) = try await authorizedData(for: request)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func postJSON<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, _) = try await authorizedData(for: request)
        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: Auth

    func getMe() async throws -> AuthUser {
        let res: MeResponse = try await getJSON("/api/auth/me")
        return res.user
    }

    // MARK: Upload (presigned direct-to-S3)

    /// プリサインドURL方式でファイルをS3へ直接アップロードする。
    /// init → S3 PUT（サイズに応じて単一/マルチパート） → complete。
    func uploadFile(
        data: Data,
        fileName: String,
        mimeType: String,
        relativePath: String? = nil,
        title: String? = nil,
        description: String? = nil,
        tags: [String] = [],
        progress: ((Double) -> Void)? = nil
    ) async throws -> Photo {
        // 1. init
        let initBody = UploadInitRequest(
            fileName: fileName,
            relativePath: relativePath,
            size: data.count,
            mimeType: mimeType
        )
        let initRes: UploadInitResponse = try await postJSON("/api/uploads/init", body: initBody)

        // 2. S3へ直接PUT
        var parts: [UploadPartETag]? = nil
        if initRes.uploadType == "single" {
            guard let urlString = initRes.url, let url = URL(string: urlString) else {
                throw APIError.serverError
            }
            var put = URLRequest(url: url)
            put.httpMethod = "PUT"
            for (k, v) in initRes.requiredHeaders ?? [:] {
                put.setValue(v, forHTTPHeaderField: k)
            }
            let (_, resp) = try await URLSession.shared.upload(for: put, from: data)
            guard let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                throw APIError.uploadFailed
            }
            progress?(1.0)
        } else {
            guard let uploadId = initRes.uploadId,
                  let partSize = initRes.partSize,
                  let partUrls = initRes.partUrls else {
                throw APIError.serverError
            }
            var collected: [UploadPartETag] = []
            do {
                for part in partUrls {
                    guard let url = URL(string: part.url) else { throw APIError.serverError }
                    let start = (part.partNumber - 1) * partSize
                    let end = min(start + partSize, data.count)
                    let chunk = data.subdata(in: start..<end)

                    var put = URLRequest(url: url)
                    put.httpMethod = "PUT"
                    let (_, resp) = try await URLSession.shared.upload(for: put, from: chunk)
                    guard let http = resp as? HTTPURLResponse,
                          (200...299).contains(http.statusCode),
                          let etag = http.value(forHTTPHeaderField: "ETag") else {
                        throw APIError.uploadFailed
                    }
                    collected.append(UploadPartETag(
                        partNumber: part.partNumber,
                        etag: etag.replacingOccurrences(of: "\"", with: "")
                    ))
                    progress?(Double(end) / Double(data.count))
                }
            } catch {
                // 失敗時は未完了パートを掃除
                let abortBody = UploadAbortRequest(key: initRes.key, uploadId: uploadId)
                let _: SuccessResponse? = try? await postJSON("/api/uploads/abort", body: abortBody)
                throw error
            }
            parts = collected
        }

        // 3. complete
        let completeBody = UploadCompleteRequest(
            key: initRes.key,
            uploadId: initRes.uploadType == "multipart" ? initRes.uploadId : nil,
            parts: parts,
            fileName: fileName,
            mimeType: mimeType,
            title: title,
            description: description,
            tags: tags,
            thumbnail: nil
        )
        let res: PhotoResponse = try await postJSON("/api/uploads/complete", body: completeBody)
        return res.photo
    }

    // MARK: Photos

    func getUserPhotos(userId: String) async throws -> [Photo] {
        let res: PhotosResponse = try await getJSON("/api/photos/user/\(userId)")
        return res.photos
    }

    func getUserStats(userId: String) async throws -> PhotoStats {
        let res: StatsResponse = try await getJSON("/api/photos/user/\(userId)/stats")
        return res.stats
    }

    func requestRestore(photoId: String, tier: String = "Bulk") async throws -> RestoreResponse {
        try await postJSON("/api/photos/\(photoId)/restore", body: ["tier": tier])
    }

    func checkRestoreStatus(photoId: String) async throws -> PhotoStatus {
        let res: StatusResponse = try await getJSON("/api/photos/\(photoId)/restore/status")
        return res.status
    }

    func getDownloadURL(photoId: String) async throws -> String {
        let res: DownloadResponse = try await getJSON("/api/photos/\(photoId)/download")
        return res.downloadUrl
    }

    // MARK: Billing

    func getSubscription() async throws -> SubscriptionResponse {
        try await getJSON("/api/billing/subscription")
    }
}

// MARK: - Errors

enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidImage
    case serverError
    case decodingError
    case notAuthenticated
    case authenticationFailed
    case uploadFailed
    case api(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "無効なURLです"
        case .invalidImage: return "画像の変換に失敗しました"
        case .serverError: return "サーバーエラーが発生しました"
        case .decodingError: return "データの解析に失敗しました"
        case .notAuthenticated: return "ログインが必要です"
        case .authenticationFailed: return "ログインに失敗しました"
        case .uploadFailed: return "アップロードに失敗しました"
        case .api(let message): return message
        }
    }
}
