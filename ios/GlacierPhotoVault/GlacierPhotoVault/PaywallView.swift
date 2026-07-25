//
//  PaywallView.swift
//  GlacierPhotoVault
//
//  サブスクリプション未加入時のプラン選択画面（StoreKit 2）
//

import SwiftUI
import StoreKit

struct PaywallView: View {
    @StateObject private var store = StoreKitManager.shared
    let onSubscribed: () -> Void

    @State private var purchasing = false

    var body: some View {
        ScrollView {
            VStack(spacing: DADSSpacing.lg) {
                Image(systemName: "archivebox.fill")
                    .font(.system(size: 56))
                    .foregroundColor(DADSColor.primary)
                    .padding(.top, DADSSpacing.xl)

                VStack(spacing: DADSSpacing.xs) {
                    Text("プランを選択")
                        .font(DADSTypography.title1)
                        .foregroundColor(DADSColor.textPrimary)
                    Text("iCloudの半額以下で、写真もファイルも長期保管")
                        .font(DADSTypography.caption)
                        .foregroundColor(DADSColor.textSecondary)
                }

                if store.isLoading {
                    ProgressView().padding(DADSSpacing.xl)
                } else if store.products.isEmpty {
                    VStack(spacing: DADSSpacing.sm) {
                        Text("プラン情報を取得できませんでした")
                            .font(DADSTypography.body)
                            .foregroundColor(DADSColor.textSecondary)
                        Button("再読み込み") {
                            Task { await store.loadProducts() }
                        }
                    }
                    .padding(DADSSpacing.xl)
                } else {
                    VStack(spacing: DADSSpacing.md) {
                        ForEach(store.products, id: \.id) { product in
                            Button {
                                purchase(product)
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: DADSSpacing.xxs) {
                                        Text(product.displayName)
                                            .font(DADSTypography.bodyBold)
                                            .foregroundColor(DADSColor.textPrimary)
                                        Text(product.description)
                                            .font(DADSTypography.small)
                                            .foregroundColor(DADSColor.textSecondary)
                                    }
                                    Spacer()
                                    Text(product.displayPrice + "/月")
                                        .font(DADSTypography.title3)
                                        .foregroundColor(DADSColor.primary)
                                }
                                .padding(DADSSpacing.md)
                                .background(DADSColor.backgroundCard)
                                .cornerRadius(DADSRadius.large)
                                .overlay(
                                    RoundedRectangle(cornerRadius: DADSRadius.large)
                                        .stroke(DADSColor.border, lineWidth: 1)
                                )
                            }
                            .disabled(purchasing)
                        }
                    }
                    .padding(.horizontal, DADSSpacing.md)

                    Text("30日間無料トライアル付き・いつでも解約可能")
                        .font(DADSTypography.small)
                        .foregroundColor(DADSColor.textSecondary)
                }

                if let error = store.lastError {
                    Text(error)
                        .font(DADSTypography.small)
                        .foregroundColor(DADSColor.error)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, DADSSpacing.md)
                }

                Button("購入を復元") {
                    Task {
                        await store.restorePurchases()
                        if !store.purchasedProductIds.isEmpty { onSubscribed() }
                    }
                }
                .font(DADSTypography.caption)
                .foregroundColor(DADSColor.textSecondary)
                .padding(.bottom, DADSSpacing.xl)
            }
        }
        .background(DADSColor.backgroundGray.ignoresSafeArea())
        .task {
            await store.loadProducts()
            if !store.purchasedProductIds.isEmpty { onSubscribed() }
        }
    }

    private func purchase(_ product: Product) {
        purchasing = true
        Task {
            let success = await StoreKitManager.shared.purchase(product)
            purchasing = false
            if success { onSubscribed() }
        }
    }
}

#Preview {
    PaywallView(onSubscribed: {})
}
