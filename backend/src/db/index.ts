import { Pool } from 'pg';

// Use DATABASE_URL environment variable (standard for Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const initDb = async () => {
  const client = await pool.connect();
  try {
    // Photos table
    await client.query(`
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
      )
    `);

    // Tags table
    await client.query(`
      CREATE TABLE IF NOT EXISTS photo_tags (
        photo_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
        PRIMARY KEY (photo_id, tag)
      )
    `);

    // Refresh Tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at BIGINT NOT NULL
      )
    `);

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        provider TEXT,
        provider_id TEXT,
        created_at BIGINT NOT NULL
      )
    `);

    // Add payment-related columns to users table
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS first_payment_failed_at BIGINT
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS scheduled_deletion_at BIGINT
    `);

    // Subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        status TEXT DEFAULT 'trialing',
        trial_start BIGINT,
        trial_end BIGINT,
        current_period_start BIGINT,
        current_period_end BIGINT,
        canceled_at BIGINT,
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
        updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )
    `);

    // Coupons table
    await client.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        code TEXT UNIQUE NOT NULL,
        stripe_coupon_id TEXT,
        discount_percent INTEGER,
        discount_amount INTEGER,
        valid_until BIGINT,
        max_uses INTEGER,
        current_uses INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )
    `);

    console.log('✅ Database initialized (PostgreSQL)');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
