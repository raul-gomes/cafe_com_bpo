import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { apiClient, authStorage } from '../api/client';

const SESSION_KEY = 'cafe_bpo_proposal';

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
  created_at?: string;
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
  login: (token: string, refreshToken?: string) => Promise<{ syncedProposalId?: string } | void>;
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

  const checkToken = useCallback(async () => {
    if (isChecking.current) return;
    isChecking.current = true;

    const token = authStorage.getToken();
    if (!token) {
      setIsLoading(false);
      isChecking.current = false;
      return;
    }

    const maxRetries = 2;
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
          authStorage.clearToken();
          setUser(null);
        } else if (status >= 500 && attempts < maxRetries) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          return tryFetch();
        } else {
          authStorage.clearToken();
          setUser(null);
        }
      } finally {
        setIsLoading(false);
        isChecking.current = false;
      }
    };

    await tryFetch();
  }, []);

  useEffect(() => {
    checkToken();
  }, [checkToken]);

  const login = async (token: string, refreshToken?: string) => {
    authStorage.setToken(token);
    if (refreshToken) {
      authStorage.setRefreshToken(refreshToken);
    }
    setSessionExpired(false);
    await checkToken();
    const proposalId = await syncPendingProposal();
    return { syncedProposalId: proposalId };
  };

  const logout = () => {
    authStorage.clearToken();
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

    const loginResp = await apiClient.post<{ access_token: string; refresh_token: string }>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return await login(loginResp.data.access_token, loginResp.data.refresh_token);
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
