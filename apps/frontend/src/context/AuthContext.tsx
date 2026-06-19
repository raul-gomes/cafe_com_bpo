import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { apiClient, tokenStorage } from '../api/client';
import axios from 'axios';

const SESSION_KEY = 'cafe_bpo_proposal';
const REFRESH_ENDPOINT = '/auth/refresh';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = payload.exp * 1000;
    const now = Date.now();
    return expiry - now < 60000;
  } catch {
    return true;
  }
}

export interface User {
  id: string;
  email: string;
  name?: string;
  company?: string;
  company_name?: string;
  company_segment?: string;
  company_description?: string;
  avatar_url?: string;
  role?: string;
  created_at?: string;
  // Profile fields (FASE 3)
  whatsapp?: string;
  company_razao_social?: string;
  company_nome_fantasia?: string;
  company_cnpj?: string;
  company_address?: string;
  company_professional_email?: string;
  company_commercial_phone?: string;
  company_logo_url?: string;
  company_color_code?: string;
  company_color_secondary?: string;
}

interface RegisterPayload {
  name: string;
  email: string;
  company?: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<{ syncedProposalId?: string } | void>;
  logout: () => void;
  register: (payload: RegisterPayload) => Promise<{ syncedProposalId?: string } | void>;
  setUser: (user: User | null) => void;
  sessionExpired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);
  const isChecking = useRef(false);

  // On mount, attempt to restore session via refresh_token cookie
  const checkToken = useCallback(async () => {
    if (isChecking.current) return;
    isChecking.current = true;

    try {
      const token = tokenStorage.getToken();
      if (token) {
        // We have a token in memory — validate it
        await fetchUser(token);
        return;
      }

      // No token in memory — try to refresh using httpOnly cookie
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const { data } = await axios.post(
        `${apiUrl}${REFRESH_ENDPOINT}`,
        {},
        { withCredentials: true },
      );
      tokenStorage.setToken(data.access_token);
      await fetchUser(data.access_token);
    } catch {
      // No valid refresh cookie — user is not logged in
      tokenStorage.clearToken();
      setUser(null);
    } finally {
      setIsLoading(false);
      isChecking.current = false;
    }
  }, []);

  const fetchUser = async (_token: string, retries = 2): Promise<void> => {
    let attempts = 0;

    const tryFetch = async (): Promise<void> => {
      try {
        const response = await apiClient.get<User>('/auth/me');
        setUser(response.data);
        setSessionExpired(false);
      } catch (error: any) {
        const status = error.response?.status;
        if (status === 401) {
          setSessionExpired(true);
          setTimeout(() => setSessionExpired(false), 5000);
          tokenStorage.clearToken();
          setUser(null);
        } else if (status && status >= 500 && attempts < retries) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          return tryFetch();
        } else {
          tokenStorage.clearToken();
          setUser(null);
        }
      }
    };

    await tryFetch();
  };

  useEffect(() => {
    checkToken();
  }, [checkToken]);

  const login = async (token: string) => {
    tokenStorage.setToken(token);
    setSessionExpired(false);
    await checkToken();
    const proposalId = await syncPendingProposal();
    return { syncedProposalId: proposalId };
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout', {}, { withCredentials: true });
    } catch {
      // Logout server call is best-effort
    }
    tokenStorage.clearToken();
    setUser(null);
    setSessionExpired(false);
  };

  const syncPendingProposal = async (): Promise<string | undefined> => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      if (saved.form && saved.pricing) {
        const response = await apiClient.post<{ id: string }>('/proposals/', {
          client_name: saved.clientName || 'Cliente',
          input_payload: saved.form,
          result_payload: saved.pricing,
        });
        
        sessionStorage.removeItem(SESSION_KEY);
        
        return response.data.id;
      }
    } catch (e) {
      console.error('Falha ao sincronizar proposta pendente:', e);
    }
    return undefined;
  };

  const register = async (payload: RegisterPayload) => {
    await apiClient.post('/auth/register', payload);
    
    const formData = new URLSearchParams();
    formData.append('username', payload.email);
    formData.append('password', payload.password);

    const loginResp = await apiClient.post<{ access_token: string }>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return await login(loginResp.data.access_token);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    register,
    setUser,
    sessionExpired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export { isTokenExpired };
