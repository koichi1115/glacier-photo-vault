import type { Photo } from '@glacier-photo-vault/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface User {
  userId: string;
  email: string;
  provider: string;
  displayName?: string;
  profilePhoto?: string;
}

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
      }
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getUser(): User | null {
    return this.user;
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  setUser(user: User) {
    this.user = user;
    localStorage.setItem('user', JSON.stringify(user));
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/';
  }

  async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.accessToken}`,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token might be expired, try to refresh
      try {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry original request with new token
          const newHeaders = {
            ...options.headers,
            'Authorization': `Bearer ${this.accessToken}`,
          };
          return fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: newHeaders,
          });
        } else {
          this.logout();
          throw new Error('Session expired');
        }
      } catch (error) {
        this.logout();
        throw error;
      }
    }

    return response;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.accessToken;
        localStorage.setItem('accessToken', data.accessToken);
        // If a new refresh token is returned, update it too
        if (data.refreshToken) {
          this.refreshToken = data.refreshToken;
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to refresh token', error);
    }
    return false;
  }

  /**
   * OAuth認可コードをトークンに交換する（コールバックURLにトークンを載せない方式）
   */
  async exchangeCode(code: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      throw new Error('Failed to exchange authorization code');
    }
    const data = await response.json();
    this.setTokens(data.accessToken, data.refreshToken);
  }

  // API Methods
  async getMe(): Promise<User> {
    const response = await this.fetch('/api/auth/me');
    if (!response.ok) throw new Error('Failed to fetch user info');
    const data = await response.json();
    this.setUser(data.user);
    return data.user;
  }

  async getUserPhotos(userId: string): Promise<Photo[]> {
    const response = await this.fetch(`/api/photos/user/${userId}`);
    const data = await response.json();
    return data.photos;
  }

  async getUserStats(userId: string): Promise<any> {
    const response = await this.fetch(`/api/photos/user/${userId}/stats`);
    const data = await response.json();
    return data.stats;
  }

  async getUserTags(userId: string): Promise<string[]> {
    const response = await this.fetch(`/api/photos/user/${userId}/tags`);
    const data = await response.json();
    return data.tags;
  }

  async getMonthlyStats(userId: string): Promise<any[]> {
    const response = await this.fetch(`/api/photos/user/${userId}/monthly-stats`);
    const data = await response.json();
    return data.monthlyStats;
  }

  async uploadPhoto(formData: FormData): Promise<any> {
    const response = await this.fetch('/api/photos/upload', {
      method: 'POST',
      body: formData,
      // Content-Type is set automatically for FormData
    });
    return response.json();
  }

  /**
   * プリサインドURLによるS3直接アップロード（100MB超・大容量ファイル対応）
   * init → S3へ直接PUT（マルチパート対応） → complete の3段階。
   */
  async uploadFileDirect(
    file: File,
    meta: {
      relativePath?: string;
      title?: string;
      description?: string;
      tags?: string[];
      thumbnail?: string;
    }
  ): Promise<any> {
    const mimeType = file.type || 'application/octet-stream';

    const initRes = await this.fetch('/api/uploads/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        relativePath: meta.relativePath,
        size: file.size,
        mimeType,
      }),
    });
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new Error(err.message || 'アップロードの初期化に失敗しました');
    }
    const init = await initRes.json();

    let parts: Array<{ partNumber: number; etag: string }> | undefined;

    if (init.uploadType === 'single') {
      const putRes = await fetch(init.url, {
        method: 'PUT',
        headers: init.requiredHeaders,
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`ストレージへのアップロードに失敗しました (${putRes.status})`);
      }
    } else {
      parts = [];
      try {
        for (const { partNumber, url } of init.partUrls) {
          const start = (partNumber - 1) * init.partSize;
          const chunk = file.slice(start, Math.min(start + init.partSize, file.size));
          const putRes = await fetch(url, { method: 'PUT', body: chunk });
          if (!putRes.ok) {
            throw new Error(`パート${partNumber}のアップロードに失敗しました (${putRes.status})`);
          }
          // 注意: ETagの取得にはS3バケットのCORS設定で ExposeHeaders: ETag が必要
          const etag = putRes.headers.get('ETag');
          if (!etag) {
            throw new Error('ETagを取得できません（S3バケットのCORS設定を確認してください）');
          }
          parts.push({ partNumber, etag: etag.replace(/"/g, '') });
        }
      } catch (e) {
        // 失敗時は未完了パートを掃除する
        await this.fetch('/api/uploads/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: init.key, uploadId: init.uploadId }),
        }).catch(() => undefined);
        throw e;
      }
    }

    const completeRes = await this.fetch('/api/uploads/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: init.key,
        uploadId: init.uploadType === 'multipart' ? init.uploadId : undefined,
        parts,
        fileName: file.name,
        mimeType,
        title: meta.title,
        description: meta.description,
        tags: meta.tags,
        thumbnail: meta.thumbnail,
      }),
    });
    if (!completeRes.ok) {
      const err = await completeRes.json().catch(() => ({}));
      throw new Error(err.message || 'アップロードの完了処理に失敗しました');
    }
    return completeRes.json();
  }

  async requestRestore(photoId: string, tier: 'Standard' | 'Bulk'): Promise<any> {
    const response = await this.fetch(`/api/photos/${photoId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    });
    return response.json();
  }

  async checkRestoreStatus(photoId: string): Promise<any> {
    const response = await this.fetch(`/api/photos/${photoId}/restore/status`);
    return response.json();
  }

  async getDownloadUrl(photoId: string): Promise<any> {
    const response = await this.fetch(`/api/photos/${photoId}/download`);
    return response.json();
  }

  async checkDuplicates(files: Array<{ name: string; size: number }>): Promise<{
    success: boolean;
    duplicates: Array<{ name: string; size: number; existingPhotoId: string }>;
  }> {
    const response = await this.fetch('/api/photos/check-duplicates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files }),
    });
    return response.json();
  }

  // Billing API Methods
  async createSetupIntent(): Promise<{
    success: boolean;
    clientSecret: string;
    customerId: string;
  }> {
    const response = await this.fetch('/api/billing/setup-intent', {
      method: 'POST',
    });
    return response.json();
  }

  async getTiers(): Promise<{
    success: boolean;
    tiers: Array<{
      id: string;
      name: string;
      priceJpy: number;
      storageLimitBytes: number;
    }>;
  }> {
    // 認証不要の公開エンドポイント
    const response = await fetch(`${API_BASE_URL}/api/billing/tiers`);
    return response.json();
  }

  async confirmCard(paymentMethodId: string, couponCode?: string, tier?: string): Promise<{
    success: boolean;
    subscription: {
      status: string;
      tier: string | null;
      storageLimitBytes: number | null;
      trialEnd: number;
    };
  }> {
    const response = await this.fetch('/api/billing/confirm-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethodId, couponCode, tier }),
    });
    return response.json();
  }

  async getSubscription(): Promise<{
    success: boolean;
    subscription: {
      status: string;
      trialStart: number | null;
      trialEnd: number | null;
      currentPeriodStart: number | null;
      currentPeriodEnd: number | null;
      canceledAt: number | null;
    } | null;
    hasSubscription: boolean;
    isValid: boolean;
    trialDaysRemaining?: number;
  }> {
    const response = await this.fetch('/api/billing/subscription');
    return response.json();
  }

  async validateCoupon(code: string): Promise<{
    success: boolean;
    valid: boolean;
    message?: string;
    coupon?: {
      code: string;
      discountPercent: number | null;
      discountAmount: number | null;
    };
  }> {
    const response = await this.fetch('/api/billing/coupon/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return response.json();
  }

  async cancelSubscription(): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await this.fetch('/api/billing/cancel', {
      method: 'POST',
    });
    return response.json();
  }
}

export const api = new ApiService();
