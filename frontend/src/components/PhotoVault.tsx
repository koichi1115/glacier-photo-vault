/**
 * PhotoVault Component
 * デジタル庁デザインシステム（DADS）準拠 - 改善版
 */

import React, { useState, useEffect, useRef } from 'react';
import { Photo, PhotoStatus } from '@glacier-photo-vault/shared';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';
import { DragDropZone } from './DragDropZone';
import { ScrollReveal } from './ScrollReveal';
import { Confetti } from './Confetti';

interface PhotoVaultProps {
  userId: string;
}

// SVGアイコンコンポーネント
const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const PhotoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InfoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// スケルトンローディングコンポーネント
const SkeletonCard = () => (
  <div className="bg-dads-bg-base rounded-dads-md shadow-dads-base p-6 border border-dads-border animate-fade-in">
    <div className="flex justify-between items-start mb-4">
      <div className="flex-1">
        <div className="skeleton h-6 w-48 mb-2 rounded"></div>
        <div className="skeleton h-4 w-32 mb-3 rounded"></div>
        <div className="skeleton h-4 w-64 rounded"></div>
      </div>
      <div className="skeleton h-8 w-24 rounded-full"></div>
    </div>
    <div className="border-t border-dads-border pt-4">
      <div className="flex gap-3">
        <div className="skeleton h-10 flex-1 rounded-dads-md"></div>
        <div className="skeleton h-10 flex-1 rounded-dads-md"></div>
      </div>
    </div>
  </div>
);

// 空の状態コンポーネント
const EmptyState = () => (
  <div className="nani-card p-8 sm:p-12 md:p-16 text-center animate-fade-in">
    <div className="flex justify-center mb-6 sm:mb-8">
      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center animate-pulse-slow" style={{ background: 'linear-gradient(135deg, #E0F0FF 0%, #F0E8FF 100%)' }}>
        <div className="w-16 h-16 sm:w-20 sm:h-20 text-dads-primary">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
    </div>
    <h3 className="text-lg sm:text-xl md:text-dads-2xl font-bold text-dads-text-primary mb-3">
      📸 写真がまだありません
    </h3>
    <p className="text-sm sm:text-base text-dads-text-secondary mb-6 sm:mb-8 max-w-xl mx-auto px-4">
      上のフォームから写真をアップロードして、<br className="hidden sm:inline" />
      超低コストのGlacier Deep Archiveで長期保管を始めましょう
    </p>
    <div className="flex items-center justify-center gap-6 sm:gap-8 md:gap-12 text-sm sm:text-base text-dads-text-secondary flex-wrap">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-dads-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="whitespace-nowrap">無料アップロード</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-dads-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="whitespace-nowrap">超低コスト</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-dads-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="whitespace-nowrap text-xs sm:text-sm md:text-base">99.999999999%耐久性</span>
      </div>
    </div>
  </div>
);

