/**
 * Glacier Photo Vault Logo Component
 * セキュアクラウドボルト - 金庫とクラウドを組み合わせたデザイン
 */

import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  variant?: 'gradient' | 'solid' | 'white';
}

export const GlacierLogo: React.FC<LogoProps> = ({
  size = 48,
  className = '',
  variant = 'gradient'
}) => {
  const gradientId = `vault-gradient-${Math.random().toString(36).substr(2, 9)}`;
  const cloudGradientId = `cloud-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {variant === 'gradient' && (
          <>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E3A8A" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#60A5FA" />
            </linearGradient>
            <linearGradient id={cloudGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B9EF5" />
              <stop offset="100%" stopColor="#A78BFA" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </>
        )}
      </defs>

      {/* クラウドの背景 */}
      <g opacity="0.2">
        <ellipse cx="32" cy="18" rx="20" ry="12" fill={variant === 'gradient' ? `url(#${cloudGradientId})` : variant === 'white' ? 'white' : '#3B9EF5'} />
        <ellipse cx="24" cy="16" rx="10" ry="8" fill={variant === 'gradient' ? `url(#${cloudGradientId})` : variant === 'white' ? 'white' : '#3B9EF5'} />
        <ellipse cx="40" cy="16" rx="10" ry="8" fill={variant === 'gradient' ? `url(#${cloudGradientId})` : variant === 'white' ? 'white' : '#3B9EF5'} />
      </g>

      {/* 金庫本体 */}
      <g transform="translate(16, 24)">
        {/* 金庫の外枠 */}
        <rect
          x="0"
          y="0"
          width="32"
          height="32"
          rx="4"
          fill={variant === 'gradient' ? `url(#${gradientId})` : variant === 'white' ? 'white' : '#1E3A8A'}
          filter={variant === 'gradient' ? 'url(#glow)' : undefined}
        />

        {/* 金庫のドア（内側） */}
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="3"
          fill={variant === 'white' ? 'rgba(255,255,255,0.2)' : '#2563EB'}
        />

        {/* ハンドル部分 */}
        <g transform="translate(16, 16)">
          {/* ハンドルの円盤 */}
          <circle
            cx="0"
            cy="0"
            r="8"
            fill={variant === 'white' ? 'rgba(255,255,255,0.4)' : '#60A5FA'}
            stroke={variant === 'white' ? 'white' : '#DBEAFE'}
            strokeWidth="1.5"
          />

          {/* 内側の円 */}
          <circle
            cx="0"
            cy="0"
            r="5"
            fill="none"
            stroke={variant === 'white' ? 'white' : '#DBEAFE'}
            strokeWidth="1"
          />

          {/* セキュリティマーク（中央の点） */}
          <circle
            cx="0"
            cy="0"
            r="1.5"
            fill={variant === 'white' ? 'white' : '#FCD34D'}
          />

          {/* ダイヤルのマーカー（12時、3時、6時、9時の位置） */}
          <circle cx="0" cy="-6" r="1" fill={variant === 'white' ? 'white' : '#DBEAFE'} />
          <circle cx="6" cy="0" r="1" fill={variant === 'white' ? 'white' : '#DBEAFE'} />
          <circle cx="0" cy="6" r="1" fill={variant === 'white' ? 'white' : '#DBEAFE'} />
          <circle cx="-6" cy="0" r="1" fill={variant === 'white' ? 'white' : '#DBEAFE'} />
        </g>

        {/* ヒンジ（左側の点） */}
        <circle cx="4" cy="8" r="1.5" fill={variant === 'white' ? 'white' : '#94A3B8'} />
        <circle cx="4" cy="16" r="1.5" fill={variant === 'white' ? 'white' : '#94A3B8'} />
        <circle cx="4" cy="24" r="1.5" fill={variant === 'white' ? 'white' : '#94A3B8'} />
      </g>

      {/* セキュリティキラキラエフェクト */}
      <g opacity="0.6">
        <circle cx="14" cy="10" r="1" fill={variant === 'white' ? 'white' : '#FCD34D'} />
        <circle cx="50" cy="14" r="1.5" fill={variant === 'white' ? 'white' : '#FCD34D'} />
        <circle cx="10" cy="58" r="1" fill={variant === 'white' ? 'white' : '#60A5FA'} />
        <circle cx="54" cy="54" r="1.5" fill={variant === 'white' ? 'white' : '#60A5FA'} />
      </g>
    </svg>
  );
};

// ファビコン用のシンプル版
export const GlacierLogoSimple: React.FC<{ size?: number }> = ({ size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="simple-vault-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>

      {/* クラウドの背景（シンプル版） */}
      <ellipse cx="16" cy="8" rx="12" ry="6" fill="#3B9EF5" opacity="0.2" />

      {/* 金庫本体（シンプル版） */}
      <rect x="6" y="12" width="20" height="18" rx="2" fill="url(#simple-vault-gradient)" />

      {/* 内側のドア */}
      <rect x="7" y="13" width="18" height="16" rx="1.5" fill="#2563EB" />

      {/* ハンドル */}
      <circle cx="16" cy="21" r="5" fill="#60A5FA" stroke="#DBEAFE" strokeWidth="1" />
      <circle cx="16" cy="21" r="3" fill="none" stroke="#DBEAFE" strokeWidth="0.8" />
      <circle cx="16" cy="21" r="1" fill="#FCD34D" />
    </svg>
  );
};
