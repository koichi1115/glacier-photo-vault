/**
 * Usage Dashboard Component
 * ストレージ使用量と課金情報のダッシュボード
 */

import React, { useState, useEffect } from 'react';

interface UsageData {
  currentUsage: {
    storageBytes: number;
    fileCount: number;
    lastUpdated: string;
  };
  limits: {
    storageLimitBytes: number;
    hasPaymentMethod: boolean;
  };
  status: {
    paymentStatus: string;
  };
}

interface EstimateData {
  billingPeriod: {
    start: string;
    end: string;
  };
  estimate: {
    storageCost: number;
    apiCost: number;
    totalAmount: number;
  };
}

interface PaymentMethodData {
  hasPaymentMethod: boolean;
  paymentMethod?: {
    card_brand: string;
    card_last4: string;
  };
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const formatCurrency = (amount: number): string => {
  return `¥${amount.toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const UsageDashboard: React.FC = () => {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
      };

      // 使用量を取得
      const usageResponse = await fetch('/api/billing/usage', { headers });
      if (usageResponse.ok) {
        setUsage(await usageResponse.json());
      }

      // 予想請求額を取得
      const estimateResponse = await fetch('/api/billing/estimate', { headers });
      if (estimateResponse.ok) {
        setEstimate(await estimateResponse.json());
      }

      // 支払い方法を取得
      const paymentResponse = await fetch('/api/billing/payment-method', { headers });
      if (paymentResponse.ok) {
        setPaymentMethod(await paymentResponse.json());
      }
    } catch (error) {
      console.error('Failed to load usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">使用量データの読み込みに失敗しました。</p>
      </div>
    );
  }

  const usagePercent = (usage.currentUsage.storageBytes / usage.limits.storageLimitBytes) * 100;
  const isNearLimit = usagePercent >= 80;

  return (
    <div className="space-y-6">
      {/* ストレージ使用量カード */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">ストレージ使用量</h2>

        <div className="mb-4">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-3xl font-bold text-gray-900">
              {formatBytes(usage.currentUsage.storageBytes)}
            </span>
            <span className="text-sm text-gray-500">
              / {formatBytes(usage.limits.storageLimitBytes)}
            </span>
          </div>

          {/* プログレスバー */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isNearLimit ? 'bg-red-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-600">
              {usage.currentUsage.fileCount}ファイル
            </span>
            <span className={`text-sm font-semibold ${
              isNearLimit ? 'text-red-600' : 'text-gray-600'
            }`}>
              {usagePercent.toFixed(1)}% 使用中
            </span>
          </div>
        </div>

        {isNearLimit && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
            <p className="text-sm text-yellow-800">
              ⚠️ ストレージ容量が上限に近づいています。不要なファイルを削除してください。
            </p>
          </div>
        )}
      </div>

      {/* 今月の予想請求額カード */}
      {estimate && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">今月の予想請求額</h2>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">ストレージ保管料</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(estimate.estimate.storageCost)}
              </span>
            </div>

            {estimate.estimate.apiCost > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">API使用料</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(estimate.estimate.apiCost)}
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-800">合計</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(estimate.estimate.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            請求期間: {estimate.billingPeriod.start} 〜 {estimate.billingPeriod.end}
          </p>
        </div>
      )}

      {/* 支払い方法カード */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">支払い方法</h2>

        {paymentMethod?.hasPaymentMethod && paymentMethod.paymentMethod ? (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {paymentMethod.paymentMethod.card_brand.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  •••• {paymentMethod.paymentMethod.card_last4}
                </p>
                <p className="text-xs text-gray-500">登録済み</p>
              </div>
            </div>
            <button
              onClick={() => {/* TODO: 支払い方法変更モーダルを開く */}}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
            >
              変更
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-600 mb-4">
              支払い方法が登録されていません。<br />
              100MBを超える容量をご利用いただくには支払い方法の登録が必要です。
            </p>
            <button
              onClick={() => {/* TODO: 支払い方法登録モーダルを開く */}}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              支払い方法を登録
            </button>
          </div>
        )}
      </div>

      {/* 料金プランカード */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg p-6 border border-blue-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">料金プラン</h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">ストレージ保管料</span>
            <span className="font-semibold text-gray-900">¥10/GB/月</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">無料枠</span>
            <span className="font-semibold text-green-600">100MBまで無料</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">データ復元（標準12h）</span>
            <span className="font-semibold text-gray-900">¥5/GB</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">データ復元（バルク48h）</span>
            <span className="font-semibold text-gray-900">¥1/GB</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">API呼び出し</span>
            <span className="font-semibold text-gray-900">¥1/1000リクエスト</span>
          </div>
        </div>
      </div>
    </div>
  );
};