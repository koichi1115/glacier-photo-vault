/**
 * Passport.js設定
 * Google OAuth 2.0とLINE OAuth 2.0の認証戦略を設定
 */

import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth20';
import { Strategy as LineStrategy, Profile as LineProfile } from 'passport-line-auth';

// 環境変数の型定義
interface OAuthConfig {
  google: {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  };
  line: {
    channelID: string;
    channelSecret: string;
    callbackURL: string;
  };
}

// 環境変数から設定を読み込み
const oauthConfig: OAuthConfig = {
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  },
  line: {
    channelID: process.env.LINE_CHANNEL_ID || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
    callbackURL: process.env.LINE_CALLBACK_URL || 'http://localhost:3000/api/auth/line/callback',
  },
};

// Google OAuth 2.0戦略（環境変数が設定されている場合のみ）
if (oauthConfig.google.clientID && oauthConfig.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: oauthConfig.google.clientID,
        clientSecret: oauthConfig.google.clientSecret,
        callbackURL: oauthConfig.google.callbackURL,
        scope: ['profile', 'email'],
      },
      async (accessToken: string, refreshToken: string, profile: GoogleProfile, done: any) => {
        try {
          // ユーザー情報を抽出
          const user = {
            userId: `google_${profile.id}`, // プロバイダープレフィックスを付与
            email: profile.emails?.[0]?.value || '',
            displayName: profile.displayName,
            provider: 'google' as const,
            providerId: profile.id,
            profilePhoto: profile.photos?.[0]?.value || '',
          };

          console.log(`✅ Google OAuth success: ${user.email}`);
          done(null, user);
        } catch (error) {
          console.error('Google OAuth error:', error);
          done(error, null);
        }
      }
    )
  );
  console.log('✅ Google OAuth strategy registered');
} else {
  console.warn('⚠️  Google OAuth credentials not configured - Google login disabled');
}

// LINE OAuth 2.0戦略（環境変数が設定されている場合のみ）
if (oauthConfig.line.channelID && oauthConfig.line.channelSecret) {
  passport.use(
    new LineStrategy(
      {
        channelID: oauthConfig.line.channelID,
        channelSecret: oauthConfig.line.channelSecret,
        callbackURL: oauthConfig.line.callbackURL,
        scope: ['profile', 'openid', 'email'],
      },
      async (accessToken: string, refreshToken: string, profile: LineProfile, done: any) => {
        try {
          // ユーザー情報を抽出
          const user = {
            userId: `line_${profile.id}`, // プロバイダープレフィックスを付与
            email: profile.emails?.[0]?.value || '',
            displayName: profile.displayName,
            provider: 'line' as const,
            providerId: profile.id,
            profilePhoto: profile.pictureUrl || '',
          };

          console.log(`✅ LINE OAuth success: ${user.displayName}`);
          done(null, user);
        } catch (error) {
          console.error('LINE OAuth error:', error);
          done(error, null);
        }
      }
    )
  );
  console.log('✅ LINE OAuth strategy registered');
} else {
  console.warn('⚠️  LINE OAuth credentials not configured - LINE login disabled');
}

// シリアライズ（セッション保存）- 今回はJWTを使うため未使用
passport.serializeUser((user: any, done) => {
  done(null, user);
});

// デシリアライズ（セッション復元）- 今回はJWTを使うため未使用
passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;
