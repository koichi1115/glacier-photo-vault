/**
 * Billing Page
 * 課金・支払い管理ページ
 */

import React, { useState } from 'react';
import { UsageDashboard } from '../components/UsageDashboard';
import { PaymentMethodSetup } from '../components/PaymentMethodSetup';

export const BillingPage: React.FC = () => {
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);

  const handlePaymentSuccess = () => {
    setShowPaymentSetup(false);
    // ダッシュボードをリロード
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            課金・使用量管理
          </h1>
          <p className="text-gray-600">
            ストレージ使用量と請求情報を確認できます
          </p>
        </div>

        {/* 支払い方法登録モーダル */}
        {showPaymentSetup ? (
          <div className="mb-8">
            <PaymentMethodSetup
              onSuccess={handlePaymentSuccess}
              onCancel={() => setShowPaymentSetup(false)}
            />
          </div>
        ) : (
          /* 使用量ダッシュボード */
          <UsageDashboard />
        )}
      </div>
    </div>
  );
};