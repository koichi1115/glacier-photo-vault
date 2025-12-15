# Glacier Photo Vault - Renderデプロイガイド

## 📋 デプロイ手順

### 1. Renderアカウント作成

1. https://render.com にアクセス
2. 「Get Started」→ 「GitHub」でサインアップ
3. GitHubアカウントと連携

---

### 2. GitHubリポジトリの準備

```bash
# プロジェクトルートで実行
cd C:/Users/Administrator/photo-vault

# Git初期化（未実施の場合）
git init
git add .
git commit -m "Initial commit: Glacier Photo Vault with Render config"

# GitHubリポジトリを作成後
git remote add origin https://github.com/YOUR_USERNAME/glacier-photo-vault.git
git branch -M main
git push -u origin main
```

---

### 3. Renderでバックエンドをデプロイ

#### 3-1. 新規Web Serviceを作成

1. Renderダッシュボード: https://dashboard.render.com
2. 「New +」→ 「Web Service」
3. GitHubリポジトリ `glacier-photo-vault` を選択
4. 「Connect」をクリック

#### 3-2. 設定を入力

| 項目 | 値 |
|------|-----|
| **Name** | `glacier-photo-vault-backend` |
| **Region** | `Oregon (US West)` または `Ohio (US East)` |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` （開発・テスト用）<br>または `Starter ($7/月)` （本番用） |

#### 3-3. 環境変数を設定

「Environment」タブで以下を追加：

```bash
# Node.js設定
NODE_ENV=production
PORT=3000

# AWS設定
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIASUVH2...（あなたのアクセスキー）
AWS_SECRET_ACCESS_KEY=xxxxx...（あなたのシークレットキー）
S3_BUCKET_NAME=glacier-photo-vault

# Google OAuth（後で設定）
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=https://YOUR_APP.onrender.com/api/auth/google/callback

# LINE OAuth（後で設定）
LINE_CHANNEL_ID=xxxxx
LINE_CHANNEL_SECRET=xxxxx
LINE_CALLBACK_URL=https://YOUR_APP.onrender.com/api/auth/line/callback

# フロントエンドURL（後で設定）
FRONTEND_URL=https://YOUR_FRONTEND.vercel.app
```

**重要**:
- `YOUR_APP` は実際のRender URLに置き換え（デプロイ後に判明）
- `YOUR_FRONTEND` はVercelのURLに置き換え

#### 3-4. デプロイ開始

「Create Web Service」をクリック → 自動的にビルド・デプロイが開始されます

デプロイ完了後のURL例:
```
https://glacier-photo-vault-backend.onrender.com
```

---

### 4. Vercelでフロントエンドをデプロイ

#### 4-1. Vercelアカウント作成

1. https://vercel.com にアクセス
2. 「Sign Up」→ 「Continue with GitHub」

#### 4-2. プロジェクトをインポート

1. 「Add New...」→ 「Project」
2. GitHubリポジトリ `glacier-photo-vault` を選択
3. 設定を入力：

| 項目 | 値 |
|------|-----|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

#### 4-3. 環境変数を設定

```bash
VITE_API_URL=https://glacier-photo-vault-backend.onrender.com
```

#### 4-4. デプロイ

「Deploy」をクリック → 約1分で完了

デプロイ完了後のURL例:
```
https://glacier-photo-vault.vercel.app
```

---

### 5. 環境変数の更新

#### 5-1. バックエンド（Render）の環境変数を更新

Renderダッシュボードで以下を更新：

```bash
# 正しいURLに置き換え
GOOGLE_CALLBACK_URL=https://glacier-photo-vault-backend.onrender.com/api/auth/google/callback
LINE_CALLBACK_URL=https://glacier-photo-vault-backend.onrender.com/api/auth/line/callback
FRONTEND_URL=https://glacier-photo-vault.vercel.app
```

保存後、自動的に再デプロイされます。

#### 5-2. Google OAuth設定

1. Google Cloud Console: https://console.cloud.google.com/apis/credentials
2. OAuth 2.0クライアントIDを選択
3. 「承認済みのリダイレクトURI」に追加:
   ```
   https://glacier-photo-vault-backend.onrender.com/api/auth/google/callback
   ```

#### 5-3. LINE OAuth設定

1. LINE Developers Console: https://developers.line.biz/console/
2. チャネルを選択
3. 「LINE Login設定」→「コールバックURL」に追加:
   ```
   https://glacier-photo-vault-backend.onrender.com/api/auth/line/callback
   ```

---

### 6. 動作確認

#### 6-1. バックエンドのヘルスチェック

```bash
curl https://glacier-photo-vault-backend.onrender.com/health
```

期待するレスポンス:
```json
{"status":"ok","timestamp":1234567890}
```

#### 6-2. フロントエンドにアクセス

ブラウザで以下を開く:
```
https://glacier-photo-vault.vercel.app
```

#### 6-3. OAuth認証テスト

1. 「Googleでログイン」をクリック
2. Google認証画面が表示される
3. 認証後、アプリにリダイレクトされる

---

## 💰 料金プラン

### 開発・テスト環境（無料）

| サービス | プラン | 月額 |
|---------|--------|------|
| Render（バックエンド） | Free | **$0** |
| Vercel（フロントエンド） | Hobby | **$0** |
| S3 Glacier | 従量課金 | $6〜 |
| **合計** | | **$6〜/月** |

**無料枠の制限**:
- Render Free: 15分アクセスなしでスリープ
- Render Free: 月間750時間まで無料
- Vercel Hobby: 帯域幅100GB/月

### 本番環境

| サービス | プラン | 月額 |
|---------|--------|------|
| Render（バックエンド） | Starter | **$7** |
| Vercel（フロントエンド） | Hobby | **$0** |
| S3 Glacier（5TB） | 従量課金 | **$6.01** |
| **合計** | | **$13.01/月** |

**年間**: $156（約¥23,400）

---

## 🔧 render.yaml による自動デプロイ

リポジトリに `render.yaml` があるため、Renderは自動的に設定を読み込みます。

**render.yamlの利点**:
- ✅ インフラ設定をコード管理（IaC）
- ✅ 環境の再現性が高い
- ✅ チーム開発で設定を共有可能

**手動設定が必要な項目**:
- AWS認証情報（セキュリティ上、YAMLに含めない）
- OAuth認証情報
- 本番環境のURL

---

## 🚨 Render Free枠の注意点

### スリープ問題

**問題**: 15分アクセスなしで自動スリープ
**影響**: 次回アクセス時に30秒〜1分のコールドスタート

**解決策1**: Starter プラン（$7/月）にアップグレード
**解決策2**: 定期的にpingする（Cron Job）

```bash
# UptimeRobot などの外部サービスで5分毎にアクセス
https://uptimerobot.com
```

**解決策3**: 開発中は無料、本番はStarter

---

## 🔄 継続的デプロイ（CI/CD）

### 自動デプロイフロー

```
1. ローカルでコード変更
   ↓
