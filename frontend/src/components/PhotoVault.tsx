/**
 * PhotoVault Component
 * デジタル庁デザインシステム（DADS）準拠
 */

import React, { useState, useEffect } from 'react';
import { Photo, PhotoStatus } from '@glacier-photo-vault/shared';
import { DADSColors, DADSSpacing, DADSRadius, DADSShadow, getStatusColor } from '../design-system/tokens';
import '../design-system/global.css';

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

  const StatusBadge: React.FC<{ status: PhotoStatus }> = ({ status }) => (
    <span
      className="dads-status-badge"
      style={{
        backgroundColor: `${getStatusColor(status)}15`,
        color: getStatusColor(status),
      }}
      aria-label={`ステータス: ${getStatusLabel(status)}`}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(status),
        }}
        aria-hidden="true"
      />
      {getStatusLabel(status)}
    </span>
  );

  return (
    <div style={{ padding: DADSSpacing.lg, maxWidth: '1200px', margin: '0 auto' }}>
      <h1 className="dads-title-1" style={{ marginBottom: DADSSpacing.lg }}>
        写真保管庫
      </h1>

      {/* Stats */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: DADSSpacing.md,
            marginBottom: DADSSpacing.xl,
          }}
        >
          <div className="dads-card">
            <div className="dads-small" style={{ color: DADSColors.textSecondary, marginBottom: DADSSpacing.xxs }}>
              総写真数
            </div>
            <div className="dads-title-2">{stats.totalPhotos}</div>
          </div>
          <div className="dads-card">
            <div className="dads-small" style={{ color: DADSColors.textSecondary, marginBottom: DADSSpacing.xxs }}>
              総容量
            </div>
            <div className="dads-title-2">{formatBytes(stats.totalSize)}</div>
          </div>
          <div className="dads-card">
            <div className="dads-small" style={{ color: DADSColors.textSecondary, marginBottom: DADSSpacing.xxs }}>
              アーカイブ済み
            </div>
            <div className="dads-title-2">{stats.archived}</div>
          </div>
          <div className="dads-card">
            <div className="dads-small" style={{ color: DADSColors.textSecondary, marginBottom: DADSSpacing.xxs }}>
              復元可能
            </div>
            <div className="dads-title-2">{stats.restored}</div>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <div className="dads-card" style={{ marginBottom: DADSSpacing.xl }}>
        <h2 className="dads-title-3" style={{ marginBottom: DADSSpacing.md }}>
          📤 写真をアップロード
        </h2>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ marginBottom: DADSSpacing.sm, display: 'block' }}
          aria-label="写真ファイルを選択"
        />

        {selectedFile && (
          <div style={{ marginTop: DADSSpacing.md }}>
            <input
              type="text"
              className="dads-input"
              placeholder="タイトル（オプション）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ marginBottom: DADSSpacing.sm }}
              aria-label="写真のタイトル"
            />
            <textarea
              className="dads-input"
              placeholder="説明（オプション）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                marginBottom: DADSSpacing.sm,
                minHeight: '80px',
                resize: 'vertical',
              }}
              aria-label="写真の説明"
            />
            <input
              type="text"
              className="dads-input"
              placeholder="タグ（カンマ区切り、例: 旅行,風景）"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={{ marginBottom: DADSSpacing.md }}
              aria-label="写真のタグ"
            />
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="dads-button-primary"
              style={{ width: '100%' }}
              aria-busy={uploading}
            >
              {uploading ? 'アップロード中...' : 'Glacier Deep Archiveにアップロード'}
            </button>
            <div
              className="dads-caption"
              style={{
                marginTop: DADSSpacing.sm,
                padding: DADSSpacing.sm,
                backgroundColor: `${DADSColors.info}10`,
                borderRadius: DADSRadius.medium,
                borderLeft: `4px solid ${DADSColors.info}`,
              }}
              role="note"
            >
              <strong>ℹ️ ご注意：</strong>
              アップロード後、写真は超低コストのGlacier Deep Archiveに保管されます。
              取り出しには12-48時間かかります（取り出し時のみ課金）。
            </div>
          </div>
        )}
      </div>

      {/* Photo List */}
      <div>
        <h2 className="dads-title-3" style={{ marginBottom: DADSSpacing.md }}>
          🖼️ 保管中の写真
        </h2>

        {loading ? (
          <div className="dads-body" style={{ padding: DADSSpacing.xl, textAlign: 'center' }}>
            読み込み中...
          </div>
        ) : photos.length === 0 ? (
          <div
            className="dads-card"
            style={{
              padding: DADSSpacing.xxl,
              textAlign: 'center',
              color: DADSColors.textSecondary,
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: DADSSpacing.md }}>📸</div>
            <div className="dads-title-3" style={{ marginBottom: DADSSpacing.xs }}>
              写真がまだありません
            </div>
            <div className="dads-caption">上のフォームから写真をアップロードしてください</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: DADSSpacing.md }}>
            {photos.map((photo) => (
              <div key={photo.id} className="dads-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: DADSSpacing.sm }}>
                  <div style={{ flex: 1 }}>
                    <h3 className="dads-title-3" style={{ marginBottom: DADSSpacing.xxs }}>
                      {photo.title || photo.originalName}
                    </h3>
                    {photo.description && (
                      <p className="dads-caption" style={{ marginBottom: DADSSpacing.xs }}>
                        {photo.description}
                      </p>
                    )}
                    <div className="dads-small" style={{ color: DADSColors.textSecondary }}>
                      📄 {formatBytes(photo.size)} • 📅 {new Date(photo.uploadedAt).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  <StatusBadge status={photo.status} />
                </div>

                {photo.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: DADSSpacing.xs, marginBottom: DADSSpacing.sm }}>
                    {photo.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="dads-small"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: `${DADSSpacing.xxs} ${DADSSpacing.sm}`,
                          backgroundColor: `${DADSColors.primary}10`,
                          color: DADSColors.primary,
                          borderRadius: DADSRadius.large,
                        }}
                      >
                        🏷️ {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    borderTop: `1px solid ${DADSColors.divider}`,
                    paddingTop: DADSSpacing.md,
                    marginTop: DADSSpacing.sm,
                  }}
                >
                  <div style={{ display: 'flex', gap: DADSSpacing.sm, flexWrap: 'wrap' }}>
                    {photo.status === PhotoStatus.ARCHIVED && (
                      <>
                        <button
                          onClick={() => handleRestore(photo.id, 'Standard')}
                          className="dads-button-primary"
                          style={{ flex: 1, minWidth: '150px' }}
                          aria-label="Standard復元（12時間）"
                        >
                          復元 (12時間)
                        </button>
                        <button
                          onClick={() => handleRestore(photo.id, 'Bulk')}
                          className="dads-button-secondary"
                          style={{ flex: 1, minWidth: '180px' }}
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
                        className="dads-button-secondary"
                        style={{ flex: 1 }}
                        aria-label="復元状態を確認"
                      >
                        状態確認
                      </button>
                    )}
                    {photo.status === PhotoStatus.RESTORED && (
                      <>
                        <button
                          onClick={() => handleDownload(photo.id)}
                          className="dads-button-primary"
                          style={{ flex: 1 }}
                          aria-label="写真をダウンロード"
                        >
                          ダウンロード
                        </button>
                        {photo.restoredUntil && (
                          <span
                            className="dads-small"
                            style={{
                              color: DADSColors.warning,
                              alignSelf: 'center',
                              whiteSpace: 'nowrap',
                            }}
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
