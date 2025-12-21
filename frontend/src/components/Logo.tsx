/**
 * Glacier Photo Vault Logo Component
 * 写真と氷河を組み合わせたオリジナルアイコン
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
  const gradientId = `glacier-gradient-${Math.random().toString(36).substr(2, 9)}`;

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
              <stop offset="0%" stopColor="#3B9EF5" />
              <stop offset="50%" stopColor="#7B68EE" />
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

      {/* 背景の氷河（六角形） */}
      <path
        d="M32 4 L50 14 L50 34 L32 44 L14 34 L14 14 Z"
        fill={variant === 'gradient' ? `url(#${gradientId})` : variant === 'white' ? 'white' : '#3B9EF5'}
        opacity="0.15"
        className="logo-bg"
      />

      {/* 氷河の結晶パターン */}
      <g opacity="0.3">
        <path
          d="M32 12 L38 16 L38 24 L32 28 L26 24 L26 16 Z"
          stroke={variant === 'white' ? 'white' : '#3B9EF5'}
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M32 32 L42 38 L42 50 L32 56 L22 50 L22 38 Z"
          stroke={variant === 'white' ? 'white' : '#3B9EF5'}
          strokeWidth="1"
          fill="none"
        />
      </g>

      {/* メインのカメラアイコン */}
      <g transform="translate(18, 20)">
        {/* カメラボディ */}
        <rect
          x="2"
          y="6"
          width="24"
          height="16"
          rx="3"
          fill={variant === 'gradient' ? `url(#${gradientId})` : variant === 'white' ? 'white' : '#3B9EF5'}
          filter={variant === 'gradient' ? 'url(#glow)' : undefined}
        />

        {/* カメラレンズ */}
        <circle
          cx="14"
          cy="14"
          r="6"
          fill={variant === 'white' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)'}
        />
        <circle
          cx="14"
          cy="14"
          r="4"
          fill={variant === 'white' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.6)'}
        />

        {/* フラッシュ */}
        <rect
          x="4"
          y="2"
          width="6"
          height="4"
          rx="1"
          fill={variant === 'gradient' ? `url(#${gradientId})` : variant === 'white' ? 'white' : '#3B9EF5'}
          opacity="0.8"
        />

        {/* シャッターボタン */}
        <circle
          cx="22"
          cy="4"
          r="1.5"
          fill={variant === 'white' ? 'white' : '#FF6B6B'}
        />
      </g>

      {/* 氷のキラキラエフェクト */}
      <g opacity="0.6">
        <circle cx="12" cy="12" r="1.5" fill={variant === 'white' ? 'white' : '#E0F0FF'} />
        <circle cx="52" cy="20" r="1" fill={variant === 'white' ? 'white' : '#E0F0FF'} />
        <circle cx="48" cy="52" r="1.5" fill={variant === 'white' ? 'white' : '#E0F0FF'} />
        <circle cx="16" cy="52" r="1" fill={variant === 'white' ? 'white' : '#E0F0FF'} />
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
        <linearGradient id="simple-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B9EF5" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>

      {/* 六角形の背景 */}
      <path
        d="M16 2 L28 9 L28 23 L16 30 L4 23 L4 9 Z"
        fill="url(#simple-gradient)"
      />

      {/* カメラアイコン（シンプル版） */}
      <g transform="translate(8, 10)">
        <rect x="1" y="3" width="14" height="9" rx="1.5" fill="white" opacity="0.9" />
        <circle cx="8" cy="7.5" r="3" fill="#3B9EF5" opacity="0.5" />
        <rect x="2" y="1" width="4" height="2" rx="0.5" fill="white" opacity="0.7" />
      </g>
    </svg>
  );
};
