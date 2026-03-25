/**
 * API Client Service
 * Handles all HTTP requests to the backend
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import config from '@/lib/config';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: config.apiUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (reqConfig: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(config.tokenKey);
      if (token && reqConfig.headers) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
      }
    }
    return reqConfig;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem(config.refreshTokenKey);
        if (refreshToken) {
          const response = await axios.post(`${config.apiUrl}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data.data.tokens;
          localStorage.setItem(config.tokenKey, accessToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }

          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem(config.tokenKey);
          localStorage.removeItem(config.refreshTokenKey);
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// ==================== AUTH API ====================

export const authApi = {
  register: async (data: {
    email: string;
    password: string;
    username: string;
    first_name?: string;
    last_name?: string;
  }) => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    const { tokens } = response.data.data;

    localStorage.setItem(config.tokenKey, tokens.accessToken);
    localStorage.setItem(config.refreshTokenKey, tokens.refreshToken);

    return response.data;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem(config.refreshTokenKey);
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } finally {
      localStorage.removeItem(config.tokenKey);
      localStorage.removeItem(config.refreshTokenKey);
    }
  },

  verifyEmail: async (token: string) => {
    const response = await apiClient.post('/auth/verify-email', { token });
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, password: string) => {
    const response = await apiClient.post('/auth/reset-password', { token, password });
    return response.data;
  },

  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};

// ==================== COMPONENTS API ====================

export const componentsApi = {
  getAll: async (params?: {
    type?: string;
    manufacturer?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get('/components', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/components/${id}`);
    return response.data;
  },

  getByType: async (type: string) => {
    const response = await apiClient.get(`/components/type/${type}`);
    return response.data;
  },

  getTypes: async () => {
    const response = await apiClient.get('/components/types');
    return response.data;
  },

  getManufacturers: async () => {
    const response = await apiClient.get('/components/manufacturers');
    return response.data;
  },
};

// ==================== FRAMES API ====================

export const framesApi = {
  getAll: async (params?: { frame_type?: string; page?: number; limit?: number }) => {
    const response = await apiClient.get('/frames', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/frames/${id}`);
    return response.data;
  },

  getByType: async (type: string) => {
    const response = await apiClient.get(`/frames/type/${type}`);
    return response.data;
  },
};

// ==================== DRONES API ====================

export const dronesApi = {
  getMine: async (params?: { page?: number; limit?: number }) => {
    const response = await apiClient.get('/drones', { params });
    return response.data;
  },

  getPublic: async (params?: { search?: string; tags?: string; page?: number; limit?: number }) => {
    const response = await apiClient.get('/drones/public', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/drones/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    description?: string;
    frame_id?: string;
    configuration: any;
    is_public?: boolean;
    tags?: string[];
  }) => {
    const response = await apiClient.post('/drones', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await apiClient.put(`/drones/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/drones/${id}`);
    return response.data;
  },

  clone: async (id: string, name?: string) => {
    const response = await apiClient.post(`/drones/${id}/clone`, { name });
    return response.data;
  },

  recalculateMetrics: async (id: string) => {
    const response = await apiClient.post(`/drones/${id}/recalculate`);
    return response.data;
  },
};

// ==================== SIMULATIONS API ====================

export const simulationsApi = {
  getMine: async (params?: { page?: number; limit?: number }) => {
    const response = await apiClient.get('/simulations', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/simulations/${id}`);
    return response.data;
  },

  getResults: async (id: string) => {
    const response = await apiClient.get(`/simulations/${id}/results`);
    return response.data;
  },

  create: async (data: {
    drone_id: string;
    name?: string;
    simulation_type?: string;
    environment_config?: any;
    settings?: any;
  }) => {
    const response = await apiClient.post('/simulations', data);
    return response.data;
  },

  start: async (id: string) => {
    const response = await apiClient.post(`/simulations/${id}/start`);
    return response.data;
  },

  cancel: async (id: string) => {
    const response = await apiClient.post(`/simulations/${id}/cancel`);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/simulations/${id}`);
    return response.data;
  },

  quickAnalysis: async (configuration: any) => {
    const response = await apiClient.post('/simulations/quick-analysis', { configuration });
    return response.data;
  },

  validate: async (configuration: any) => {
    const response = await apiClient.post('/simulations/validate', { configuration });
    return response.data;
  },

  checkPhysicsHealth: async () => {
    const response = await apiClient.get('/simulations/physics/health');
    return response.data;
  },
};

export default apiClient;
