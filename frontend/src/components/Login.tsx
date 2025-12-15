import React from 'react';
import logo from '../assets/logo.png';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const Login: React.FC = () => {
    const handleLogin = (provider: 'google' | 'line') => {
        window.location.href = `${API_BASE_URL}/api/auth/${provider}`;
    };

    return (
        <div className="min-h-screen bg-dads-bg-secondary flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-dads-bg-base rounded-dads-lg shadow-dads-lg p-8 border border-dads-border text-center">
                <div className="mb-8">
                    <img src={logo} alt="Glacier Photo Vault" className="w-24 h-24 mx-auto rounded-dads-lg shadow-xl mb-6 object-cover" />
                    <h1 className="text-dads-2xl font-bold text-dads-text-primary mb-2">
                        Glacier Photo Vault
                    </h1>
                    <p className="text-dads-text-secondary">
                        安全で低コストな写真保管サービスへようこそ
                    </p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={() => handleLogin('google')}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-dads-md text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                        Googleでログイン
                    </button>

                    <button
                        onClick={() => handleLogin('line')}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#06C755] border border-transparent rounded-dads-md text-white font-medium hover:bg-[#05b34c] transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.5c-5.5 0-10 3.6-10 8 0 2.3 1.2 4.5 3.4 6 .2.1.4.4.3.7l-.8 2.3c-.1.4.3.7.6.5l2.7-1.5c.5-.3 1.1-.3 1.7-.2 1.4.3 2.9.3 4.3-.2 5.5 0 10-3.6 10-8s-4.5-8-10-8z" />
                        </svg>
                        LINEでログイン
                    </button>
                </div>

                <div className="mt-8 text-xs text-dads-text-secondary">
                    <p>
                        ログインすることで、利用規約とプライバシーポリシーに同意したことになります。
                    </p>
                </div>
            </div>
        </div>
    );
};
