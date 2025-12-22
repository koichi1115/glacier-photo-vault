# Glacier Photo Vault - 料金体系仕様書

## 概要

Glacier Photo Vaultは従量課金制を採用し、ユーザーが実際に使用したストレージ量に応じて課金します。

## 料金プラン

### ストレージ料金

| 項目 | 料金 |
|------|------|
| **ストレージ保管料** | 1GB/月あたり **10円** |
| **無料枠** | 100MBまで無料 |
| **最低請求額** | 1円未満は切り捨て |

### データ操作料金

| 項目 | 料金 |
|------|------|
| **アップロード** | 1,000リクエストあたり 1円 |
| **データ復元（標準：12時間）** | 1GBあたり 5円 |
| **データ復元（バルク：48時間）** | 1GBあたり 1円 |
| **ダウンロード** | 無料（転送量制限なし） |

## 課金方式

### 日次課金計算

ストレージ使用量は**日次**で計算され、月末に集計して請求します。

```
日次ストレージ料金 = (その日の平均ストレージ使用量GB × 10円/GB/月) / 30日
月次請求額 = Σ(日次ストレージ料金) + その他の操作料金
```

**計算例：**
```
1日目: 5GB保存 → 5GB × 10円 / 30 = 1.67円
2日目: 10GB保存 → 10GB × 10円 / 30 = 3.33円
...
30日目: 8GB保存 → 8GB × 10円 / 30 = 2.67円

月間合計 = 1.67 + 3.33 + ... + 2.67 = 約220円
```

## リスクヘッジ施策

### 1. 容量制限

| ユーザー状態 | 最大容量 | 制限内容 |
|------------|----------|---------|
| **未登録（無料枠のみ）** | 100MB | 超過時は支払い方法登録を要求 |
| **支払い方法未登録** | 1GB | 超過時はアップロードをブロック |
| **支払い方法登録済み** | 1TB | ソフトリミット（相談可能） |
| **未払い状態** | アップロード停止 | 既存データは90日間保持 |

### 2. レート制限

```typescript
// アップロード制限
1日あたり: 100ファイルまで
1時間あたり: 20ファイルまで
1分あたり: 5ファイルまで

// API呼び出し制限
1分あたり: 60リクエスト
```

### 3. 未払い対策フロー

```
Day 0: 支払い失敗
  ↓
Day 1: 自動リトライ（1回目）
  ↓
Day 3: 自動リトライ（2回目）
  ↓
Day 7: 最終リトライ（3回目） + メール警告
  ↓
Day 14: アップロード機能停止
  ↓
Day 30: 復元機能も停止（読み取り専用）
  ↓
Day 90: データ削除警告メール
  ↓
Day 120: データ完全削除
```

### 4. 異常検知

以下の場合はアラートを発火し、手動確認を行います：

- 1日で100GB以上のアップロード
- 1時間で10,000リクエスト以上
- 復元リクエストが1日10回以上
- 月額請求が10,000円を超える場合

## データベーススキーマ

### storage_usage_daily

```sql
CREATE TABLE storage_usage_daily (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  storage_bytes BIGINT NOT NULL,
  file_count INTEGER NOT NULL,
  calculated_cost DECIMAL(10, 2),
  created_at BIGINT NOT NULL,
  UNIQUE(user_id, date)
);
```

### payment_methods

```sql
CREATE TABLE payment_methods (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_payment_method_id VARCHAR(255),
  card_brand VARCHAR(50),
  card_last4 VARCHAR(4),
  is_default BOOLEAN DEFAULT true,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
```

### invoices

```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  stripe_invoice_id VARCHAR(255) UNIQUE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  storage_cost DECIMAL(10, 2) DEFAULT 0,
  restore_cost DECIMAL(10, 2) DEFAULT 0,
  api_cost DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  paid_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
```

### usage_logs

```sql
CREATE TABLE usage_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) NOT NULL, -- 'upload', 'restore', 'download'
  bytes_transferred BIGINT,
  file_count INTEGER,
  cost DECIMAL(10, 4),
  created_at BIGINT NOT NULL
);
```

## Stripe連携仕様

### 使用するStripe機能

1. **Customer**: ユーザーごとにStripe Customerを作成
2. **PaymentMethod**: クレジットカード情報を保存
3. **Invoice**: 月次請求書を作成
4. **InvoiceItem**: 各種使用料を請求項目として追加

### Webhookイベント

以下のイベントをハンドリングします：

- `invoice.payment_succeeded`: 支払い成功
- `invoice.payment_failed`: 支払い失敗
- `customer.subscription.deleted`: サブスクリプション削除
- `payment_method.attached`: 支払い方法追加
- `payment_method.detached`: 支払い方法削除

## API エンドポイント

### 支払い関連

```
POST   /api/billing/payment-method          支払い方法を登録
GET    /api/billing/payment-method          支払い方法を取得
DELETE /api/billing/payment-method          支払い方法を削除
GET    /api/billing/usage                   現在の使用量を取得
GET    /api/billing/invoices                請求履歴を取得
GET    /api/billing/estimate                今月の予想請求額を取得
```

## バッチ処理

### 日次バッチ（毎日 AM 0:00 JST）

1. 全ユーザーのストレージ使用量を集計
2. `storage_usage_daily`テーブルに記録
3. 日次コストを計算

### 月次バッチ（毎月1日 AM 2:00 JST）

1. 前月分の使用量を集計
2. Stripe Invoiceを作成
3. 自動請求を実行
4. 請求結果を`invoices`テーブルに記録

## セキュリティ

- Stripe APIキーは環境変数で管理（`STRIPE_SECRET_KEY`）
- Webhook署名検証を必須化（`STRIPE_WEBHOOK_SECRET`）
- 支払い情報はStripeに保存（自システムには保存しない）
- カードの下4桁とブランドのみをDBに記録

## コスト試算例

### ケース1: 個人ユーザー（写真保存）
- 保存容量: 50GB
- 月額料金: 50GB × 10円 = **500円/月**

### ケース2: ヘビーユーザー（動画も保存）
- 保存容量: 500GB
- 月額料金: 500GB × 10円 = **5,000円/月**
- 復元（月1回）: 500GB × 5円 = 2,500円
- **合計: 7,500円/月**

### ケース3: AWS Glacier との比較
- AWS Glacier: 500GB × 約$0.004/GB = $2/月 = 約300円/月
- 本サービス: 500GB × 10円 = 5,000円/月
- **差額理由**: 復元の容易さ、UI/UX、日本語サポート

## 今後の拡張性

### フェーズ2で検討

- プリペイド方式の追加
- 法人向けボリュームディスカウント
- 長期保存割引（1年前払いで20%オフなど）
- データ転送料金の追加（GB単位）
