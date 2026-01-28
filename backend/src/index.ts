// Load environment variables FIRST before any other imports
import './env';

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from './config/passport';
import { SessionManager } from './services/SessionManager';
import { setupSocketHandlers } from './socket/handlers';
import photoRoutes from './routes/photoRoutes';
import authRoutes from './routes/authRoutes';
import billingRoutes from './routes/billingRoutes';
import webhookRoutes from './routes/webhookRoutes';
import { initDb } from './db';

const app = express();

// Trust proxy - Required for Render.com deployment
app.set('trust proxy', 1);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// ============================================================
// TIER 2: セキュリティミドルウェア
// ============================================================

/**
 * Helmet.js - セキュリティヘッダーの設定
 * XSS、クリックジャッキング、MIMEタイプスニッフィング等から保護
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1年間
    includeSubDomains: true,
    preload: true,
  },
}));

/**
 * CORS設定の厳格化
 * 本番環境では特定のドメインのみ許可
 */
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL!]
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // originがundefinedの場合は同一オリジン（Postmanなど）
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

/**
 * レート制限
 * DoS攻撃を防ぐため、IP毎のリクエスト数を制限
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 15分間に最大100リクエスト
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 10, // 15分間に最大10リクエスト（認証エンドポイント用）
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1時間
  max: 1000, // 1時間に最大1000アップロード
  message: 'Upload limit exceeded, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 全エンドポイントに一般レート制限を適用
app.use(generalLimiter);

// ============================================================
// ミドルウェア
// ============================================================

app.use(express.json());

// Session configuration for OAuth (required for LINE OAuth state parameter)
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 1000 * 60 * 15, // 15 minutes
  }
}));

// Passport初期化
app.use(passport.initialize());
app.use(passport.session());

// ============================================================
// ルート
// ============================================================

// Health check endpoint（レート制限なし）
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 認証ルート（認証専用レート制限）
app.use('/api/auth', authLimiter, authRoutes);

// 写真ストレージルート（アップロード専用レート制限）
app.use('/api/photos', uploadLimiter, photoRoutes);

// 課金ルート
app.use('/api/billing', generalLimiter, billingRoutes);

// Stripeウェブフック（express.jsonより前に設定する必要があるため、webhookRoutes内でraw parserを使用）
app.use('/api/webhook', webhookRoutes);


// Initialize session manager
const sessionManager = new SessionManager();

// Setup WebSocket handlers
setupSocketHandlers(io, sessionManager);

// ============================================================
// サーバー起動
// ============================================================

const PORT = process.env.PORT || 3000;



// Initialize Database
initDb().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🔒 Glacier Photo Vault Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 CORS allowed origins: ${allowedOrigins.join(', ')}`);
    console.log(`✅ Security middleware enabled: Helmet, CORS, Rate Limiting`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
