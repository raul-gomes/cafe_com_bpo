import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/queryClient';
import { AuthProvider } from '../context/AuthContext';
import { ConfirmProvider } from '../components/ui/ConfirmDialog';

export const AppProviders: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
