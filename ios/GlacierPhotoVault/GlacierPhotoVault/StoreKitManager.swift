//
//  StoreKitManager.swift
//  GlacierPhotoVault
//
//  StoreKit 2 によるティア制サブスクリプション購入とサーバー同期。
//  App Store Connect に com.glacierphotovault.tier.* の
//  自動更新サブスクリプションを登録すると productsが取得できるようになる。
//

import Foundation
import StoreKit

@MainActor
final class StoreKitManager: ObservableObject {
    static let shared = StoreKitManager()

    @Published var products: [Product] = []
    @Published var purchasedProductIds: Set<String> = []
    @Published var isLoading = false
    @Published var lastError: String?

    /// サーバーのティア定義と対応するプロダクトID
    static let productIds = [
        "com.glacierphotovault.tier.mini",
        "com.glacierphotovault.tier.standard",
        "com.glacierphotovault.tier.plus",
        "com.glacierphotovault.tier.max",
    ]

    private var updatesTask: Task<Void, Never>?

    private init() {
        // バックグラウンドでのトランザクション更新（更新・返金・ファミリー共有）を監視
        updatesTask = Task {
            for await update in Transaction.updates {
                await self.handle(updateResult: update)
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    func loadProducts() async {
        isLoading = true
        lastError = nil
        do {
            products = try await Product.products(for: Self.productIds)
                .sorted { $0.price < $1.price }
            await refreshEntitlements()
        } catch {
            lastError = "プラン情報の取得に失敗しました: \(error.localizedDescription)"
        }
        isLoading = false
    }

    /// 現在の有効なエンタイトルメントを取得し、サーバーと同期する
    func refreshEntitlements() async {
        var ids: Set<String> = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                ids.insert(transaction.productID)
                // サーバーへ同期（JWS表現を送る）
                _ = try? await APIClient.shared.syncAppleTransaction(
                    signedTransaction: result.jwsRepresentation
                )
            }
        }
        purchasedProductIds = ids
    }

    /// 購入フロー
    func purchase(_ product: Product) async -> Bool {
        lastError = nil
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                await handle(updateResult: verification)
                return true
            case .userCancelled:
                return false
            case .pending:
                lastError = "購入が保留中です（ファミリー承認待ち等）"
                return false
            @unknown default:
                return false
            }
        } catch {
            lastError = "購入に失敗しました: \(error.localizedDescription)"
            return false
        }
    }

    func restorePurchases() async {
        try? await AppStore.sync()
        await refreshEntitlements()
    }

    private func handle(updateResult: VerificationResult<Transaction>) async {
        guard case .verified(let transaction) = updateResult else { return }

        // サーバーで検証・DB同期
        do {
            _ = try await APIClient.shared.syncAppleTransaction(
                signedTransaction: updateResult.jwsRepresentation
            )
            purchasedProductIds.insert(transaction.productID)
        } catch {
            lastError = "サーバーとの同期に失敗しました"
        }

        await transaction.finish()
    }
}
