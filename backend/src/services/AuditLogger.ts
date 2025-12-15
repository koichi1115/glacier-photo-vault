/**
 * 監査証跡ロギングサービス
 * 全ての重要な操作をログに記録
 */

import winston from 'winston';

// ログレベルの定義
export enum AuditLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SECURITY = 'security', // セキュリティ関連イベント
}

// 監査イベントの種類
export enum AuditEvent {
  // 認証イベント
  AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED = 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_TOKEN_REFRESH = 'AUTH_TOKEN_REFRESH',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',

  // 写真操作イベント
  PHOTO_UPLOAD = 'PHOTO_UPLOAD',
  PHOTO_DOWNLOAD = 'PHOTO_DOWNLOAD',
  PHOTO_DELETE = 'PHOTO_DELETE',
  PHOTO_RESTORE_REQUEST = 'PHOTO_RESTORE_REQUEST',
  PHOTO_RESTORE_COMPLETE = 'PHOTO_RESTORE_COMPLETE',
  PHOTO_METADATA_UPDATE = 'PHOTO_METADATA_UPDATE',
  PHOTO_VIEW = 'PHOTO_VIEW',

  // セキュリティイベント
  SECURITY_UNAUTHORIZED_ACCESS = 'SECURITY_UNAUTHORIZED_ACCESS',
  SECURITY_FORBIDDEN_ACCESS = 'SECURITY_FORBIDDEN_ACCESS',
  SECURITY_RATE_LIMIT_EXCEEDED = 'SECURITY_RATE_LIMIT_EXCEEDED',
  SECURITY_INVALID_INPUT = 'SECURITY_INVALID_INPUT',
}

// 監査ログエントリの型定義
export interface AuditLogEntry {
  timestamp: string;
  level: AuditLevel;
  event: AuditEvent;
  userId?: string;
  email?: string;
  resourceId?: string; // photoId など
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * 監査ロガークラス
 */
export class AuditLogger {
  private logger: winston.Logger;

  constructor() {
    // Winston ロガーの設定
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      defaultMeta: { service: 'glacier-photo-vault' },
      transports: [
        // ファイルに出力（本番環境）
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/audit.log',
          level: 'info',
        }),
        // セキュリティイベント専用ログ
        new winston.transports.File({
          filename: 'logs/security.log',
          level: 'warn',
        }),
      ],
    });

    // 開発環境ではコンソールにも出力
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        })
      );
    }

    // CloudWatch Logsへの送信（本番環境）
    // 注意: aws-winston-cloudwatch パッケージが必要
    // if (process.env.NODE_ENV === 'production' && process.env.AWS_CLOUDWATCH_ENABLED === 'true') {
    //   const CloudWatchTransport = require('winston-cloudwatch');
    //   this.logger.add(new CloudWatchTransport({
    //     logGroupName: '/aws/glacier-photo-vault',
    //     logStreamName: `audit-${new Date().toISOString().split('T')[0]}`,
    //     awsRegion: process.env.AWS_REGION || 'us-east-1',
    //   }));
    // }

    console.log('✅ AuditLogger initialized');
  }

  /**
   * 監査ログを記録
   */
  log(entry: AuditLogEntry): void {
    const logData = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // ログレベルに応じて記録
    switch (entry.level) {
      case AuditLevel.ERROR:
        this.logger.error(logData);
        break;
      case AuditLevel.WARN:
      case AuditLevel.SECURITY:
        this.logger.warn(logData);
        break;
      case AuditLevel.INFO:
      default:
        this.logger.info(logData);
        break;
    }
  }

  /**
   * 認証成功ログ
   */
  logAuthSuccess(userId: string, email: string, provider: string, ipAddress?: string, userAgent?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: AuditLevel.INFO,
      event: AuditEvent.AUTH_LOGIN_SUCCESS,
      userId,
      email,
      action: `User logged in via ${provider}`,
      details: { provider },
      ipAddress,
      userAgent,
      success: true,
    });
  }

  /**
   * 認証失敗ログ
   */
  logAuthFailure(email: string, reason: string, ipAddress?: string, userAgent?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: AuditLevel.SECURITY,
      event: AuditEvent.AUTH_LOGIN_FAILED,
      email,
      action: 'Login attempt failed',
      details: { reason },
      ipAddress,
      userAgent,
      success: false,
    });
  }

  /**
   * 写真アップロードログ
   */
  logPhotoUpload(userId: string, photoId: string, filename: string, size: number, success: boolean): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: success ? AuditLevel.INFO : AuditLevel.ERROR,
      event: AuditEvent.PHOTO_UPLOAD,
      userId,
      resourceId: photoId,
      action: 'Photo uploaded',
      details: { filename, size },
      success,
    });
  }

  /**
   * 写真削除ログ
   */
  logPhotoDelete(userId: string, photoId: string, success: boolean): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: success ? AuditLevel.INFO : AuditLevel.ERROR,
      event: AuditEvent.PHOTO_DELETE,
      userId,
      resourceId: photoId,
      action: 'Photo deleted',
      success,
    });
  }

  /**
   * 写真リストアリクエストログ
   */
  logPhotoRestoreRequest(userId: string, photoId: string, tier: string, success: boolean): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: success ? AuditLevel.INFO : AuditLevel.ERROR,
      event: AuditEvent.PHOTO_RESTORE_REQUEST,
      userId,
      resourceId: photoId,
      action: 'Photo restore requested',
      details: { tier },
      success,
    });
  }

  /**
   * 写真ダウンロードログ
   */
  logPhotoDownload(userId: string, photoId: string, success: boolean): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: success ? AuditLevel.INFO : AuditLevel.ERROR,
      event: AuditEvent.PHOTO_DOWNLOAD,
      userId,
      resourceId: photoId,
      action: 'Photo downloaded',
      success,
    });
  }

  /**
   * 不正アクセス試行ログ
   */
  logUnauthorizedAccess(userId: string | undefined, resourceId: string, ipAddress?: string, userAgent?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: AuditLevel.SECURITY,
      event: AuditEvent.SECURITY_UNAUTHORIZED_ACCESS,
      userId,
      resourceId,
      action: 'Unauthorized access attempt',
      ipAddress,
      userAgent,
      success: false,
    });
  }

  /**
   * 権限不足アクセス試行ログ
   */
  logForbiddenAccess(userId: string, resourceId: string, ipAddress?: string, userAgent?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: AuditLevel.SECURITY,
      event: AuditEvent.SECURITY_FORBIDDEN_ACCESS,
      userId,
      resourceId,
      action: 'Forbidden access attempt (insufficient permissions)',
      ipAddress,
      userAgent,
      success: false,
    });
  }

  /**
   * レート制限超過ログ
   */
  logRateLimitExceeded(ipAddress: string, endpoint: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: AuditLevel.SECURITY,
      event: AuditEvent.SECURITY_RATE_LIMIT_EXCEEDED,
      action: 'Rate limit exceeded',
      details: { endpoint },
      ipAddress,
      success: false,
    });
  }
}

// シングルトンインスタンス
export const auditLogger = new AuditLogger();
