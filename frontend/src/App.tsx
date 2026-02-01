import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PhotoVault } from './components/PhotoVault';
import { Login } from './components/Login';
import { AuthCallback } from './components/AuthCallback';
import { SubscriptionPage } from './components/SubscriptionPage';
import { TrialBanner } from './components/TrialBanner';
import { api, User } from './services/api';
import './App.css';

interface SubscriptionState {
  hasSubscription: boolean;
  isValid: boolean;
  status: string | null;
  trialDaysRemaining?: number;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState(window.location.pathname);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    hasSubscription: false,
    isValid: false,
    status: null,
  });

  const checkSubscription = async () => {
    try {
      const result = await api.getSubscription();
      setSubscription({
        hasSubscription: result.hasSubscription,
        isValid: result.isValid,
        status: result.subscription?.status || null,
        trialDaysRemaining: result.trialDaysRemaining,
      });
      return result.hasSubscription && result.isValid;
    } catch (error) {
      console.error('Failed to check subscription:', error);
      return false;
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      // Set path based on URL
      setPath(window.location.pathname);

      // Check for callback route
      if (window.location.pathname.startsWith('/auth/callback')) {
        setLoading(false);
        return;
      }

      // Check for existing session
      if (api.isAuthenticated()) {
        try {
          const userData = await api.getMe();
          setUser(userData);
          // Check subscription status
          await checkSubscription();
        } catch (error) {
          console.error('Session check failed:', error);
          api.logout();
        }
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for navigation events
    const handlePopState = () => {
      setPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

  // Navigation helper
  const navigate = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  // Handle subscription completion
  const handleSubscriptionComplete = async () => {
    await checkSubscription();
    navigate('/');
  };

  // Route: Subscription required (no valid subscription)
  if (!subscription.isValid) {
    return (
      <SubscriptionPage onSubscriptionComplete={handleSubscriptionComplete} />
    );
  }

  // Route: Main App (Photo Vault)
  return (
    <div className="app">
      {/* トライアルバナー表示 */}
      {subscription.status === 'trialing' &&
        subscription.trialDaysRemaining !== undefined && (
          <TrialBanner
            daysRemaining={subscription.trialDaysRemaining}
            onUpgrade={() => navigate('/billing')}
          />
        )}
      <Header
        userName={user.email.split('@')[0] || 'User'}
        displayName={user.displayName}
        profilePhoto={user.profilePhoto}
        onNavigate={navigate}
        subscriptionStatus={subscription.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | null}
      />
      <main className="flex-1">
        <PhotoVault userId={user.userId} />
      </main>
    </div>
  );
}

export default App;
