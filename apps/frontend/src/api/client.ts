/// <reference types="vite/client" />
import axios from 'axios';

// TODO: Ponto de melhoria - Transição do armazenamento de sessão para Cookies HttpOnly
// Atualmente o JWT reside no localStorage para facilitar os testes da Fase 6,
// mas em ambiente de produção ideal, usaremos cookies secure para evitar vetores de XSS.

const LOCAL_STORAGE_KEY = '@cafe_bpo:token_v1';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export const authStorage = {
  getToken: () => localStorage.getItem(LOCAL_STORAGE_KEY),
  setToken: (token: string) => localStorage.setItem(LOCAL_STORAGE_KEY, token),
  clearToken: () => localStorage.removeItem(LOCAL_STORAGE_KEY),
};
