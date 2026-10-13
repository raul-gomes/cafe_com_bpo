import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginPathFor } from '../../lib/returnTo';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--ds-bg)',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--ds-border)',
          borderTopColor: 'var(--ds-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Keeps the destination so the login brings the person back (AUD-039).
    return <Navigate to={loginPathFor(location)} replace />;
  }

  return <Outlet />;
};
