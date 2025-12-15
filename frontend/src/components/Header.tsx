/**
 * Header Component
 * デジタル庁デザインシステム（DADS）準拠のヘッダー
 */

import React from 'react';

interface HeaderProps {
  userName?: string;
}

export const Header: React.FC<HeaderProps> = ({ userName = 'demo-user' }) => {
  return (
    <header className="bg-dads-bg-base border-b border-dads-border shadow-dads-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* ロゴ */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-dads-md flex items-center justify-center relative overflow-hidden" style={{
              background: 'linear-gradient(135deg, #0969da 0%, #1f6feb 100%)',
              boxShadow: '0 4px 12px rgba(9, 105, 218, 0.3)'
            }}>
              {/* より詳細な金庫アイコン */}
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 金庫本体（影付き） */}
                <rect x="5" y="10" width="22" height="18" rx="1.5" strokeWidth={2.5} fill="url(#vaultGradient)" />

                {/* グラデーション定義 */}
                <defs>
                  <linearGradient id="vaultGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 0.2 }} />
                    <stop offset="100%" style={{ stopColor: '#000000', stopOpacity: 0.1 }} />
                  </linearGradient>
                </defs>

                {/* 金庫のヒンジ */}
                <rect x="5" y="12" width="1.5" height="3" fill="currentColor" opacity="0.6" />
                <rect x="5" y="23" width="1.5" height="3" fill="currentColor" opacity="0.6" />

                {/* 円形ダイヤル外側 */}
                <circle cx="16" cy="19" r="4.5" strokeWidth={2.5} opacity="0.9" />

                {/* 円形ダイヤル内側 */}
                <circle cx="16" cy="19" r="3" strokeWidth={1.5} opacity="0.7" />

                {/* ダイヤル目盛り */}
                <line x1="16" y1="14.5" x2="16" y2="15.5" strokeWidth={1.5} strokeLinecap="round" />
                <line x1="16" y1="22.5" x2="16" y2="23.5" strokeWidth={1.5} strokeLinecap="round" />
                <line x1="11.5" y1="19" x2="12.5" y2="19" strokeWidth={1.5} strokeLinecap="round" />
                <line x1="19.5" y1="19" x2="20.5" y2="19" strokeWidth={1.5} strokeLinecap="round" />

                {/* 中央のハンドル */}
                <circle cx="16" cy="19" r="1" fill="currentColor" />
                <line x1="16" y1="20" x2="16" y2="22" strokeWidth={2} strokeLinecap="round" />

                {/* ロックバー */}
                <rect x="24" y="17.5" width="2" height="3" rx="0.5" fill="currentColor" opacity="0.8" />

                {/* 上部の鍵（南京錠風） */}
                <path
                  d="M13 10 L13 7 C13 5.34315 14.3431 4 16 4 C17.6569 4 19 5.34315 19 7 L19 10"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  opacity="0.9"
                />
              </svg>
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
              className="p-2 rounded-dads-md hover:bg-dads-bg-secondary transition-colors"
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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-dads-primary rounded-full flex items-center justify-center">
                <span className="text-white text-dads-sm font-semibold">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden lg:block">
                <p className="text-dads-sm font-medium text-dads-text-primary">
                  {userName}
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
