/**
 * Drag & Drop Zone Component
 * ドラッグ&ドロップでファイルアップロード
 */

import React, { useState, useCallback } from 'react';

interface DragDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  children?: React.ReactNode;
}

export const DragDropZone: React.FC<DragDropZoneProps> = ({ onFilesSelected, accept, children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setDragCounter(0);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative transition-all duration-300 ${isDragging ? 'drag-active' : ''}`}
    >
      {children}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-dads-lg border-4 border-dashed border-dads-primary bg-gradient-to-br from-blue-50/95 to-purple-50/95 backdrop-blur-sm animate-fade-in">
          <div className="text-center p-8">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white flex items-center justify-center shadow-lg animate-bounce">
              <svg className="w-12 h-12 text-dads-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-dads-xl font-bold text-dads-primary mb-2">📁 ファイルをドロップ</p>
            <p className="text-dads-sm text-dads-text-secondary">ここにファイルをドロップしてアップロード</p>
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes drag-pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        .drag-active {
          animation: drag-pulse 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
