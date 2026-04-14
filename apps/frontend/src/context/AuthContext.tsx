import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient, authStorage } from '../api/client';

const SESSION_KEY = 'cafe_bpo_proposal';

interface User {
  id: string;
  email: string;
  name?: string;
  company?: string;
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
  login: (token: string) => Promise<{ syncedProposalId?: string } | void>;
  logout: () => void;
  register: (payload: RegisterPayload) => Promise<{ syncedProposalId?: string } | void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // isLoading remains true until we check if there's a stored token
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate the Token via Backend Me Route
  const checkToken = async () => {
    const token = authStorage.getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await apiClient.get<User>('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Invalid or expired token', error);
      authStorage.clearToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkToken();
  }, []);

  const login = async (token: string) => {
    authStorage.setToken(token);
    await checkToken(); // Re-check the token sets the user
    const proposalId = await syncPendingProposal();
    return { syncedProposalId: proposalId };
  };

  const logout = () => {
    authStorage.clearToken();
    setUser(null);
  };

  /**
   * Verifica se há uma proposta no sessionStorage e a salva no banco.
   */
  const syncPendingProposal = async (): Promise<string | undefined> => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      if (saved.form && saved.pricing) {
        const response = await apiClient.post<{ id: string }>('/api/proposals/', {
          client_name: saved.clientName || 'Cliente',
          input_payload: saved.form,
          result_payload: saved.pricing,
        });
        
        // Limpa o sessionStorage após salvar com sucesso
        sessionStorage.removeItem(SESSION_KEY);
        
        return response.data.id;
      }
    } catch (e) {
      console.error('Falha ao sincronizar proposta pendente:', e);
    }
    return undefined;
  };

  const register = async (payload: RegisterPayload) => {
    // Cria o usuário no backend e faz login imediato via /auth/login
    await apiClient.post('/auth/register', payload);
    
    const formData = new URLSearchParams();
    formData.append('username', payload.email);
    formData.append('password', payload.password);

    const loginResp = await apiClient.post<{ access_token: string }>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // O login já chama o syncPendingProposal internamente
    return await login(loginResp.data.access_token);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
