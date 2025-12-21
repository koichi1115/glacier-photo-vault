/**
 * Header Component
 * デジタル庁デザインシステム（DADS）準拠のヘッダー
 */

import React from 'react';
import { GlacierLogo } from './Logo';

interface HeaderProps {
  userName?: string;
  displayName?: string;
  profilePhoto?: string;
}

export const Header: React.FC<HeaderProps> = ({ userName = 'demo-user', displayName, profilePhoto }) => {
  const displayedName = displayName || userName;
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-dads-border sticky top-0 z-50" style={{ boxShadow: 'var(--dads-shadow-sm)' }}>
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* ロゴ */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-dads-lg flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, rgba(59, 158, 245, 0.1) 0%, rgba(167, 139, 250, 0.1) 100%)',
              boxShadow: 'var(--dads-shadow-sm)'
            }}>
              <GlacierLogo size={48} variant="gradient" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-dads-text-primary tracking-tight" style={{
                fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                letterSpacing: '-0.02em'
              }}>
                Glacier Photo Vault
              </h1>
              <p className="text-sm font-semibold text-dads-text-secondary mt-0.5" style={{
                fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              }}>
                超低コスト写真保管サービス
              </p>
            </div>
          </div>

          {/* ナビゲーション */}
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="#"
              className="text-dads-sm text-dads-text-primary hover:text-dads-primary transition-colors font-medium"
            >
              ダッシュボード
            </a>
            <a
              href="#"
              className="text-dads-sm text-dads-text-secondary hover:text-dads-primary transition-colors"
            >
              使い方
            </a>
            <a
              href="#"
              className="text-dads-sm text-dads-text-secondary hover:text-dads-primary transition-colors"
            >
              料金
            </a>
          </nav>

          {/* ユーザーメニュー */}
          <div className="flex items-center gap-4">
            {/* 通知アイコン */}
            <button
              className="p-3 rounded-full hover:bg-dads-bg-secondary transition-all"
              style={{ boxShadow: 'var(--dads-shadow-sm)' }}
              aria-label="通知"
            >
              <svg
                className="w-5 h-5 text-dads-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>

            {/* ユーザーアバター */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-full hover:bg-dads-bg-secondary transition-all cursor-pointer" style={{ boxShadow: 'var(--dads-shadow-sm)' }}>
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt={displayedName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-dads-primary/20"
                />
              ) : (
                <div className="w-10 h-10 gradient-accent rounded-full flex items-center justify-center">
                  <span className="text-white text-dads-sm font-semibold">
                    {displayedName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="hidden lg:block">
                <p className="text-dads-sm font-medium text-dads-text-primary">
                  {displayedName}
                </p>
                <p className="text-dads-xs text-dads-text-secondary">
                  無料プラン
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
