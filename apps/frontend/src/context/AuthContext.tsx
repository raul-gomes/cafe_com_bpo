import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient, authStorage } from '../api/client';

interface User {
  id: string;
  email: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
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

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
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
