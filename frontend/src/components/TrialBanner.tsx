/**
 * TrialBanner Component
 * トライアル残り日数を表示するバナー
 */

import React from 'react';

interface TrialBannerProps {
  daysRemaining: number;
  onUpgrade?: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({
  daysRemaining,
  onUpgrade,
}) => {
  // 残り日数に応じた色を決定
  const getBannerStyle = () => {
    if (daysRemaining <= 3) {
      return 'bg-red-500 text-white';
    } else if (daysRemaining <= 7) {
      return 'bg-yellow-500 text-yellow-900';
    } else {
      return 'bg-blue-500 text-white';
    }
  };

  const getMessage = () => {
    if (daysRemaining <= 0) {
      return 'トライアル期間が終了しました';
    } else if (daysRemaining === 1) {
      return 'トライアル期間は明日終了します';
    } else {
      return `トライアル期間：残り${daysRemaining}日`;
    }
  };

  return (
    <div className={`${getBannerStyle()} py-2 px-4`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">{getMessage()}</span>
        </div>
        {onUpgrade && daysRemaining > 0 && (
          <button
            onClick={onUpgrade}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
          >
            料金プランを見る
          </button>
        )}
      </div>
    </div>
  );
};
