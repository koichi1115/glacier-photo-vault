# 🚀 Supabase移行ガイド

Renderの無料DBからSupabaseへの移行手順

## ステップ1: Supabaseプロジェクト作成

### 1-1. アカウント作成

🔗 https://supabase.com

1. 「Start your project」をクリック
2. GitHubアカウントでサインアップ

### 1-2. 新規プロジェクト作成

1. 「New Project」をクリック
2. 以下を入力：
   - **Name**: `glacier-photo-vault`
   - **Database Password**: 強力なパスワードを生成（保存してください！）
   - **Region**: `Tokyo (ap-northeast-1)` を選択
   - **Pricing Plan**: **Free** を選択

3. 「Create new project」をクリック

→ 約2分でプロジェクトが作成されます

---

## ステップ2: データベース接続情報の取得

### 2-1. 接続文字列を取得

1. プロジェクトダッシュボードで **Settings** → **Database** をクリック
2. **Connection string** セクションで **URI** を選択
3. 以下のような文字列が表示されます：

```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

4. `[YOUR-PASSWORD]` を実際のパスワードに置き換えてコピー

---

## ステップ3: スキーマの移行

### 3-1. SQL Editorでテーブル作成

Supabaseダッシュボード → **SQL Editor** → **New query**

以下のSQLを実行：

```sql
-- Photos table
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  title TEXT,
  description TEXT,
  s3_key TEXT NOT NULL,
  status TEXT NOT NULL,
  uploaded_at BIGINT NOT NULL,
  thumbnail_url TEXT,
  restored_until BIGINT
);

-- Tags table
CREATE TABLE IF NOT EXISTS photo_tags (
  photo_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, tag)
);

-- Refresh Tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  provider TEXT,
  provider_id TEXT,
  created_at BIGINT NOT NULL
);

-- インデックスの作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

「Run」をクリックしてテーブルを作成

---

## ステップ4: Render環境変数の更新

### 4-1. Renderダッシュボードにアクセス

🔗 https://dashboard.render.com

1. バックエンドサービス（`glacier-photo-vault-backend`）を選択
2. **Environment** タブをクリック

### 4-2. DATABASE_URLを更新

既存の `DATABASE_URL` を削除して、新しい値を追加：

```bash
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

※ Supabaseから取得した接続文字列をペースト

### 4-3. 保存して再デプロイ

「Save Changes」をクリック → 自動的に再デプロイが開始されます

---

## ステップ5: 動作確認

### 5-1. デプロイ完了を待つ

Renderのログで以下が表示されることを確認：

```
✅ Database initialized (PostgreSQL)
🔒 Glacier Photo Vault Server running on port 3000
```

### 5-2. ヘルスチェック

```bash
curl https://glacier-photo-vault-backend.onrender.com/health
```

**期待するレスポンス**:
```json
{"status":"ok","timestamp":1234567890}
```

### 5-3. フロントエンドで動作確認

1. フロントエンド（Vercel）にアクセス
2. ログイン
3. 写真をアップロード
4. Supabaseの **Table Editor** でデータが保存されているか確認

---

## ステップ6: ローカル開発環境の更新

### 6-1. .envファイルを更新

`backend/.env` を編集：

```bash
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

### 6-2. ローカルで動作確認

```bash
npm run dev:backend
```

ログに以下が表示されればOK：
```
✅ Database initialized (PostgreSQL)
```

---

## 🎉 移行完了！

SupabaseのFreeプランの制限：
- データベース: 500MB
- ストレージ: 1GB
- 帯域幅: 5GB/月
- APIリクエスト: 無制限

本番運用には十分なスペックです。

---

## 📊 Supabaseの便利機能

### テーブルエディタ

**Table Editor** でGUIからデータを確認・編集可能

### SQL Editor

**SQL Editor** で複雑なクエリを実行可能

### リアルタイム監視

**Database** → **Logs** でクエリログをリアルタイム確認

---

## 🛡️ セキュリティ設定（推奨）

### Row Level Security (RLS) の有効化

現在はRLSを無効化していますが、将来的に有効化することを推奨：

```sql
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のphotoのみアクセス可能
CREATE POLICY photos_user_policy ON photos
  FOR ALL
  USING (user_id = current_setting('app.current_user_id'));
```

---

## トラブルシューティング

### ❌ 接続エラー

**エラー**: `could not connect to server`

**解決策**:
1. Supabaseの **Settings** → **Database** でIPアドレス制限を確認
2. 「Allow all IP addresses」を有効化（開発中のみ）

### ❌ SSL証明書エラー

**エラー**: `self signed certificate`

**解決策**:
`db/index.ts` で SSL設定を確認：
```typescript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
```

---

**作成日**: 2025年1月
**最終更新**: 2025年1月