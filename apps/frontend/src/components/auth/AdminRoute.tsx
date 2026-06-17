import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const AdminRoute: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--ds-border)',
            borderTopColor: 'var(--ds-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '16px',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--ds-bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
          }}
        >
          🔒
        </div>
        <h2 style={{ margin: 0, color: 'var(--ds-text)' }}>
          Acesso Restrito
        </h2>
        <p
          style={{
            margin: 0,
            color: 'var(--ds-text-secondary)',
            maxWidth: '400px',
          }}
        >
          Esta página é exclusiva para administradores do sistema.
          Se você precisa de acesso, entre em contato com o suporte.
        </p>
        <a
          href="/painel"
          style={{
            color: 'var(--ds-primary)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          ← Voltar ao painel
        </a>
      </div>
    );
  }

  return <Outlet />;
};
