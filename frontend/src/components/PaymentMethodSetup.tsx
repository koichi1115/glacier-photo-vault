/**
 * Payment Method Setup Component
 * Stripe Elements を使用した支払い方法登録UI
 */

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#1f2937',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
};

interface PaymentMethodFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentMethodForm: React.FC<PaymentMethodFormProps> = ({ onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // SetupIntentを取得
      const setupResponse = await fetch('/api/billing/setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!setupResponse.ok) {
        throw new Error('Failed to create setup intent');
      }

      const { clientSecret } = await setupResponse.json();

      // カード情報を確認
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // SetupIntentを確認
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      // PaymentMethodを登録
      const attachResponse = await fetch('/api/billing/payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          paymentMethodId: setupIntent.payment_method,
        }),
      });

      if (!attachResponse.ok) {
        throw new Error('Failed to attach payment method');
      }

      onSuccess();
    } catch (err: any) {
      console.error('Payment method setup error:', err);
      setError(err.message || 'カードの登録に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          クレジットカード情報
        </label>
        <div className="border border-gray-300 rounded-lg p-4 bg-white">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          カード情報は安全に暗号化されて保存されます。
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '登録中...' : 'カードを登録'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          キャンセル
        </button>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>✓ 256ビットSSL暗号化</p>
        <p>✓ PCI DSS準拠</p>
        <p>✓ いつでもキャンセル可能</p>
      </div>
    </form>
  );
};

interface PaymentMethodSetupProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const PaymentMethodSetup: React.FC<PaymentMethodSetupProps> = ({ onSuccess, onCancel }) => {
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            支払い方法を登録
          </h2>
          <p className="text-gray-600">
            100MBを超える容量をご利用いただくには、支払い方法の登録が必要です。
          </p>
        </div>

        <Elements stripe={stripePromise}>
          <PaymentMethodForm onSuccess={onSuccess} onCancel={onCancel} />
        </Elements>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">料金プラン</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>ストレージ保管料</span>
              <span className="font-semibold">¥10/GB/月</span>
            </div>
            <div className="flex justify-between">
              <span>無料枠</span>
              <span className="font-semibold">100MBまで無料</span>
            </div>
            <div className="flex justify-between">
              <span>データ復元（標準）</span>
              <span className="font-semibold">¥5/GB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};