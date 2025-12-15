# Glacier Photo Vault - デプロイガイド

## 📋 目次

1. [フロントエンド: Vercelへデプロイ](#1-フロントエンド-vercelへデプロイ)
2. [バックエンド: Railwayへデプロイ](#2-バックエンド-railwayへデプロイ)
3. [環境変数の設定](#3-環境変数の設定)
4. [カスタムドメインの設定](#4-カスタムドメインの設定)
5. [デプロイ後の確認](#5-デプロイ後の確認)

---

## 1. フロントエンド: Vercelへデプロイ

### 1-1. GitHubリポジトリを準備

```bash
# プロジェクトルートで実行
git init
git add .
git commit -m "Initial commit: Glacier Photo Vault"

# GitHubリポジトリを作成後
git remote add origin https://github.com/YOUR_USERNAME/glacier-photo-vault.git
git branch -M main
git push -u origin main
```

### 1-2. Vercelアカウント作成

1. https://vercel.com にアクセス
2. 「Sign Up」→「Continue with GitHub」
3. GitHubアカウントでサインイン

### 1-3. プロジェクトをインポート

1. Vercelダッシュボードで「Add New...」→「Project」
2. GitHubリポジトリ `glacier-photo-vault` を選択
3. **重要**: Root Directoryを `frontend` に設定
4. Framework Preset: `Vite` を選択
5. Build Command: `npm run build`
6. Output Directory: `dist`

### 1-4. 環境変数を設定

Environment Variablesセクションで以下を追加：

```
VITE_API_URL=https://YOUR_BACKEND_URL.railway.app
```

**注意**: バックエンドのURLは後で設定します

### 1-5. デプロイ

「Deploy」をクリック → 約1分でデプロイ完了

デプロイURL例: `https://glacier-photo-vault.vercel.app`

---

## 2. バックエンド: Railwayへデプロイ

### 2-1. Railwayアカウント作成

1. https://railway.app にアクセス
2. 「Start a New Project」
3. GitHubアカウントでサインイン

### 2-2. プロジェクトを作成

1. 「New Project」→「Deploy from GitHub repo」
2. `glacier-photo-vault` リポジトリを選択
3. Root Directory: `backend` を指定

### 2-3. 環境変数を設定

**Variables**タブで以下を追加：

```bash
# AWS設定
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIASUVH2...
AWS_SECRET_ACCESS_KEY=xxxxx...
S3_BUCKET_NAME=glacier-photo-vault

# Google OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=https://YOUR_BACKEND_URL.railway.app/api/auth/google/callback

# LINE OAuth
LINE_CHANNEL_ID=xxxxx
LINE_CHANNEL_SECRET=xxxxx
LINE_CALLBACK_URL=https://YOUR_BACKEND_URL.railway.app/api/auth/line/callback

# アプリケーション設定
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://glacier-photo-vault.vercel.app
```

### 2-4. ビルド設定

**Settings**タブで：
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

### 2-5. デプロイ

自動的にデプロイが開始されます。

デプロイURL例: `https://glacier-photo-vault-production.up.railway.app`

---

## 3. 環境変数の設定

### 3-1. フロントエンドの環境変数を更新

Vercelダッシュボードで：

1. プロジェクト → Settings → Environment Variables
2. `VITE_API_URL` を更新:
   ```
   https://YOUR_BACKEND_URL.railway.app
   ```
3. Redeploy

### 3-2. Google OAuthのリダイレクトURIを更新

Google Cloud Consoleで：

1. 承認済みのリダイレクトURIに追加:
   ```
   https://YOUR_BACKEND_URL.railway.app/api/auth/google/callback
   ```

### 3-3. LINE OAuthのコールバックURLを更新

LINE Developers Consoleで：

1. コールバックURLに追加:
   ```
   https://YOUR_BACKEND_URL.railway.app/api/auth/line/callback
   ```

---

## 4. カスタムドメインの設定

### 4-1. Vercel（フロントエンド）

1. プロジェクト → Settings → Domains
2. カスタムドメインを追加（例: `app.yourdomain.com`）
3. DNSレコードを設定:
   ```
   Type: CNAME
   Name: app
   Value: cname.vercel-dns.com
   ```

### 4-2. Railway（バックエンド）

1. プロジェクト → Settings → Domains
2. カスタムドメインを追加（例: `api.yourdomain.com`）
3. DNSレコードを設定:
   ```
   Type: CNAME
   Name: api
   Value: YOUR_PROJECT.up.railway.app
   ```

### 4-3. 環境変数を再更新

カスタムドメイン設定後、以下を更新：

**バックエンド（Railway）**:
```
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
LINE_CALLBACK_URL=https://api.yourdomain.com/api/auth/line/callback
FRONTEND_URL=https://app.yourdomain.com
```

**フロントエンド（Vercel）**:
```
VITE_API_URL=https://api.yourdomain.com
```

**OAuth設定も更新**を忘れずに！

---

## 5. デプロイ後の確認

### 5-1. ヘルスチェック

```bash
# バックエンドの動作確認
curl https://YOUR_BACKEND_URL.railway.app/health

# 期待するレスポンス
{"status":"ok","timestamp":1234567890}
```

### 5-2. フロントエンドの動作確認

ブラウザで `https://glacier-photo-vault.vercel.app` を開く

### 5-3. OAuth認証テスト

1. 「Googleでログイン」をクリック
2. Google認証画面が表示されるか確認
3. 認証後、アプリにリダイレクトされるか確認

### 5-4. S3アップロードテスト

1. 小さい画像ファイル（1MB以下）をアップロード
2. AWS S3コンソールで確認:
   ```bash
   aws s3 ls s3://glacier-photo-vault/google_1234567890/
   ```

---

## 6. 継続的デプロイ（CI/CD）

### 自動デプロイフロー

```
1. ローカルでコード変更
   ↓
2. git commit & git push
   ↓
3. GitHub（main ブランチ）
   ↓
4. Vercel & Railway が自動検知
   ↓
5. 自動ビルド & デプロイ
   ↓
6. 本番環境に反映（約1-2分）
```

### ブランチ戦略

- `main`: 本番環境（自動デプロイ）
- `develop`: 開発環境（プレビューデプロイ）
- `feature/*`: 機能開発ブランチ（プレビューデプロイ）

Vercel/Railwayは各ブランチに対してプレビューURLを自動生成します。

---

## 7. コスト最適化

### 無料枠を最大限活用

**Vercel（無料）**:
- 帯域幅: 100GB/月
- ビルド時間: 無制限
- カスタムドメイン: 無制限

**Railway（$5/月）**:
- 実行時間: $5分（約500時間）
- メモリ: 512MB
- CPU: 共有

### 想定月額コスト

| 項目 | コスト |
|------|--------|
| Vercel（フロントエンド） | $0 |
| Railway（バックエンド） | $5 |
| S3 Glacier（5TB） | $6.01 |
| **合計** | **$11.01/月** |

**年間**: $132（約¥19,800）

---

## 8. トラブルシューティング

### 問題1: CORS エラー

**原因**: バックエンドのCORS設定が不正

**解決策**: `backend/src/index.ts` で `FRONTEND_URL` を確認
```typescript
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL!]
  : ['http://localhost:5173'];
```

### 問題2: OAuth認証エラー

**原因**: リダイレクトURIが不一致

**解決策**:
1. Google Cloud Console / LINE Developers Consoleで設定確認
2. `.env`の`GOOGLE_CALLBACK_URL`と`LINE_CALLBACK_URL`を確認

### 問題3: S3アップロードエラー

**原因**: AWS認証情報が不正

**解決策**: Railwayの環境変数を確認
```bash
aws sts get-caller-identity  # ローカルで確認
```

### 問題4: ビルドエラー

**原因**: 依存関係の不足

**解決策**:
```bash
# ローカルでビルドテスト
npm run build

# package-lock.jsonをコミット
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

---

## 9. セキュリティチェックリスト

デプロイ前に以下を確認：

- [ ] `.env`ファイルをGitにコミットしていない
- [ ] `keys/`ディレクトリをGitにコミットしていない
- [ ] Google OAuthのリダイレクトURIが正しい
- [ ] LINE OAuthのコールバックURLが正しい
- [ ] S3バケットのパブリックアクセスがブロックされている
- [ ] S3暗号化が有効
- [ ] HTTPS（SSL）が有効
- [ ] CORS設定が厳格（本番ドメインのみ）
- [ ] レート制限が有効

---

## 10. 監視・アラート設定

### Railway（バックエンド）

**Built-inメトリクス**:
- CPU使用率
- メモリ使用率
- ネットワーク帯域

**ログ監視**:
```bash
# Railwayダッシュボードでリアルタイムログを確認
Deployments → Logs
```

### Vercel（フロントエンド）

**Analytics**（無料）:
- ページビュー
- リアルユーザーメトリクス（Core Web Vitals）
- デバイス/ブラウザ統計

### AWS CloudWatch

**S3メトリクス**:
- ストレージ使用量
- リクエスト数
- エラー率

**アラーム設定**（推奨）:
- 不正アクセス試行 > 5回/5分 → メール通知
- ストレージ使用量 > 6TB → メール通知

---

## 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app/)
- [AWS S3 Glacier Deep Archive](https://aws.amazon.com/s3/storage-classes/glacier/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [LINE Login](https://developers.line.biz/en/docs/line-login/)

---

**最終更新**: 2025年1月
**作成者**: Claude Code（AI Assistant）
