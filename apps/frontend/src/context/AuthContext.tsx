import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient, authStorage } from '../api/client';

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
  login: (token: string) => Promise<void>;
  logout: () => void;
  register: (payload: RegisterPayload) => Promise<void>;
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
  };

  const logout = () => {
    authStorage.clearToken();
    setUser(null);
  };

  const register = async (payload: RegisterPayload): Promise<void> => {
    // Cria o usuário no backend e faz login imediato via /auth/login
    await apiClient.post('/auth/register', payload);
    const loginResp = await apiClient.post<{ access_token: string }>('/auth/login', null, {
      params: { username: payload.email, password: payload.password },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({ username: payload.email, password: payload.password }),
    });
    await login(loginResp.data.access_token);
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
