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

    console.log('✅ Database initialized (PostgreSQL)');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
