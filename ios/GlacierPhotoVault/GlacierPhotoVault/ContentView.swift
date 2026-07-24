//
//  ContentView.swift
//  GlacierPhotoVault
//
//  デジタル庁デザインシステム（DADS）準拠
//

import SwiftUI
import AuthenticationServices

struct ContentView: View {
    @StateObject private var auth = AuthManager.shared
    @State private var subscriptionValid: Bool?

    var body: some View {
        Group {
            if !auth.isAuthenticated {
                LoginView()
            } else if subscriptionValid == true {
                VaultView()
            } else if subscriptionValid == false {
                PaywallView {
                    subscriptionValid = true
                }
            } else {
                ProgressView("確認中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(DADSColor.backgroundGray.ignoresSafeArea())
            }
        }
        .task(id: auth.isAuthenticated) {
            guard auth.isAuthenticated else {
                subscriptionValid = nil
                return
            }
            // 復元完了通知のためのプッシュ許可（初回のみダイアログ表示）
            AppDelegate.requestPushAuthorization()

            do {
                let res = try await APIClient.shared.getSubscription()
                subscriptionValid = res.hasSubscription && (res.isValid ?? false)
            } catch {
                // 確認に失敗した場合は利用をブロックしない（サーバー側でも強制される）
                subscriptionValid = true
            }
        }
    }
}

// MARK: - Login

struct LoginView: View {
    @StateObject private var auth = AuthManager.shared
    @State private var isSigningIn = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: DADSSpacing.xl) {
            Spacer()

            Image(systemName: "archivebox.fill")
                .font(.system(size: 72))
                .foregroundColor(DADSColor.primary)

            VStack(spacing: DADSSpacing.xs) {
                Text("Glacier Photo Vault")
                    .font(DADSTypography.title1)
                    .foregroundColor(DADSColor.textPrimary)
                Text("超低コストの写真・ファイル長期保管")
                    .font(DADSTypography.caption)
                    .foregroundColor(DADSColor.textSecondary)
            }

            Spacer()

            VStack(spacing: DADSSpacing.md) {
                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.email, .fullName]
                } onCompletion: { result in
                    handleAppleSignIn(result)
                }
                .frame(height: 48)
                .cornerRadius(DADSRadius.medium)

                Button {
                    signIn(.google)
                } label: {
                    Label("Googleでログイン", systemImage: "globe")
                        .font(DADSTypography.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(DADSSpacing.md)
                        .background(DADSColor.primary)
                        .foregroundColor(.white)
                        .cornerRadius(DADSRadius.medium)
                }

                Button {
                    signIn(.line)
                } label: {
                    Label("LINEでログイン", systemImage: "message.fill")
                        .font(DADSTypography.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(DADSSpacing.md)
                        .background(Color(red: 0.0, green: 0.72, blue: 0.36))
                        .foregroundColor(.white)
                        .cornerRadius(DADSRadius.medium)
                }
            }
            .padding(.horizontal, DADSSpacing.xl)
            .disabled(isSigningIn)

            if let errorMessage {
                Text(errorMessage)
                    .font(DADSTypography.caption)
                    .foregroundColor(DADSColor.error)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, DADSSpacing.xl)
            }

            Spacer()
        }
        .background(DADSColor.backgroundGray.ignoresSafeArea())
    }

    private func signIn(_ provider: AuthProvider) {
        isSigningIn = true
        errorMessage = nil
        Task {
            do {
                try await auth.signIn(provider: provider)
            } catch {
                errorMessage = "ログインに失敗しました。もう一度お試しください。"
            }
            isSigningIn = false
        }
    }

    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        guard case .success(let authorization) = result,
              let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            if case .failure = result {
                errorMessage = "Appleでのログインに失敗しました。"
            }
            return
        }

        let fullName = [credential.fullName?.familyName, credential.fullName?.givenName]
            .compactMap { $0 }
            .joined(separator: " ")

        isSigningIn = true
        errorMessage = nil
        Task {
            do {
                try await auth.signInWithApple(
                    identityToken: identityToken,
                    fullName: fullName.isEmpty ? nil : fullName
                )
            } catch {
                errorMessage = "Appleでのログインに失敗しました。"
            }
            isSigningIn = false
        }
    }
}

// MARK: - Vault (main)

struct VaultView: View {
    @StateObject private var viewModel = PhotoViewModel()
    @State private var showingUploadSheet = false
    @State private var showingBackupSheet = false

