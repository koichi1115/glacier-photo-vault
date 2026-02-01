/**
 * SubscriptionPage Component
 * サブスクリプション登録・カード情報入力ページ
 */

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { api } from '../services/api';

// Stripe公開キーを環境変数から取得
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
);

interface SubscriptionPageProps {
  onSubscriptionComplete: () => void;
}

const CheckoutForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponValid, setCouponValid] = useState<boolean | null>(null);
  const [couponInfo, setCouponInfo] = useState<{
    discountPercent: number | null;
    discountAmount: number | null;
  } | null>(null);

  useEffect(() => {
    // SetupIntent を作成
    const initSetup = async () => {
      try {
        const result = await api.createSetupIntent();
        if (result.success) {
          setClientSecret(result.clientSecret);
        } else {
          setError('決済の初期化に失敗しました');
        }
      } catch (err: any) {
        setError(err.message || '決済の初期化に失敗しました');
      }
    };

    initSetup();
  }, []);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;

    try {
      const result = await api.validateCoupon(couponCode);
      setCouponValid(result.valid);
      if (result.valid && result.coupon) {
        setCouponInfo({
          discountPercent: result.coupon.discountPercent,
          discountAmount: result.coupon.discountAmount,
        });
      } else {
        setCouponInfo(null);
      }
    } catch (err) {
      setCouponValid(false);
      setCouponInfo(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // カード情報を確認
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('カード情報が入力されていません');
      }

      // SetupIntentを確認
      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (!setupIntent?.payment_method) {
        throw new Error('支払い方法の設定に失敗しました');
      }

      // カード確認してトライアル開始
      const result = await api.confirmCard(
        setupIntent.payment_method as string,
        couponValid ? couponCode : undefined
      );

      if (result.success) {
        onSuccess();
      } else {
        throw new Error('サブスクリプションの開始に失敗しました');
      }
    } catch (err: any) {
      setError(err.message || '処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    style: {
      base: {
        color: '#32325d',
        fontFamily: '"Noto Sans JP", -apple-system, BlinkMacSystemFont, sans-serif',
        fontSmoothing: 'antialiased',
        fontSize: '16px',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#fa755a',
        iconColor: '#fa755a',
      },
    },
    // 日本のカードでは郵便番号は不要なので非表示
    hidePostalCode: true,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 料金説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">料金プラン</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>・30日間無料トライアル</li>
          <li>・従量課金：¥10/GB/月</li>
          <li>・いつでも解約可能</li>
        </ul>
        {couponValid && couponInfo && (
          <div className="mt-2 p-2 bg-green-100 rounded text-green-800 text-sm">
            クーポン適用：
            {couponInfo.discountPercent
              ? `${couponInfo.discountPercent}%オフ`
              : `¥${couponInfo.discountAmount}オフ`}
          </div>
        )}
      </div>

      {/* クーポンコード */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          クーポンコード（お持ちの場合）
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
              setCouponValid(null);
              setCouponInfo(null);
            }}
            placeholder="COUPON123"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleValidateCoupon}
            disabled={!couponCode.trim()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            確認
          </button>
        </div>
        {couponValid === false && (
          <p className="mt-1 text-sm text-red-600">
            無効なクーポンコードです
          </p>
        )}
        {couponValid === true && (
          <p className="mt-1 text-sm text-green-600">
            クーポンが適用されます
          </p>
        )}
      </div>

      {/* カード入力 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          カード情報
        </label>
        <div className="p-4 border border-gray-300 rounded-lg bg-white">
          <CardElement options={cardStyle} />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          30日間は課金されません。トライアル終了後に自動的に課金が開始されます。
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={!stripe || !clientSecret || loading}
        className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            処理中...
          </span>
        ) : (
          '30日間無料トライアルを開始'
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        「トライアルを開始」をクリックすることで、
        <a href="#" className="text-blue-600 underline">利用規約</a>と
        <a href="#" className="text-blue-600 underline">プライバシーポリシー</a>
        に同意したものとみなされます。
      </p>
    </form>
  );
};

export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({
  onSubscriptionComplete,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4 sm:flex sm:items-center sm:justify-center">
      <div className="w-full max-w-md mx-auto">
        {/* ロゴ・ヘッダー */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-white shadow-lg">
            <img
              src="/favicon.png"
              alt="Glacier Photo Vault"
              className="w-14 h-14 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Glacier Photo Vault
          </h1>
          <p className="text-gray-600 mt-1">
            超低コスト写真保管サービス
          </p>
        </div>

        {/* メインカード */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            サブスクリプション登録
          </h2>

          <Elements stripe={stripePromise}>
            <CheckoutForm onSuccess={onSubscriptionComplete} />
          </Elements>
        </div>

        {/* セキュリティバッジ */}
        <div className="mt-6 flex items-center justify-center gap-2 text-gray-500 text-sm">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>Stripeによる安全な決済</span>
        </div>
      </div>
    </div>
  );
};