2. git push origin main
   ↓
3. GitHub（main ブランチ）
   ↓
4. Render が自動検知
   ↓
5. npm install && npm run build
   ↓
6. npm start
   ↓
7. 本番環境に反映（約2-3分）
```

### ブランチ戦略

- `main`: 本番環境（自動デプロイ）
- `develop`: Renderで別環境を作成（プレビュー）

**設定方法**:
1. Render で新規 Web Service を作成
2. Branch を `develop` に設定
3. 開発環境として使用

---

## 📊 ログとモニタリング

### Renderのログ確認

1. Renderダッシュボード → サービスを選択
2. 「Logs」タブをクリック
3. リアルタイムログが表示される

**フィルタリング**:
```
# エラーログのみ表示
console.error

# 特定のイベントを検索
AUTH_LOGIN_SUCCESS
```

### メトリクス監視

Renderダッシュボードで以下を確認可能:
- CPU使用率
- メモリ使用率
- ネットワーク帯域
- リクエスト数

---

## 🔒 セキュリティ設定

### 環境変数の管理

**ベストプラクティス**:
1. ❌ `.env`ファイルをGitにコミットしない
2. ✅ Renderダッシュボードで環境変数を設定
3. ✅ 本番とローカルで異なる値を使用

### シークレットのローテーション

**推奨頻度**:
- AWS アクセスキー: 90日毎
- OAuth シークレット: 180日毎
- JWT 秘密鍵: 年1回

---

## 🎯 トラブルシューティング

### 問題1: ビルドエラー

**原因**: 依存関係の不足

**解決策**:
```bash
# ローカルでビルドテスト
cd backend
npm install
npm run build

# package-lock.json をコミット
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

### 問題2: 環境変数が反映されない

**原因**: Render の環境変数設定ミス

**解決策**:
1. Renderダッシュボード → Environment
2. 環境変数を確認・修正
3. Manual Deploy をクリックして再デプロイ

### 問題3: スリープからの復帰が遅い

**原因**: Free プランの仕様

**解決策**:
- Starter プラン（$7/月）にアップグレード
- または UptimeRobot で5分毎にpingを送る

### 問題4: OAuth認証エラー

**原因**: コールバックURLの不一致

**解決策**:
1. Google Cloud Console / LINE Developers Console でURLを確認
2. Renderの環境変数 `GOOGLE_CALLBACK_URL` / `LINE_CALLBACK_URL` を確認
3. 完全一致することを確認（末尾のスラッシュに注意）

---

## 📚 参考リンク

- [Render Documentation](https://render.com/docs)
- [Render Free Plan](https://render.com/docs/free)
- [Vercel Documentation](https://vercel.com/docs)
- [AWS S3 Glacier Pricing](https://aws.amazon.com/s3/pricing/)

---

**最終更新**: 2025年1月
**推奨プラン**: 開発は無料、本番はStarter（$7/月）
