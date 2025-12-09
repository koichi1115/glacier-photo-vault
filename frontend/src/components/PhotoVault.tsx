/**
 * PhotoVault Component
 * デジタル庁デザインシステム（DADS）準拠 - Tailwind CSS版
 */

import React, { useState, useEffect } from 'react';
import { Photo, PhotoStatus } from '@glacier-photo-vault/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface PhotoVaultProps {
  userId: string;
}

export const PhotoVault: React.FC<PhotoVaultProps> = ({ userId }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
    loadStats();
  }, [userId]);

  const loadPhotos = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/user/${userId}`);
      const data = await response.json();
      if (data.success) {
        setPhotos(data.photos);
      }
    } catch (error) {
      console.error('Failed to load photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/user/${userId}/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('photo', selectedFile);
    formData.append('userId', userId);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(t => t)));

    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        alert('写真がGlacier Deep Archiveにアップロードされました！');
        setSelectedFile(null);
        setTitle('');
        setDescription('');
        setTags('');
        loadPhotos();
        loadStats();
      } else {
        alert('アップロードに失敗しました: ' + data.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleRestore = async (photoId: string, tier: 'Standard' | 'Bulk') => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/${photoId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`復元リクエストを送信しました。推定完了時間: ${data.estimatedHours}時間`);
        loadPhotos();
      }
    } catch (error) {
      console.error('Restore error:', error);
      alert('復元リクエストに失敗しました');
    }
  };

  const checkRestoreStatus = async (photoId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/${photoId}/restore/status`);
      const data = await response.json();
      if (data.success) {
        alert(`復元状態: ${data.status}`);
        loadPhotos();
      }
    } catch (error) {
      console.error('Status check error:', error);
    }
  };

  const handleDownload = async (photoId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/${photoId}/download`);
      const data = await response.json();
      if (data.success) {
        window.open(data.downloadUrl, '_blank');
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('ダウンロードURLの取得に失敗しました');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
      [PhotoStatus.UPLOADING]: 'bg-blue-100 text-blue-700 border-blue-200',
      [PhotoStatus.ARCHIVED]: 'bg-gray-100 text-gray-700 border-gray-200',
      [PhotoStatus.RESTORE_REQUESTED]: 'bg-orange-100 text-orange-700 border-orange-200',
      [PhotoStatus.RESTORING]: 'bg-orange-100 text-orange-700 border-orange-200',
      [PhotoStatus.RESTORED]: 'bg-green-100 text-green-700 border-green-200',
      [PhotoStatus.FAILED]: 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
        写真保管庫
      </h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">総写真数</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalPhotos}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">総容量</div>
            <div className="text-2xl font-bold text-gray-900">{formatBytes(stats.totalSize)}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">アーカイブ済み</div>
            <div className="text-2xl font-bold text-gray-900">{stats.archived}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">復元可能</div>
            <div className="text-2xl font-bold text-gray-900">{stats.restored}</div>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8 border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>📤</span> 写真をアップロード
        </h2>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2 mb-4"
          aria-label="写真ファイルを選択"
        />

        {selectedFile && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="タイトル（オプション）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="写真のタイトル"
            />
            <textarea
              placeholder="説明（オプション）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px] resize-y"
              aria-label="写真の説明"
            />
            <input
              type="text"
              placeholder="タグ（カンマ区切り、例: 旅行,風景）"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="写真のタグ"
            />
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
              aria-busy={uploading}
            >
              {uploading ? 'アップロード中...' : 'Glacier Deep Archiveにアップロード'}
            </button>
            <div
              className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded"
              role="note"
            >
              <p className="text-sm text-blue-900">
                <strong className="font-semibold">ℹ️ ご注意：</strong>
                アップロード後、写真は超低コストのGlacier Deep Archiveに保管されます。
                取り出しには12-48時間かかります（取り出し時のみ課金）。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Photo List */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>🖼️</span> 保管中の写真
        </h2>

        {loading ? (
          <div className="text-center py-12 text-gray-600">
            読み込み中...
          </div>
        ) : photos.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
            <div className="text-6xl mb-4">📸</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              写真がまだありません
            </h3>
            <p className="text-gray-600">上のフォームから写真をアップロードしてください</p>
          </div>
        ) : (
          <div className="space-y-4">
            {photos.map((photo) => (
              <div key={photo.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {photo.title || photo.originalName}
                    </h3>
                    {photo.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {photo.description}
                      </p>
                    )}
                    <div className="text-sm text-gray-500 flex items-center gap-3">
                      <span>📄 {formatBytes(photo.size)}</span>
                      <span>•</span>
                      <span>📅 {new Date(photo.uploadedAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                  <StatusBadge status={photo.status} />
                </div>

                {photo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {photo.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                      >
                        <span>🏷️</span> {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex flex-wrap gap-3">
                    {photo.status === PhotoStatus.ARCHIVED && (
                      <>
                        <button
                          onClick={() => handleRestore(photo.id, 'Standard')}
                          className="flex-1 min-w-[150px] bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                          aria-label="Standard復元（12時間）"
                        >
                          復元 (12時間)
                        </button>
                        <button
                          onClick={() => handleRestore(photo.id, 'Bulk')}
                          className="flex-1 min-w-[180px] bg-white text-blue-600 font-semibold py-2 px-4 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                          aria-label="Bulk復元（48時間・低コスト）"
                        >
                          復元 (48時間・低コスト)
                        </button>
                      </>
                    )}
                    {(photo.status === PhotoStatus.RESTORING ||
                      photo.status === PhotoStatus.RESTORE_REQUESTED) && (
                      <button
                        onClick={() => checkRestoreStatus(photo.id)}
                        className="flex-1 bg-white text-blue-600 font-semibold py-2 px-4 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        aria-label="復元状態を確認"
                      >
                        状態確認
                      </button>
                    )}
                    {photo.status === PhotoStatus.RESTORED && (
                      <>
                        <button
                          onClick={() => handleDownload(photo.id)}
                          className="flex-1 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                          aria-label="写真をダウンロード"
                        >
                          ダウンロード
                        </button>
                        {photo.restoredUntil && (
                          <span
                            className="flex items-center px-4 py-2 text-sm text-orange-700 font-medium whitespace-nowrap"
                            aria-label={`利用期限: ${new Date(photo.restoredUntil).toLocaleDateString('ja-JP')}`}
                          >
                            ⏰ {new Date(photo.restoredUntil).toLocaleDateString('ja-JP')}まで
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