    var body: some View {
        NavigationView {
            ZStack {
                DADSColor.backgroundGray
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: DADSSpacing.lg) {
                        // Stats Section
                        if let stats = viewModel.stats {
                            StatsView(stats: stats)
                                .padding(.horizontal, DADSSpacing.md)
                        }

                        // Photos List
                        if viewModel.isLoading && viewModel.photos.isEmpty {
                            ProgressView("読み込み中...")
                                .font(DADSTypography.body)
                                .foregroundColor(DADSColor.textSecondary)
                                .padding(DADSSpacing.xl)
                        } else if viewModel.photos.isEmpty {
                            EmptyStateView()
                                .padding(DADSSpacing.md)
                        } else {
                            LazyVStack(spacing: DADSSpacing.md) {
                                ForEach(viewModel.photos) { photo in
                                    PhotoCardView(photo: photo, viewModel: viewModel)
                                }
                            }
                            .padding(.horizontal, DADSSpacing.md)
                        }
                    }
                    .padding(.vertical, DADSSpacing.md)
                }
                .refreshable {
                    await viewModel.refresh()
                }

                // Error Message (Toast)
                if let errorMessage = viewModel.errorMessage {
                    VStack {
                        Spacer()
                        HStack {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundColor(.white)
                            Text(errorMessage)
                                .font(DADSTypography.caption)
                                .foregroundColor(.white)
                        }
                        .padding(DADSSpacing.md)
                        .background(DADSColor.error)
                        .cornerRadius(DADSRadius.medium)
                        .shadow(
                            color: DADSShadow.medium.color,
                            radius: DADSShadow.medium.radius,
                            x: DADSShadow.medium.x,
                            y: DADSShadow.medium.y
                        )
                        .padding(DADSSpacing.md)
                    }
                }
            }
            .navigationTitle("写真保管庫")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("ログアウト") {
                        AuthManager.shared.signOut()
                    }
                    .font(DADSTypography.caption)
                    .foregroundColor(DADSColor.textSecondary)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: DADSSpacing.sm) {
                        Button(action: { showingBackupSheet = true }) {
                            Image(systemName: "icloud.and.arrow.up")
                                .font(.title3)
                                .foregroundColor(DADSColor.primary)
                        }
                        .accessibilityLabel("ライブラリバックアップ")

                        Button(action: { showingUploadSheet = true }) {
                            Image(systemName: "plus.circle.fill")
                                .font(.title2)
                                .foregroundColor(DADSColor.primary)
                        }
                        .accessibilityLabel("写真をアップロード")
                    }
                }
            }
            .sheet(isPresented: $showingUploadSheet) {
                UploadPhotoView(viewModel: viewModel)
            }
            .sheet(isPresented: $showingBackupSheet) {
                BackupView()
            }
            .task {
                await viewModel.refresh()
            }
        }
        .accentColor(DADSColor.primary)
    }
}

struct StatsView: View {
    let stats: PhotoStats

    var body: some View {
        VStack(spacing: DADSSpacing.md) {
            Text("統計情報")
                .font(DADSTypography.title3)
                .foregroundColor(DADSColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: DADSSpacing.md),
                GridItem(.flexible(), spacing: DADSSpacing.md)
            ], spacing: DADSSpacing.md) {
                StatCard(title: "総写真数", value: "\(stats.totalPhotos)")
                StatCard(title: "総容量", value: stats.formattedTotalSize)
                StatCard(title: "アーカイブ済み", value: "\(stats.archived)")
                StatCard(title: "復元可能", value: "\(stats.restored)")
            }
        }
        .padding(DADSSpacing.md)
        .background(DADSColor.backgroundCard)
        .cornerRadius(DADSRadius.large)
        .shadow(
            color: DADSShadow.small.color,
            radius: DADSShadow.small.radius,
            x: DADSShadow.small.x,
            y: DADSShadow.small.y
        )
    }
}

struct StatCard: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: DADSSpacing.xxs) {
            Text(title)
                .font(DADSTypography.small)
                .foregroundColor(DADSColor.textSecondary)
            Text(value)
                .font(DADSTypography.title2)
                .fontWeight(.bold)
                .foregroundColor(DADSColor.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(DADSSpacing.md)
        .background(DADSColor.backgroundGray)
        .cornerRadius(DADSRadius.medium)
    }
}

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: DADSSpacing.lg) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.system(size: 64))
                .foregroundColor(DADSColor.textDisabled)

            VStack(spacing: DADSSpacing.xs) {
                Text("写真がまだありません")
                    .font(DADSTypography.title3)
                    .foregroundColor(DADSColor.textPrimary)

                Text("右上の + ボタンから写真をアップロードしてください")
                    .font(DADSTypography.caption)
                    .foregroundColor(DADSColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }
        }
        .padding(DADSSpacing.xxl)
        .frame(maxWidth: .infinity)
        .background(DADSColor.backgroundCard)
        .cornerRadius(DADSRadius.large)
        .shadow(
            color: DADSShadow.small.color,
            radius: DADSShadow.small.radius,
            x: DADSShadow.small.x,
            y: DADSShadow.small.y
        )
    }
}

#Preview {
    ContentView()
}