export const PhotoVault: React.FC<PhotoVaultProps> = ({ userId }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'other'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [sortBy, setSortBy] = useState<'uploadDate' | 'size'>('uploadDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<Array<{
    month: string;
    totalSize: number;
    photoCount: number;
  }>>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
  } | null>(null);
  const [uploadCancelled, setUploadCancelled] = useState(false);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  // Toast notifications
  const { toasts, success, error, warning, info, removeToast } = useToast();

  useEffect(() => {
    loadPhotos();
    loadStats();
    loadTags();
    loadMonthlyStats();
  }, [userId]);

  // サムネイル生成
  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        resolve(''); // 画像でない場合は空文字を返す
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 100;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => reject(new Error('画像の読み込みに失敗'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗'));
      reader.readAsDataURL(file);
    });
  };

  const loadPhotos = async () => {
    try {
      const photos = await api.getUserPhotos(userId);
      setPhotos(photos);
    } catch (error) {
      console.error('Failed to load photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await api.getUserStats(userId);
      setStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadTags = async () => {
    try {
      const tags = await api.getUserTags(userId);
      setAvailableTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const loadMonthlyStats = async () => {
    try {
      const stats = await api.getMonthlyStats(userId);
      setMonthlyStats(stats);
    } catch (error) {
      console.error('Failed to load monthly stats:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const firstFile = e.target.files[0];
      const hasRelativePath = (firstFile as any).webkitRelativePath && (firstFile as any).webkitRelativePath !== '';

      // webkitRelativePathがある場合はフォルダアップロード
      if (hasRelativePath || e.target.files.length > 1) {
        // フォルダモードまたは複数ファイル：複数ファイル（フォルダパスも保持）
        const filesArray = Array.from(e.target.files);
        setSelectedFiles(filesArray);
        setSelectedFile(null);

        // サムネイル生成
        const newThumbnails: Record<string, string> = {};
        for (const file of filesArray) {
          try {
            const thumbnail = await generateThumbnail(file);
            if (thumbnail) {
              newThumbnails[file.name] = thumbnail;
            }
          } catch (error) {
            console.error('サムネイル生成エラー:', error);
          }
        }
        setThumbnails(newThumbnails);
      } else {
        // シングルファイルモード
        const file = e.target.files[0];
        setSelectedFile(file);
        setSelectedFiles([]);

        // サムネイル生成
        try {
          const thumbnail = await generateThumbnail(file);
          if (thumbnail) {
            setThumbnails({ [file.name]: thumbnail });
          }
        } catch (error) {
          console.error('サムネイル生成エラー:', error);
        }
      }
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setSelectedFiles([]);
    setThumbnails({});
    setTitle('');
    setDescription('');
    setTags('');
    // Reset file inputs
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const handleUpload = async (retryFiles?: File[]) => {
    const filesToUpload = retryFiles || (selectedFiles.length > 0 ? selectedFiles : (selectedFile ? [selectedFile] : []));
    if (filesToUpload.length === 0) return;

    setUploading(true);
    setUploadCancelled(false);
    setUploadProgress({ current: 0, total: filesToUpload.length, currentFile: '' });

    try {
      let successCount = 0;
      let failCount = 0;
      const newFailedFiles: File[] = [];
      const failedFileNames: string[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        // 中断フラグをチェック
        if (uploadCancelled) {
          console.log('Upload cancelled by user');
          break;
        }

        const file = filesToUpload[i];
        const relativePath = (file as any).webkitRelativePath || file.name;

        // 進捗を更新
        setUploadProgress({
          current: i + 1,
          total: filesToUpload.length,
          currentFile: relativePath,
        });

        const formData = new FormData();
        formData.append('photo', file);
        formData.append('userId', userId);
        formData.append('title', title || relativePath);
        formData.append('relativePath', relativePath);
        formData.append('description', description);
        formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(t => t)));

        // サムネイルがあれば送信
        const thumbnail = thumbnails[file.name];
        if (thumbnail) {
          formData.append('thumbnail', thumbnail);
        }

        try {
          await api.uploadPhoto(formData);
          successCount++;
        } catch (error) {
          console.error('Upload error:', error);
          failCount++;
          newFailedFiles.push(file);
          failedFileNames.push(relativePath);
        }
      }

      // 失敗したファイルを保存（リトライ用）
      setFailedFiles(newFailedFiles);

      // 結果メッセージの生成
      const wasCancelled = uploadCancelled;
      if (wasCancelled) {
        warning(`アップロードを中断しました\n成功: ${successCount}件\n未完了: ${filesToUpload.length - successCount - failCount}件\n失敗: ${failCount}件`);
      } else if (filesToUpload.length === 1) {
        if (successCount > 0) {
          success('🎉 ファイルがGlacier Deep Archiveにアップロードされました！');
          setShowConfetti(true);
        } else {
          error(`アップロードに失敗しました\nファイル: ${failedFileNames[0]}`);
        }
      } else {
        if (failCount === 0) {
          success(`🎉 ${successCount}件のファイルをアップロードしました！`);
          setShowConfetti(true);
        } else {
          warning(`アップロード完了\n成功: ${successCount}件\n失敗: ${failCount}件`);
        }
      }

      // リトライでない場合のみクリア
      if (!retryFiles) {
        setSelectedFile(null);
        setSelectedFiles([]);
        setTitle('');
        setDescription('');
        setTags('');
        setThumbnails({});
      }

      loadPhotos();
      loadStats();
      loadTags();
      loadMonthlyStats();
    } catch (err) {
      console.error('Upload error:', err);
      error('❌ アップロードに失敗しました');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleCancelUpload = () => {
    setUploadCancelled(true);
  };

  const handleRetryFailedUploads = () => {
    if (failedFiles.length > 0) {
      handleUpload(failedFiles);
    }
  };

  // フィルタリングと並び替え
  const getFilteredAndSortedPhotos = () => {
    let filtered = [...photos];

    // ファイル種別でフィルタ
    if (filterType !== 'all') {
      filtered = filtered.filter(photo => {
        if (filterType === 'image') {
          return photo.originalName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
        } else if (filterType === 'video') {
          return photo.originalName.match(/\.(mp4|mov|avi|mkv|webm|flv|wmv)$/i);
        } else if (filterType === 'other') {
          // 画像と動画以外のすべて（音声、PDF、ZIP等）
          return !photo.originalName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|mp4|mov|avi|mkv|webm|flv|wmv)$/i);
        }
        return true;
      });
    }

    // タグでフィルタ
    if (filterTag) {
      filtered = filtered.filter(photo => {
        return photo.tags && photo.tags.includes(filterTag);
      });
    }

    // 日付範囲でフィルタ
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      filtered = filtered.filter(photo => new Date(photo.uploadedAt) >= fromDate);
    }
    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999); // 終日まで含める
      filtered = filtered.filter(photo => new Date(photo.uploadedAt) <= toDate);
    }

    // 並び替え
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'size') {
        comparison = a.size - b.size;
      } else if (sortBy === 'uploadDate') {
        comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  // チェックボックス操作
  const handleToggleSelect = (photoId: string) => {
    setSelectedPhotoIds(prev =>
      prev.includes(photoId)
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
  };

  const handleToggleSelectAll = () => {
    const filteredPhotos = getFilteredAndSortedPhotos();
    const currentPagePhotos = filteredPhotos.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
    const currentPageIds = currentPagePhotos.map(p => p.id);

    if (currentPageIds.every(id => selectedPhotoIds.includes(id))) {
      // 全選択解除
      setSelectedPhotoIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // 全選択
      setSelectedPhotoIds(prev => [...new Set([...prev, ...currentPageIds])]);
    }
  };

  const handleRestoreSingle = async (photoId: string, tier: 'Standard' | 'Bulk') => {
    try {
      const data = await api.requestRestore(photoId, tier);
      if (data.success) {
        success(`✅ 復元リクエストを送信しました\n推定完了時間: ${data.estimatedHours}時間`);
        loadPhotos();
      }
    } catch (err) {
      console.error('Restore error:', err);
      error('❌ 復元リクエストに失敗しました');
    }
  };

  const handleBulkRestore = async (tier: 'Standard' | 'Bulk') => {
    if (selectedPhotoIds.length === 0) {
      warning('復元するファイルを選択してください');
      return;
    }

    const confirmMessage = `選択した${selectedPhotoIds.length}件のファイルを復元しますか？\n復元タイプ: ${tier === 'Standard' ? 'Standard（12時間）' : 'Bulk（48時間・低コスト）'}`;
    if (!confirm(confirmMessage)) {
      return;
    }

    info('⏳ 復元リクエストを処理中...');
    let successCount = 0;
    let failCount = 0;

    for (const photoId of selectedPhotoIds) {
      try {
        const data = await api.requestRestore(photoId, tier);
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('Restore error:', err);
        failCount++;
      }
    }

    if (failCount === 0) {
      success(`✅ ${successCount}件の復元リクエストが完了しました`);
    } else {
      warning(`復元リクエスト完了\n成功: ${successCount}件\n失敗: ${failCount}件`);
    }
    setSelectedPhotoIds([]);
    loadPhotos();
  };

  const checkRestoreStatus = async (photoId: string) => {
    try {
      const data = await api.checkRestoreStatus(photoId);
      if (data.success) {
        info(`復元状態: ${data.status}`);
        loadPhotos();
      }
    } catch (err) {
      console.error('Status check error:', err);
      error('ステータスの確認に失敗しました');
    }
  };

  const handleDownload = async (photoId: string) => {
    try {
      const data = await api.getDownloadUrl(photoId);
      if (data.success) {
        success('📥 ダウンロードを開始します');
        window.open(data.downloadUrl, '_blank');
      } else {
        error(data.error || 'ダウンロードに失敗しました');
      }
    } catch (err) {
      console.error('Download error:', err);
      error('❌ ダウンロードURLの取得に失敗しました');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const calculateRestoreCost = (bytes: number, tier: 'standard' | 'bulk') => {
    const gb = bytes / (1024 * 1024 * 1024);
    const costPerGb = tier === 'standard' ? 0.02 : 0.0025;
    const cost = gb * costPerGb;
    return cost < 0.01 ? '< $0.01' : `$${cost.toFixed(2)}`;
  };

  const getStatusLabel = (status: PhotoStatus): string => {
    const labels: Record<PhotoStatus, string> = {
      [PhotoStatus.UPLOADING]: 'アップロード中',
      [PhotoStatus.ARCHIVED]: 'アーカイブ済み',
      [PhotoStatus.RESTORE_REQUESTED]: '復元リクエスト済み',
      [PhotoStatus.RESTORING]: '復元中',
      [PhotoStatus.RESTORED]: '復元完了',
      [PhotoStatus.FAILED]: '失敗',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: PhotoStatus): string => {
    const colors: Record<PhotoStatus, string> = {
      [PhotoStatus.UPLOADING]: 'bg-blue-50 text-dads-info border-blue-200',
      [PhotoStatus.ARCHIVED]: 'bg-dads-bg-tertiary text-dads-text-secondary border-dads-border',
      [PhotoStatus.RESTORE_REQUESTED]: 'bg-orange-50 text-dads-warning border-orange-200',
      [PhotoStatus.RESTORING]: 'bg-orange-50 text-dads-warning border-orange-200',
      [PhotoStatus.RESTORED]: 'bg-green-50 text-dads-success border-green-200',
      [PhotoStatus.FAILED]: 'bg-red-50 text-dads-danger border-red-200',
    };
    return colors[status] || 'bg-dads-bg-tertiary text-dads-text-secondary border-dads-border';
  };

  const StatusBadge: React.FC<{ status: PhotoStatus }> = ({ status }) => (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(status)}`}
      aria-label={`ステータス: ${getStatusLabel(status)}`}
    >
      <span className="inline-block w-2 h-2 rounded-full bg-current" aria-hidden="true" />
      {getStatusLabel(status)}
    </span>
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12 max-w-7xl mx-auto min-h-screen">
      <div className="mb-6 sm:mb-8 md:mb-12">
        <h1 className="text-2xl sm:text-dads-3xl md:text-dads-4xl lg:text-5xl font-bold text-dads-text-primary mb-2 sm:mb-3" style={{ lineHeight: '1.2' }}>
          📸 写真保管庫
        </h1>
        <div className="flex items-center gap-2 text-sm sm:text-dads-base text-dads-text-secondary">
          <ClockIcon />
          <span>最終更新: {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <ScrollReveal direction="up" delay={0}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {/* 総写真数 */}
            <div
              className="nani-card stat-card-hover p-4 sm:p-6 md:p-8 animate-fade-in cursor-pointer"
              style={{ animationDelay: '0s' }}
            >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs sm:text-dads-sm text-dads-text-secondary whitespace-nowrap">総写真数</div>
              <div className="text-dads-text-secondary">
                <PhotoIcon />
              </div>
            </div>
            <div className="text-lg sm:text-xl md:text-dads-2xl font-bold text-dads-text-primary">{stats.totalPhotos}</div>
          </div>

          {/* 総容量（復元コスト付き） */}
          <div
            className="nani-card stat-card-hover p-4 sm:p-6 md:p-8 animate-fade-in cursor-pointer"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs sm:text-dads-sm text-dads-text-secondary whitespace-nowrap">総容量</div>
              <div className="text-dads-text-secondary">
                <FileIcon />
              </div>
            </div>
            <div className="text-lg sm:text-xl md:text-dads-2xl font-bold text-dads-text-primary mb-2">{formatBytes(stats.totalSize)}</div>
            <div className="text-xs text-dads-text-secondary space-y-0.5">
              <div className="flex items-center gap-3">
                <span className="whitespace-nowrap">復元コスト（12h）:</span>
                <span className="font-semibold text-dads-warning whitespace-nowrap">{calculateRestoreCost(stats.totalSize, 'standard')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="whitespace-nowrap">復元コスト（48h）:</span>
                <span className="font-semibold text-dads-success whitespace-nowrap">{calculateRestoreCost(stats.totalSize, 'bulk')}</span>
              </div>
            </div>
          </div>

          {/* アーカイブ済み */}
          <div
            className="nani-card stat-card-hover p-4 sm:p-6 md:p-8 animate-fade-in cursor-pointer"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs sm:text-dads-sm text-dads-text-secondary whitespace-nowrap">アーカイブ済み</div>
              <div className="text-dads-text-secondary">
                <FileIcon />
              </div>
            </div>
            <div className="text-lg sm:text-xl md:text-dads-2xl font-bold text-dads-text-primary">{stats.archived}</div>
          </div>

          {/* 復元可能 */}
          <div
            className="nani-card stat-card-hover p-4 sm:p-6 md:p-8 animate-fade-in cursor-pointer"
            style={{ animationDelay: '0.3s' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs sm:text-dads-sm text-dads-text-secondary whitespace-nowrap">復元可能</div>
              <div className="text-dads-text-secondary">
                <FileIcon />
              </div>
            </div>
            <div className="text-lg sm:text-xl md:text-dads-2xl font-bold text-dads-text-primary">{stats.restored}</div>
          </div>
          </div>
        </ScrollReveal>
      )}

      {/* Monthly Storage Chart */}
      {!loading && monthlyStats.length > 0 && (
        <ScrollReveal direction="up" delay={50}>
          <div className="nani-card p-4 sm:p-6 md:p-8 mb-8 sm:mb-12 animate-fade-in">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 pb-3 border-b border-dads-border">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-dads-primary/10 rounded-dads-md flex items-center justify-center text-dads-primary flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-base sm:text-dads-lg md:text-dads-xl font-bold text-dads-text-primary">
              月別保存容量
            </h2>
          </div>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[300px]">
              <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={monthlyStats.map(stat => ({
                ...stat,
                sizeInMB: stat.totalSize / (1024 * 1024),
              }))}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const [year, month] = value.split('-');
                  return `${year}/${month}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value.toFixed(0)} MB`}
              />
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => {
                  if (value === undefined) return ['N/A', name || ''];
                  if (name === 'sizeInMB') {
                    return [`${value.toFixed(2)} MB`, '容量'];
                  }
                  if (name === 'photoCount') {
                    return [`${value}件`, 'ファイル数'];
                  }
                  return [value.toString(), name || ''];
                }}
                labelFormatter={(label) => {
                  const [year, month] = label.split('-');
                  return `${year}年${month}月`;
                }}
              />
              <Legend
                formatter={(value) => {
                  if (value === 'sizeInMB') return '容量 (MB)';
                  if (value === 'photoCount') return 'ファイル数';
                  return value;
                }}
              />
              <Bar dataKey="sizeInMB" fill="#0969da" name="sizeInMB" />
              <Bar dataKey="photoCount" fill="#64D8C6" name="photoCount" />
            </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          </div>
        </ScrollReveal>
      )}

      {/* Upload Form */}
      <ScrollReveal direction="up" delay={100}>
        <DragDropZone onFilesSelected={(files) => {
          setSelectedFiles(files);
          setSelectedFile(null);
          // Generate thumbnails
          files.forEach(async (file) => {
            try {
              const thumbnail = await generateThumbnail(file);
              if (thumbnail) {
                setThumbnails(prev => ({ ...prev, [file.name]: thumbnail }));
              }
            } catch (err) {
              console.error('サムネイル生成エラー:', err);
            }
          });
        }}>
          <div className="nani-card p-6 sm:p-8 mb-8 sm:mb-12 animate-fade-in scroll-mt-24">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-dads-border">
              <div className="w-10 h-10 bg-dads-primary/10 rounded-dads-md flex items-center justify-center text-dads-primary">
                <UploadIcon />
              </div>
              <h2 className="text-dads-lg sm:text-dads-xl font-bold text-dads-text-primary">
                写真をアップロード
              </h2>
            </div>

        {/* ファイル/フォルダ選択ボタン */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:flex-1 btn-pill btn-pill-primary flex items-center justify-center gap-2 text-dads-base whitespace-nowrap"
            style={{ minHeight: '48px' }}
          >
            📁 ファイルを選択
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="w-full sm:flex-1 btn-pill btn-pill-secondary flex items-center justify-center gap-2 text-dads-base whitespace-nowrap"
            style={{ minHeight: '48px' }}
          >
            📂 フォルダを選択
          </button>
        </div>

        {/* 隠しinput要素 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.*,text/*"
          onChange={handleFileSelect}
          multiple
          className="hidden"
          aria-label="ファイルを選択"
        />
        <input
          ref={folderInputRef}
          type="file"
          accept="image/*,video/*,audio/*,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.*,text/*"
          onChange={handleFileSelect}
          multiple
          // @ts-ignore - webkitdirectory is not in React types
          webkitdirectory=""
          directory=""
          className="hidden"
          aria-label="フォルダを選択"
        />

        {/* ファイル選択状態の表示 */}
        {(selectedFile || selectedFiles.length > 0) && (
          <div className="mb-4 space-y-3">
            {/* サムネイルプレビュー */}
            {Object.keys(thumbnails).length > 0 && (
              <div className="p-3 bg-dads-bg-secondary rounded-dads-md">
                <p className="text-dads-sm font-medium text-dads-text-primary mb-2">
                  サムネイルプレビュー
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(thumbnails).slice(0, 10).map(([fileName, thumbnail]) => (
                    <div key={fileName} className="relative group">
                      <img
                        src={thumbnail}
                        alt={fileName}
                        className="w-20 h-20 object-cover rounded border border-dads-border"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded flex items-end p-1">
                        <p className="text-white text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {fileName.length > 15 ? fileName.substring(0, 12) + '...' : fileName}
                        </p>
                      </div>
                    </div>
                  ))}
                  {Object.keys(thumbnails).length > 10 && (
                    <div className="w-20 h-20 flex items-center justify-center bg-dads-bg-tertiary rounded border border-dads-border text-dads-text-secondary text-dads-sm">
                      +{Object.keys(thumbnails).length - 10}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ファイル一覧 */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-dads-md">
              <p className="text-dads-sm font-medium text-dads-text-primary mb-2">
                選択中: {selectedFiles.length > 0 ? `${selectedFiles.length}件` : '1件'}
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {(selectedFiles.length > 0 ? selectedFiles : (selectedFile ? [selectedFile] : [])).map((file, index) => {
                  const relativePath = (file as any).webkitRelativePath || file.name;
                  const fileIcon = file.type.startsWith('image/') ? '🖼️' :
                    file.type.startsWith('video/') ? '🎬' :
                      file.type.startsWith('audio/') ? '🎵' :
                        file.type.includes('pdf') ? '📄' :
                          file.type.includes('zip') ? '📦' : '📁';
                  return (
                    <div key={index} className="text-dads-xs text-dads-text-secondary flex items-start gap-2 px-2 py-1 hover:bg-blue-100 rounded">
                      <span className="flex-shrink-0">{fileIcon}</span>
                      <span className="break-all">{relativePath}</span>
                      <span className="flex-shrink-0 text-dads-text-tertiary ml-auto">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {(selectedFile || selectedFiles.length > 0) && (
          <div className="space-y-4 animate-fade-in">
            <input
              type="text"
              placeholder={selectedFiles.length > 1 ? '✏️ タイトル（オプション・全ファイル共通）' : '✏️ タイトル（オプション）'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-5 py-3 sm:py-4 border-2 border-dads-border rounded-dads-lg focus:outline-none focus:ring-2 focus:ring-dads-primary focus:border-dads-primary text-dads-text-primary transition-all"
              style={{ fontSize: '16px' }}
              aria-label="写真のタイトル"
            />
            <textarea
              placeholder={selectedFiles.length > 1 ? '📝 説明（オプション・全ファイル共通）' : '📝 説明（オプション）'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-5 py-3 sm:py-4 border-2 border-dads-border rounded-dads-lg focus:outline-none focus:ring-2 focus:ring-dads-primary focus:border-dads-primary min-h-[100px] resize-y text-dads-text-primary transition-all"
              style={{ fontSize: '16px' }}
              aria-label="写真の説明"
            />
            <input
              type="text"
              placeholder="🏷️ タグ（カンマ区切り、例: 旅行,風景）"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-5 py-3 sm:py-4 border-2 border-dads-border rounded-dads-lg focus:outline-none focus:ring-2 focus:ring-dads-primary focus:border-dads-primary text-dads-text-primary transition-all"
              style={{ fontSize: '16px' }}
              aria-label="写真のタグ"
            />
            {/* アップロード進捗バー */}
            {uploadProgress && (
              <div className="mb-4 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-dads-primary rounded-dads-lg">
                <div className="mb-3">
                  <div className="flex justify-between text-dads-base font-semibold text-dads-text-primary mb-2">
                    <span>📤 アップロード進捗</span>
                    <span>{uploadProgress.current} / {uploadProgress.total}件</span>
                  </div>
                  {/* プログレスバー */}
                  <div className="w-full bg-white rounded-full h-4 overflow-hidden shadow-inner">
                    <div
                      className="gradient-accent h-full rounded-full transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-dads-sm text-dads-text-secondary truncate">
                  現在のファイル: {uploadProgress.currentFile}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={() => handleUpload()}
                disabled={uploading}
                className="w-full sm:flex-1 btn-pill btn-pill-primary disabled:opacity-50 disabled:cursor-not-allowed button-ripple whitespace-nowrap"
                style={{ minHeight: '48px' }}
                aria-busy={uploading}
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    アップロード中...
                  </span>
                ) : (
                  <>
                    <span className="hidden sm:inline">🚀 Glacier Deep Archiveにアップロード {selectedFiles.length > 0 ? `(${selectedFiles.length}件)` : ''}</span>
                    <span className="sm:hidden">🚀 アップロード {selectedFiles.length > 0 ? `(${selectedFiles.length}件)` : ''}</span>
                  </>
                )}
              </button>
              {uploading ? (
                <button
                  onClick={handleCancelUpload}
                  className="w-full sm:w-auto btn-pill px-4 sm:px-6 py-3 border-2 border-red-500 text-red-600 hover:bg-red-50 font-semibold whitespace-nowrap"
                  aria-label="アップロードを中断"
                  style={{ borderRadius: 'var(--dads-radius-pill)', minHeight: '48px' }}
                >
                  ⏸️ 中断
                </button>
              ) : (
                <button
                  onClick={handleClearSelection}
                  className="w-full sm:w-auto btn-pill px-4 sm:px-6 py-3 bg-white border-2 border-dads-border text-dads-text-secondary hover:bg-dads-bg-secondary font-semibold whitespace-nowrap"
                  aria-label="選択をクリア"
                  style={{ borderRadius: 'var(--dads-radius-pill)', minHeight: '48px' }}
                >
                  ❌ キャンセル
                </button>
              )}
            </div>
            {/* リトライボタン */}
            {!uploading && failedFiles.length > 0 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-dads-md">
                <p className="text-dads-sm font-medium text-yellow-800 mb-2">
                  {failedFiles.length}件のファイルがアップロードに失敗しました
                </p>
                <button
                  onClick={handleRetryFailedUploads}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-dads-md hover:bg-yellow-700 transition-colors text-dads-sm font-medium"
                >
                  失敗したファイルを再試行（{failedFiles.length}件）
                </button>
              </div>
            )}
            <div
              className="mt-6 p-6 rounded-dads-lg flex gap-3 animate-fade-in"
              style={{
                background: 'linear-gradient(135deg, #3B9EF5 0%, #A78BFA 100%)',
                boxShadow: 'var(--dads-shadow-md)'
              }}
              role="note"
            >
              <div className="flex-shrink-0 text-white">
                <InfoIcon />
              </div>
              <div>
                <p className="text-dads-sm font-semibold text-white mb-2">
                  💡 超低コスト長期保管の仕組み
                </p>
                <p className="text-dads-sm text-white/90">
                  アップロード後、写真は<strong>無料</strong>でGlacier Deep Archiveに保管されます。
                  取り出しには12-48時間かかりますが、<strong>取り出し時のみ課金</strong>される仕組みです。
                </p>
              </div>
            </div>
          </div>
        )}
          </div>
        </DragDropZone>
      </ScrollReveal>

      {/* Photo List */}
      <div className="scroll-mt-24">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-dads-border">
          <div className="w-10 h-10 bg-dads-primary/10 rounded-dads-md flex items-center justify-center text-dads-primary">
            <PhotoIcon />
          </div>
          <div className="flex-1">
            <h2 className="text-dads-lg sm:text-dads-xl font-bold text-dads-text-primary">
              保管中の写真
            </h2>
            {!loading && photos.length > 0 && (
              <p className="text-dads-xs sm:text-dads-sm text-dads-text-secondary">
                {getFilteredAndSortedPhotos().length}件 / 全{photos.length}件
              </p>
            )}
          </div>
        </div>

        {/* フィルター・並び替えコントロール */}
        {!loading && photos.length > 0 && (
          <div className="nani-card p-4 sm:p-6 mb-6">
            {/* カテゴリータグフィルター（Nani風） */}
            <div className="mb-6">
              <label className="text-dads-sm font-semibold text-dads-text-primary mb-3 block">
                📂 ファイル種別
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => { setFilterType('all'); setCurrentPage(1); }}
                  className={`category-tag ${filterType === 'all' ? 'active' : ''}`}
                >
                  <span>📦</span>
                  すべて
                </button>
                <button
                  onClick={() => { setFilterType('image'); setCurrentPage(1); }}
                  className={`category-tag ${filterType === 'image' ? 'active' : ''}`}
                >
                  <span>🖼️</span>
                  画像
                </button>
                <button
                  onClick={() => { setFilterType('video'); setCurrentPage(1); }}
                  className={`category-tag ${filterType === 'video' ? 'active' : ''}`}
                >
                  <span>🎬</span>
                  動画
                </button>
                <button
                  onClick={() => { setFilterType('other'); setCurrentPage(1); }}
                  className={`category-tag ${filterType === 'other' ? 'active' : ''}`}
                >
                  <span>📄</span>
                  その他
                </button>
              </div>
            </div>

            {/* その他のフィルター */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* ファイル種別フィルター（旧版は削除） */}

              {/* タグフィルター */}
              <div>
                <label className="text-dads-xs font-medium text-dads-text-secondary mb-1 block">
                  タグ
                </label>
                <select
                  value={filterTag}
                  onChange={(e) => {
                    setFilterTag(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-dads-sm border border-dads-border rounded-dads-md focus:outline-none focus:ring-2 focus:ring-dads-primary"
                >
                  <option value="">すべて</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              {/* 日付範囲フィルター */}
              <div>
                <label className="text-dads-xs font-medium text-dads-text-secondary mb-1 block">
                  アップロード日（開始）
                </label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => {
                    setFilterDateFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-dads-sm border border-dads-border rounded-dads-md focus:outline-none focus:ring-2 focus:ring-dads-primary"
                />
              </div>

              <div>
                <label className="text-dads-xs font-medium text-dads-text-secondary mb-1 block">
                  アップロード日（終了）
                </label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => {
                    setFilterDateTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-dads-sm border border-dads-border rounded-dads-md focus:outline-none focus:ring-2 focus:ring-dads-primary"
                />
              </div>
            </div>

            {/* 並び替え・表示件数行 */}
            <div className="border-t border-dads-border pt-4">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  {/* 並び替え */}
                  <div className="flex-1 min-w-0">
                    <label className="text-dads-xs font-medium text-dads-text-secondary mb-1 block">
                      並び替え
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={sortBy}
                        onChange={(e) => {
                          setSortBy(e.target.value as any);
                          setCurrentPage(1);
                        }}
                        className="flex-1 min-w-0 px-3 py-2 text-dads-sm border border-dads-border rounded-dads-md focus:outline-none focus:ring-2 focus:ring-dads-primary"
                      >
                        <option value="uploadDate">アップロード日</option>
                        <option value="size">サイズ</option>
                      </select>
                      <button
                        onClick={() => {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          setCurrentPage(1);
                        }}
                        className="px-3 py-2 border border-dads-border rounded-dads-md hover:bg-dads-bg-secondary transition-colors flex-shrink-0"
                        title={sortOrder === 'asc' ? '昇順' : '降順'}
                      >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </button>
                    </div>
                  </div>

                  {/* 表示件数 */}
                  <div className="flex-shrink-0">
                    <label className="text-dads-xs font-medium text-dads-text-secondary mb-1 block">
                      表示件数
                    </label>
                    <div className="flex gap-1 sm:gap-2">
                      {[10, 20, 50, 100].map((count) => (
                        <button
                          key={count}
                          onClick={() => {
                            setItemsPerPage(count);
                            setCurrentPage(1);
                          }}
                          className={`px-2 sm:px-3 py-2 rounded-dads-sm text-dads-sm transition-colors flex-shrink-0 ${itemsPerPage === count
                            ? 'bg-dads-primary text-white'
                            : 'bg-dads-bg-secondary text-dads-text-secondary hover:bg-dads-bg-tertiary'
                            }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* フィルタークリアボタン */}
                {(filterType !== 'all' || filterTag || filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => {
                      setFilterType('all');
                      setFilterTag('');
                      setFilterDateFrom('');
                      setFilterDateTo('');
                      setCurrentPage(1);
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-dads-sm text-dads-primary hover:text-dads-primary-hover border border-dads-primary rounded-dads-md hover:bg-blue-50 transition-colors"
                  >
                    フィルターをクリア
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 一括操作ボタン */}
        {!loading && photos.length > 0 && selectedPhotoIds.length > 0 && (
          <div className="nani-card p-4 sm:p-6 mb-6 animate-fade-in" style={{ background: 'linear-gradient(135deg, #E0F0FF 0%, #F0E8FF 100%)' }}>
            <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <div className="text-dads-sm sm:text-dads-base font-semibold text-dads-text-primary flex-shrink-0">
                ✅ {selectedPhotoIds.length}件選択中
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
                <button
                  onClick={() => handleBulkRestore('Standard')}
                  className="btn-pill btn-pill-primary text-xs sm:text-dads-sm whitespace-nowrap px-2 sm:px-4"
                  style={{ minHeight: '36px' }}
                >
                  ⚡ 12h復元
                </button>
                <button
                  onClick={() => handleBulkRestore('Bulk')}
                  className="btn-pill btn-pill-secondary text-xs sm:text-dads-sm whitespace-nowrap px-2 sm:px-4"
                  style={{ minHeight: '36px' }}
                >
                  🐢 48h復元
                </button>
                <button
                  onClick={() => setSelectedPhotoIds([])}
                  className="btn-pill px-2 sm:px-4 py-2 bg-white border-2 border-dads-border text-dads-text-secondary hover:bg-dads-bg-secondary text-xs sm:text-dads-sm whitespace-nowrap"
                  style={{ borderRadius: 'var(--dads-radius-pill)', minHeight: '36px' }}
                >
                  ❌ 解除
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <EmptyState />
        ) : getFilteredAndSortedPhotos().length === 0 ? (
          <div className="bg-dads-bg-base rounded-dads-md shadow-dads-base p-12 text-center border border-dads-border">
            <p className="text-dads-text-secondary">フィルター条件に一致するファイルがありません</p>
          </div>
        ) : (
          <div className="nani-card overflow-hidden">
            {/* テーブル（デスクトップ） */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-dads-bg-secondary border-b border-dads-border">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={(() => {
                          const filteredPhotos = getFilteredAndSortedPhotos();
                          const currentPagePhotos = filteredPhotos.slice(
                            (currentPage - 1) * itemsPerPage,
                            currentPage * itemsPerPage
                          );
                          return currentPagePhotos.length > 0 && currentPagePhotos.every(p => selectedPhotoIds.includes(p.id));
                        })()}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                        aria-label="全選択"
                      />
                    </th>
                    <th className="w-[30%] px-4 py-3 text-left text-dads-xs font-semibold text-dads-text-secondary uppercase tracking-wider">
                      ファイル名
                    </th>
                    <th className="w-[12%] px-4 py-3 text-left text-dads-xs font-semibold text-dads-text-secondary uppercase tracking-wider whitespace-nowrap">
                      サイズ
                    </th>
                    <th className="w-[13%] px-4 py-3 text-left text-dads-xs font-semibold text-dads-text-secondary uppercase tracking-wider whitespace-nowrap">
                      アップロード日
                    </th>
                    <th className="w-[15%] px-4 py-3 text-left text-dads-xs font-semibold text-dads-text-secondary uppercase tracking-wider whitespace-nowrap">
                      ステータス
                    </th>
                    <th className="w-[18%] px-4 py-3 text-right text-dads-xs font-semibold text-dads-text-secondary uppercase tracking-wider whitespace-nowrap">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dads-border">
                  {getFilteredAndSortedPhotos().slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((photo) => (
                    <tr key={photo.id} className="hover:bg-dads-bg-secondary transition-colors">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedPhotoIds.includes(photo.id)}
                          onChange={() => handleToggleSelect(photo.id)}
                          className="w-4 h-4 cursor-pointer"
                          aria-label={`${photo.title || photo.originalName}を選択`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {/* サムネイルまたはファイルタイプアイコン */}
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded flex items-center justify-center flex-shrink-0 overflow-hidden border border-dads-border">
                            {photo.thumbnailUrl ? (
                              <img
                                src={photo.thumbnailUrl}
                                alt={photo.originalName}
                                className="w-full h-full object-cover"
                              />
                            ) : photo.originalName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? (
                              <div className="w-full h-full flex items-center justify-center text-dads-primary">
                                <PhotoIcon />
                              </div>
                            ) : photo.originalName.match(/\.(mp4|mov|avi|mkv|webm|flv|wmv)$/i) ? (
                              <svg className="w-5 h-5 text-dads-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            ) : photo.originalName.match(/\.(mp3|wav|flac|aac|ogg)$/i) ? (
                              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                            ) : photo.originalName.match(/\.pdf$/i) ? (
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            ) : photo.originalName.match(/\.(zip|rar|7z|tar|gz)$/i) ? (
                              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            ) : (
                              <FileIcon />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-dads-sm font-medium text-dads-text-primary break-words">
                              {photo.title || photo.originalName}
                            </div>
                            {photo.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {photo.tags.slice(0, 2).map((tag, idx) => (
                                  <span key={idx} className="text-dads-xs text-dads-text-secondary bg-dads-bg-tertiary px-2 py-0.5 rounded">
                                    {tag}
                                  </span>
                                ))}
                                {photo.tags.length > 2 && (
                                  <span className="text-dads-xs text-dads-text-secondary">+{photo.tags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-dads-sm text-dads-text-secondary whitespace-nowrap">
                        {formatBytes(photo.size)}
                      </td>
                      <td className="px-4 py-3 text-dads-sm text-dads-text-secondary whitespace-nowrap">
                        {new Date(photo.uploadedAt).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={photo.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          {photo.status === PhotoStatus.ARCHIVED && (
                            <>
                              <button
                                onClick={() => handleRestoreSingle(photo.id, 'Standard')}
                                className="px-3 py-1.5 text-dads-xs bg-dads-primary text-white rounded-dads-sm hover:bg-dads-primary-hover transition-colors"
                                title="Standard復元（12時間）"
                              >
                                12h
                              </button>
                              <button
                                onClick={() => handleRestoreSingle(photo.id, 'Bulk')}
                                className="px-3 py-1.5 text-dads-xs border border-dads-primary text-dads-primary rounded-dads-sm hover:bg-blue-50 transition-colors"
                                title="Bulk復元（48時間・低コスト）"
                              >
                                48h
                              </button>
                            </>
                          )}
                          {(photo.status === PhotoStatus.RESTORING || photo.status === PhotoStatus.RESTORE_REQUESTED) && (
                            <button
                              onClick={() => checkRestoreStatus(photo.id)}
                              className="px-3 py-1.5 text-dads-xs border border-dads-primary text-dads-primary rounded-dads-sm hover:bg-blue-50 transition-colors"
                            >
                              確認
                            </button>
                          )}
                          {photo.status === PhotoStatus.RESTORED && (
                            <button
                              onClick={() => handleDownload(photo.id)}
                              className="px-3 py-1.5 text-dads-xs bg-dads-primary text-white rounded-dads-sm hover:bg-dads-primary-hover transition-colors"
                            >
                              DL
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* カードリスト（モバイル） */}
            <div className="md:hidden divide-y divide-dads-border">
              {getFilteredAndSortedPhotos().slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((photo) => (
                <div key={photo.id} className="p-4 hover:bg-dads-bg-secondary transition-colors">
                  <div className="flex items-start gap-3">
                    {/* チェックボックス */}
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedPhotoIds.includes(photo.id)}
                        onChange={() => handleToggleSelect(photo.id)}
                        className="w-4 h-4 cursor-pointer"
                        aria-label={`${photo.title || photo.originalName}を選択`}
                      />
                    </div>
                    {/* サムネイルまたはファイルタイプアイコン */}
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded flex items-center justify-center flex-shrink-0 overflow-hidden border border-dads-border">
                      {photo.thumbnailUrl ? (
                        <img
                          src={photo.thumbnailUrl}
                          alt={photo.originalName}
                          className="w-full h-full object-cover"
                        />
                      ) : photo.originalName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? (
                        <div className="w-full h-full flex items-center justify-center text-dads-primary">
                          <PhotoIcon />
                        </div>
                      ) : photo.originalName.match(/\.(mp4|mov|avi|mkv|webm|flv|wmv)$/i) ? (
                        <svg className="w-6 h-6 text-dads-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      ) : photo.originalName.match(/\.(mp3|wav|flac|aac|ogg)$/i) ? (
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      ) : photo.originalName.match(/\.pdf$/i) ? (
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      ) : photo.originalName.match(/\.(zip|rar|7z|tar|gz)$/i) ? (
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      ) : (
                        <FileIcon />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-dads-sm font-medium text-dads-text-primary truncate mb-1">
                        {photo.title || photo.originalName}
                      </div>
                      <div className="flex items-center gap-2 text-dads-xs text-dads-text-secondary mb-2">
                        <span>{formatBytes(photo.size)}</span>
                        <span>•</span>
                        <span>{new Date(photo.uploadedAt).toLocaleDateString('ja-JP')}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={photo.status} />
                        {photo.status === PhotoStatus.ARCHIVED && (
                          <div className="flex gap-1 ml-auto">
                            <button
                              onClick={() => handleRestoreSingle(photo.id, 'Standard')}
                              className="px-2.5 py-1 text-dads-xs bg-dads-primary text-white rounded-dads-sm whitespace-nowrap"
                            >
                              12h
                            </button>
                            <button
                              onClick={() => handleRestoreSingle(photo.id, 'Bulk')}
                              className="px-2.5 py-1 text-dads-xs border border-dads-primary text-dads-primary rounded-dads-sm whitespace-nowrap"
                            >
                              48h
                            </button>
                          </div>
                        )}
                        {(photo.status === PhotoStatus.RESTORING || photo.status === PhotoStatus.RESTORE_REQUESTED) && (
                          <button
                            onClick={() => checkRestoreStatus(photo.id)}
                            className="px-2.5 py-1 text-dads-xs border border-dads-primary text-dads-primary rounded-dads-sm ml-auto whitespace-nowrap"
                          >
                            確認
                          </button>
                        )}
                        {photo.status === PhotoStatus.RESTORED && (
                          <button
                            onClick={() => handleDownload(photo.id)}
                            className="px-2.5 py-1 text-dads-xs bg-dads-primary text-white rounded-dads-sm ml-auto whitespace-nowrap"
                          >
                            DL
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ページネーション */}
            {(() => {
              const filteredPhotos = getFilteredAndSortedPhotos();
              const totalPages = Math.ceil(filteredPhotos.length / itemsPerPage);
              return filteredPhotos.length > itemsPerPage && (
                <div className="border-t border-dads-border px-4 py-3 flex items-center justify-between bg-dads-bg-secondary">
                  <div className="text-dads-sm text-dads-text-secondary">
                    {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredPhotos.length)} 件 / 全 {filteredPhotos.length} 件
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-dads-sm border border-dads-border rounded-dads-sm hover:bg-dads-bg-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      前へ
                    </button>
                    <span className="px-3 py-1.5 text-dads-sm text-dads-text-secondary">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-3 py-1.5 text-dads-sm border border-dads-border rounded-dads-sm hover:bg-dads-bg-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      次へ
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Confetti Animation */}
      <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
    </div>
  );
};
