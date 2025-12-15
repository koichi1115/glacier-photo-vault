import { Photo, PhotoStatus } from '@glacier-photo-vault/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface User {
  userId: string;
  email: string;
  provider: string;
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
}

export const api = new ApiService();
