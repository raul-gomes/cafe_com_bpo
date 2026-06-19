/// <reference types="vite/client" />
import axios from 'axios';

// In-memory token storage — not persisted to localStorage (XSS-safe)
let accessToken: string | null = null;

const REFRESH_ENDPOINT = '/auth/refresh';
const LOGOUT_ENDPOINT = '/auth/logout';

export const getApiUrl = () => import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies (refresh_token) with requests
});

// ── In-memory token management ──────────────────────────────────
export const tokenStorage = {
  getToken: (): string | null => accessToken,
  setToken: (token: string | null) => { accessToken = token; },
  clearToken: () => { accessToken = null; },
};

// ── Queue for concurrent refresh attempts ───────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown | null) => {
  failedQueue.forEach(promise => {
    if (error) promise.reject(error);
    else promise.resolve();
  });
  failedQueue = [];
};

// ── Interceptors ────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry refresh or logout endpoints
    if (
      originalRequest.url?.includes(REFRESH_ENDPOINT) ||
      originalRequest.url?.includes(LOGOUT_ENDPOINT)
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // The refresh_token cookie is sent automatically (httpOnly)
        const { data } = await axios.post(
          `${getApiUrl()}${REFRESH_ENDPOINT}`,
          {},
          { withCredentials: true },
        );
        tokenStorage.setToken(data.access_token);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        tokenStorage.clearToken();
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
  },
);
