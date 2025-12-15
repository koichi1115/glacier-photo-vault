import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PhotoVault } from './components/PhotoVault';
import { Login } from './components/Login';
import { AuthCallback } from './components/AuthCallback';
import { api, User } from './services/api';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const checkAuth = async () => {
      // Check for callback route
      if (window.location.pathname.startsWith('/auth/callback')) {
        setPath('/auth/callback');
        setLoading(false);
        return;
      }

      // Check for existing session
      if (api.isAuthenticated()) {
        try {
          const userData = await api.getMe();
          setUser(userData);
        } catch (error) {
          console.error('Session check failed:', error);
          api.logout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dads-bg-secondary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Route: Callback
  if (path === '/auth/callback') {
    return <AuthCallback />;
  }

  // Route: Login (if not authenticated)
  if (!user) {
    return <Login />;
  }

  // Route: Main App
  return (
    <div className="app">
      <Header userName={user.email.split('@')[0] || 'User'} />
      <main className="flex-1 overflow-y-auto">
        <PhotoVault userId={user.userId} />
      </main>
    </div>
  );
}

export default App;
