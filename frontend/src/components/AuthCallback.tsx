import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export const AuthCallback: React.FC = () => {
    const [status, setStatus] = useState('Authenticating...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (!accessToken || !refreshToken) {
                    throw new Error('No tokens received');
                }

                // Store tokens
                api.setTokens(accessToken, refreshToken);

                // Fetch user info
                setStatus('Fetching user info...');
                await api.getMe();

                // Redirect to home
                window.location.href = '/';
            } catch (err: any) {
                console.error('Auth callback error:', err);
                setError(err.message || 'Authentication failed');
                setStatus('Failed');
            }
        };

        handleCallback();
    }, []);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dads-bg-secondary p-4">
                <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                    <div className="text-red-500 text-xl mb-2">Authentication Error</div>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <a href="/" className="text-blue-500 hover:underline">Return to Login</a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-dads-bg-secondary">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-dads-text-secondary">{status}</p>
            </div>
        </div>
    );
};
