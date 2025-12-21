/**
 * Confetti Animation Component
 * アップロード成功時の祝福エフェクト
 */

import React, { useEffect, useState } from 'react';

interface ConfettiProps {
  trigger: boolean;
  onComplete?: () => void;
}

interface ConfettiPiece {
  id: number;
  left: number;
  animationDelay: string;
  backgroundColor: string;
}

export const Confetti: React.FC<ConfettiProps> = ({ trigger, onComplete }) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger) {
      // Generate confetti pieces
      const colors = ['#3B9EF5', '#A78BFA', '#F472B6', '#FBBF24', '#34D399', '#60A5FA'];
      const newPieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        animationDelay: `${Math.random() * 0.5}s`,
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      }));
      setPieces(newPieces);
      setIsActive(true);

      // Clean up after animation
      const timer = setTimeout(() => {
        setIsActive(false);
        setPieces([]);
        onComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!isActive) return null;

  return (
    <>
      <style>{`
        .confetti-piece {
          position: absolute;
          width: 10px;
          height: 10px;
          top: -10px;
          opacity: 1;
          animation: confetti-fall 3s ease-out forwards;
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        {pieces.map((piece) => (
          <div
            key={piece.id}
            className="confetti-piece"
            style={{
              left: `${piece.left}%`,
              animationDelay: piece.animationDelay,
              backgroundColor: piece.backgroundColor,
            }}
          />
        ))}
      </div>
    </>
  );
};
