-- ============================================================
-- Billing System Tables
-- ストレージ使用量追跡と支払い管理のためのテーブル
-- ============================================================

-- 日次ストレージ使用量記録
CREATE TABLE IF NOT EXISTS storage_usage_daily (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  calculated_cost DECIMAL(10, 2),
  created_at BIGINT NOT NULL,
  UNIQUE(user_id, date)
);

CREATE INDEX idx_storage_usage_user_date ON storage_usage_daily(user_id, date DESC);

-- 支払い方法情報
CREATE TABLE IF NOT EXISTS payment_methods (
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

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_stripe_customer ON payment_methods(stripe_customer_id);

-- 請求書
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  stripe_invoice_id VARCHAR(255) UNIQUE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  storage_cost DECIMAL(10, 2) DEFAULT 0,
  restore_cost DECIMAL(10, 2) DEFAULT 0,
  api_cost DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, void
  paid_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_invoices_user ON invoices(user_id, created_at DESC);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_period ON invoices(billing_period_start, billing_period_end);

-- 使用ログ（アップロード、復元、ダウンロードの記録）
CREATE TABLE IF NOT EXISTS usage_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) NOT NULL, -- 'upload', 'restore', 'download'
  bytes_transferred BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  cost DECIMAL(10, 4) DEFAULT 0,
  metadata JSONB, -- 追加情報（ファイル名、復元タイプなど）
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_usage_logs_user ON usage_logs(user_id, created_at DESC);
CREATE INDEX idx_usage_logs_action ON usage_logs(action_type, created_at);

-- ユーザーテーブルに課金関連カラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT DEFAULT 104857600; -- 100MB
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_payment_method BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'good'; -- good, past_due, suspended
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_failed_at BIGINT;

CREATE INDEX idx_users_payment_status ON users(payment_status);

-- ビュー：ユーザーごとの現在のストレージ使用量
CREATE OR REPLACE VIEW current_storage_usage AS
SELECT
  user_id,
  MAX(date) as last_recorded_date,
  (SELECT storage_bytes FROM storage_usage_daily sud
   WHERE sud.user_id = storage_usage_daily.user_id
   ORDER BY date DESC LIMIT 1) as current_storage_bytes,
  (SELECT file_count FROM storage_usage_daily sud
   WHERE sud.user_id = storage_usage_daily.user_id
   ORDER BY date DESC LIMIT 1) as current_file_count
FROM storage_usage_daily
GROUP BY user_id;

-- ビュー：ユーザーごとの月次使用料（当月）
CREATE OR REPLACE VIEW monthly_usage_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', date) as billing_month,
  SUM(calculated_cost) as total_storage_cost,
  AVG(storage_bytes) as avg_storage_bytes,
  MAX(storage_bytes) as max_storage_bytes
FROM storage_usage_daily
WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY user_id, DATE_TRUNC('month', date);
