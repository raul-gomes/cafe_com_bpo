/// <reference types="vite/client" />
import axios from 'axios';

const LOCAL_STORAGE_KEY = '@cafe_bpo:token_v1';
const REFRESH_KEY = '@cafe_bpo:refresh_v1';

export const getApiUrl = () => import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: unknown | null) => {
  failedQueue.forEach(promise => {
    if (error) promise.reject(error);
    else promise.resolve();
  });
  failedQueue = [];
};

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (!refreshToken) {
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && !currentPath.startsWith('/auth/')) {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          localStorage.removeItem(REFRESH_KEY);
          window.location.href = `/login?session_expired=true&return_to=${encodeURIComponent(currentPath)}`;
        }
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${getApiUrl()}/auth/refresh`, { refresh_token: refreshToken });
        localStorage.setItem(LOCAL_STORAGE_KEY, data.access_token);
        localStorage.setItem(REFRESH_KEY, data.refresh_token);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(REFRESH_KEY);
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && !currentPath.startsWith('/auth/')) {
          window.location.href = `/login?session_expired=true&return_to=${encodeURIComponent(currentPath)}`;
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const authStorage = {
  getToken: () => localStorage.getItem(LOCAL_STORAGE_KEY),
  setToken: (token: string) => localStorage.setItem(LOCAL_STORAGE_KEY, token),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setRefreshToken: (token: string) => localStorage.setItem(REFRESH_KEY, token),
  clearToken: () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
