import React from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const Login: React.FC = () => {
    const handleLogin = (provider: 'google' | 'line') => {
        window.location.href = `${API_BASE_URL}/api/auth/${provider}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 text-center">
                <div className="mb-8">
                    {/* 新しい金庫アイコン */}
                    <div className="w-28 h-28 mx-auto rounded-2xl shadow-xl mb-6 flex items-center justify-center overflow-hidden">
                        <img src="/favicon.png" alt="Glacier Photo Vault" className="w-full h-full object-cover rounded-2xl" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2" style={{
                        fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        letterSpacing: '-0.02em'
                    }}>
                        Glacier Photo Vault
                    </h1>
                    <p className="text-gray-600 text-base">
                        安全で低コストな写真保管サービスへようこそ
                    </p>
                </div>

                <div className="space-y-3">
                    {/* Googleログインボタン */}
                    <button
                        onClick={() => handleLogin('google')}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-md hover:shadow-lg"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span>Googleでログイン</span>
                    </button>

                    {/* LINEログインボタン - 公式ロゴ使用 */}
                    <button
                        onClick={() => handleLogin('line')}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[#06C755] border-2 border-[#06C755] rounded-xl text-white font-semibold hover:bg-[#05b34c] hover:border-[#05b34c] transition-all shadow-md hover:shadow-lg"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                        </svg>
                        <span>LINEでログイン</span>
                    </button>
                </div>

                <div className="mt-8 text-xs text-gray-500">
                    <p>
                        ログインすることで、利用規約とプライバシーポリシーに同意したことになります。
                    </p>
                </div>
            </div>

            {/* セキュリティバッジ */}
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-medium">256-bit暗号化で安全に保護</span>
            </div>
        </div>
    );
};
