# 🚀 Glacier Photo Vault - クイックスタート

**5分で本番環境を構築**

## 📋 デプロイチェックリスト

### ✅ 準備完了
- [x] GitHubにプッシュ完了
- [x] AWS S3バケット作成完了
- [x] S3暗号化・セキュリティ設定完了
- [x] ローカル環境でビルド成功

### ⬜ これから実施
- [ ] Renderでバックエンドをデプロイ
- [ ] Vercelでフロントエンドをデプロイ
- [ ] Google OAuth設定
- [ ] LINE OAuth設定（オプション）
- [ ] 動作確認

---

## 🎯 ステップ1: Renderでバックエンドをデプロイ

### 1-1. Renderアカウント作成

🔗 https://dashboard.render.com

「Sign Up」→ 「Continue with GitHub」

### 1-2. 新規Web Serviceを作成

1. **New +** → **Web Service**
2. リポジトリ選択: `koichi1115/glacier-photo-vault`
3. **Connect**をクリック

### 1-3. 基本設定

| 項目 | 値 |
|------|-----|
| **Name** | `glacier-photo-vault-backend` |
| **Region** | `Ohio (US East)` |
| **Branch** | `main` |
| **Root Directory** | （空欄 - リポジトリルートを使用） |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build --workspace=backend` |
| **Start Command** | `npm run start --workspace=backend` |
| **Instance Type** | **Free** または **Starter ($7/月)** |

### 1-4. 環境変数を設定

**Environment** タブで以下を追加：

```bash
NODE_ENV=production
PORT=3000

# AWS認証情報（あなたの値に置き換え）
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIASUVH2KVZGXLNJA3F
AWS_SECRET_ACCESS_KEY=（あなたのシークレットキー）
S3_BUCKET_NAME=glacier-photo-vault
```

**⚠️ Google/LINE OAuth設定は後で追加します（まず動作確認）**

### 1-5. デプロイ開始

「**Create Web Service**」をクリック

→ 約2-3分でデプロイ完了

デプロイ完了後のURL:
```
https://glacier-photo-vault-backend.onrender.com
```

このURLをメモしてください！

---

## 🎯 ステップ2: Vercelでフロントエンドをデプロイ

### 2-1. Vercelアカウント作成

🔗 https://vercel.com

「Sign Up」→ 「Continue with GitHub」

### 2-2. 新規プロジェクトを作成

1. **Add New Project**
2. リポジトリ選択: `koichi1115/glacier-photo-vault`
3. **Import**をクリック

### 2-3. 基本設定

| 項目 | 値 |
|------|-----|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` （自動検出） |
| **Output Directory** | `dist` （自動検出） |

### 2-4. 環境変数を設定

**Environment Variables** で追加：

```bash
VITE_API_URL=https://glacier-photo-vault-backend.onrender.com
```

※ RenderのURLに置き換えてください

### 2-5. デプロイ開始

「**Deploy**」をクリック

→ 約1分でデプロイ完了

デプロイ完了後のURL:
```
https://glacier-photo-vault-xxxx.vercel.app
```

---

## 🎯 ステップ3: 動作確認

### 3-1. バックエンドのヘルスチェック

ブラウザまたはcurlで確認：

```bash
curl https://glacier-photo-vault-backend.onrender.com/health
```

**期待するレスポンス**:
```json
{"status":"ok","timestamp":1234567890}
```

### 3-2. フロントエンドにアクセス

ブラウザで以下を開く：
```
https://glacier-photo-vault-xxxx.vercel.app
```

**期待する表示**:
- Glacier Photo Vaultのロゴ
- 「ログインが必要です」または認証ボタン

---

## 🎯 ステップ4: OAuth設定（オプション）

### Google OAuth 2.0設定

#### 4-1. Google Cloud Console

🔗 https://console.cloud.google.com/apis/credentials

1. **認証情報を作成** → **OAuth クライアント ID**
2. アプリケーションの種類: **ウェブ アプリケーション**
3. **承認済みのリダイレクト URI** に追加:
   ```
   https://glacier-photo-vault-backend.onrender.com/api/auth/google/callback
   ```
4. **作成** → **クライアント ID** と **クライアント シークレット** をコピー

#### 4-2. Renderの環境変数に追加

Renderダッシュボード → Environment

```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=https://glacier-photo-vault-backend.onrender.com/api/auth/google/callback

# フロントエンドURL
FRONTEND_URL=https://glacier-photo-vault-xxxx.vercel.app
```

保存 → 自動的に再デプロイされます

---

## 🎯 ステップ5: 最終確認

### 5-1. OAuth認証テスト

1. フロントエンドにアクセス
2. 「Googleでログイン」をクリック
3. Google認証画面が表示される
4. 認証後、アプリにリダイレクトされる

### 5-2. 写真アップロードテスト

1. 小さい画像ファイル（1MB以下）を選択
2. 「アップロード」をクリック
3. S3バケットに保存されたことを確認:
   ```bash
   aws s3 ls s3://glacier-photo-vault/
   ```

---

## 💰 コスト見積もり

| 項目 | プラン | 月額コスト |
|------|--------|-----------|
| Render（バックエンド） | Free または Starter | $0 または $7 |
| Vercel（フロントエンド） | Hobby | $0 |
| S3 Glacier（5TB） | 従量課金 | $6.01 |
| **合計** | | **$6〜$13** |

**Free枠の制限**:
- Render Free: 15分アクセスなしでスリープ
- 本番運用には **Starter ($7/月)** を推奨

---

## 🔧 トラブルシューティング

### ❌ ビルドエラー

**原因**: 依存関係の不足

**解決策**:
```bash
cd backend
npm install
npm run build

# 成功したら
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

### ❌ 環境変数エラー

**原因**: Renderの環境変数が未設定

**解決策**:
1. Renderダッシュボード → Environment
2. 必須環境変数を確認（上記参照）
3. 保存 → Manual Deploy

### ❌ CORS エラー

**原因**: フロントエンドURLが不一致

**解決策**:
1. Renderの環境変数 `FRONTEND_URL` を確認
2. VercelのURLと完全一致させる
3. 再デプロイ

### ❌ S3アクセスエラー

**原因**: AWS認証情報が不正

**解決策**:
```bash
# ローカルで確認
aws sts get-caller-identity

# 正しいアクセスキーかチェック
```

---

## 📚 詳細ドキュメント

| ドキュメント | 説明 |
|------------|------|
| [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) | Render詳細手順 |
| [AWS_S3_SECURITY_SETUP.md](./docs/AWS_S3_SECURITY_SETUP.md) | S3セキュリティ設定 |
| [COST_CALCULATION.md](./docs/COST_CALCULATION.md) | ランニングコスト詳細 |

---

## ✅ デプロイ完了！

おめでとうございます！本番環境が完成しました 🎉

**次にやること**:
1. カスタムドメインを設定（オプション）
2. LINE OAuth設定（オプション）
3. 監視・アラート設定
4. 定期的なコスト確認

---

**作成日**: 2025年1月
**最終更新**: 2025年1月
