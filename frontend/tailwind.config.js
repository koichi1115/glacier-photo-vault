/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DADSプライマリーカラー
        'dads-primary': '#0066CC',
        'dads-primary-hover': '#0052A3',
        'dads-primary-active': '#003D7A',
        // DADSセマンティックカラー
        'dads-success': '#00703C',
        'dads-warning': '#FF6B00',
        'dads-danger': '#D93F00',
        'dads-info': '#0066CC',
        // ニュートラルカラー
        'dads-text-primary': '#1A1A1A',
        'dads-text-secondary': '#5F5F5F',
        'dads-border': '#D6D6D6',
        'dads-bg-base': '#FFFFFF',
        'dads-bg-secondary': '#F7F7F7',
        'dads-bg-tertiary': '#EEEEEE',
      },
      spacing: {
        // DADSの8pxグリッドシステム
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '5': '40px',
        '6': '48px',
        '8': '64px',
        '10': '80px',
        '12': '96px',
      },
      fontSize: {
        // DADSタイポグラフィスケール
        'dads-xs': ['12px', { lineHeight: '1.5' }],
        'dads-sm': ['14px', { lineHeight: '1.5' }],
        'dads-base': ['16px', { lineHeight: '1.5' }],
        'dads-lg': ['18px', { lineHeight: '1.5' }],
        'dads-xl': ['20px', { lineHeight: '1.4' }],
        'dads-2xl': ['24px', { lineHeight: '1.4' }],
        'dads-3xl': ['32px', { lineHeight: '1.3' }],
        'dads-4xl': ['40px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        // DADS角丸
        'dads-sm': '4px',
        'dads-md': '8px',
        'dads-lg': '12px',
      },
      boxShadow: {
        // DADSシャドウ
        'dads-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'dads-base': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'dads-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'dads-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [
    require('@digital-go-jp/tailwind-theme-plugin'),
  ],
}
