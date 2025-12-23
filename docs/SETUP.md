# Glacier Photo Vault - セットアップガイド

## 📋 前提条件

- Node.js 18以上
- PostgreSQL 14以上
- AWS S3アカウント
- Stripeアカウント
- Google OAuth 2.0クライアント
- LINE Developersアカウント

## 🚀 初期セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/glacier-photo-vault.git
cd glacier-photo-vault
```

### 2. 依存関係のインストール

```bash
# ルートディレクトリで
npm install

# バックエンド
cd backend
npm install

# フロントエンド
cd ../frontend
npm install
```

### 3. 環境変数の設定

#### Backend (.env)

```bash
cd backend
cp .env.example .env
```

`.env`を編集して以下を設定：

```env
# AWS設定
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=glacier-photo-vault

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# LINE OAuth
LINE_CHANNEL_ID=your_line_channel_id
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CALLBACK_URL=http://localhost:3000/api/auth/line/callback

# Stripe
STRIPE_SECRET_KEY=sk_test_your_test_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/glacier_photo_vault

# JWT
JWT_SECRET=your_random_jwt_secret_here
SESSION_SECRET=your_random_session_secret_here

# App
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
```

#### Frontend (.env)

```bash
cd ../frontend
cp .env.example .env
```

`.env`を編集：

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
VITE_API_URL=http://localhost:3000
```

### 4. データベースのセットアップ

```bash
# PostgreSQLデータベースを作成
createdb glacier_photo_vault

# マイグレーションを実行
cd backend
npm run migrate  # または手動でSQLファイルを実行
```

手動実行の場合：

```bash
psql -d glacier_photo_vault -f src/db/migrations/001_initial_schema.sql
psql -d glacier_photo_vault -f src/db/migrations/002_add_photos_table.sql
psql -d glacier_photo_vault -f src/db/migrations/003_add_line_oauth.sql
psql -d glacier_photo_vault -f src/db/migrations/004_billing_tables.sql
```

### 5. 開発サーバーの起動

#### バックエンド

```bash
cd backend
npm run dev
```

サーバーが `http://localhost:3000` で起動します。

#### フロントエンド

```bash
cd frontend
npm run dev
```

アプリが `http://localhost:5173` で起動します。

## 🔧 Stripe Webhookのローカルテスト

Stripe CLIを使用してローカル環境でWebhookをテストできます：

```bash
# Stripe CLIのインストール
brew install stripe/stripe-cli/stripe  # macOS
# または https://stripe.com/docs/stripe-cli からダウンロード

# ログイン
stripe login

# Webhookをフォワード
stripe listen --forward-to localhost:3000/api/billing/webhook

# 別のターミナルでテストイベントを送信
stripe trigger invoice.payment_succeeded
```

Webhook署名シークレットが表示されるので、`.env`の`STRIPE_WEBHOOK_SECRET`に設定します。

## 📅 バッチ処理の実行

### 日次使用量記録

```bash
cd backend
npm run batch:daily
```

### 月次請求処理

```bash
cd backend
npm run batch:monthly
```

## 🌐 本番環境へのデプロイ

### 1. 環境変数の更新

本番環境用の`.env`を作成し、以下を変更：

```env
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
GOOGLE_CALLBACK_URL=https://your-api-domain.com/api/auth/google/callback
LINE_CALLBACK_URL=https://your-api-domain.com/api/auth/line/callback

# Stripeを本番用に
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 2. Stripe Webhookの設定

1. [Stripe Dashboard](https://dashboard.stripe.com/webhooks) にアクセス
2. 「エンドポイントを追加」をクリック
3. URL: `https://your-api-domain.com/api/billing/webhook`
4. イベント選択:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `payment_method.attached`
   - `payment_method.detached`
5. 署名シークレットをコピーして`STRIPE_WEBHOOK_SECRET`に設定

### 3. Cronジョブの設定

Render.comの場合、`render.yaml`に追加：

```yaml
services:
  - type: cron
    name: daily-usage-batch
    env: docker
    schedule: "0 15 * * *"  # 毎日 0:00 JST (15:00 UTC)
    dockerCommand: npm run batch:daily

  - type: cron
    name: monthly-billing-batch
    env: docker
    schedule: "0 17 1 * *"  # 毎月1日 2:00 JST (17:00 UTC)
    dockerCommand: npm run batch:monthly
```

### 4. ビルド & デプロイ

```bash
# バックエンドビルド
cd backend
npm run build

# フロントエンドビルド
cd ../frontend
npm run build
```

## 🧪 テスト

### バックエンドテスト

```bash
cd backend
npm test
```

### フロントエンドテスト

```bash
cd frontend
npm test
```

## 📊 モニタリング

### 使用量の確認

```sql
-- 全ユーザーの現在の使用量
SELECT * FROM current_storage_usage;

-- 今月の使用料サマリー
SELECT * FROM monthly_usage_summary;

-- 支払いステータス確認
SELECT id, email, payment_status, has_payment_method
FROM users
WHERE payment_status != 'good';
```

### ログの確認

```bash
# バックエンドログ
tail -f backend/logs/app.log

# バッチ処理ログ
tail -f backend/logs/batch.log
```

## 🔒 セキュリティチェックリスト

- [ ] 本番環境の`.env`ファイルはGitにコミットしない
- [ ] JWTシークレットは強力なランダム文字列を使用
- [ ] Stripeキーは本番用（`sk_live_`、`pk_live_`）を使用
- [ ] データベースのパスワードは複雑なものを使用
- [ ] HTTPSを有効化
- [ ] CORS設定を本番ドメインのみに制限
- [ ] レート制限を適切に設定

## 🆘 トラブルシューティング

### データベース接続エラー

```bash
# PostgreSQLが起動しているか確認
pg_isready

# 接続テスト
psql -d glacier_photo_vault
```

### Stripe支払いが失敗する

1. Stripe Dashboardでログを確認
2. Webhook署名が正しいか確認
3. テストモードか本番モードか確認

### 容量制限が機能しない

1. マイグレーションが実行されているか確認
2. `users`テーブルに`storage_limit_bytes`カラムがあるか確認
3. ミドルウェアが適用されているか確認

## 📚 参考リンク

- [Stripe API Documentation](https://stripe.com/docs/api)
- [AWS S3 Glacier Documentation](https://docs.aws.amazon.com/glacier/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [料金体系詳細](./BILLING.md)