import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { loginSchema, LoginFormData } from '../../schemas/auth';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import logo from '../../assets/logo.png';

export const LoginForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });
  const [genericError, setGenericError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (data: LoginFormData) => {
    setGenericError(null);
    try {
      const formData = new URLSearchParams();
      formData.append('username', data.email);
      formData.append('password', data.password);
      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const res = await login(response.data.access_token);
      
      if (res && (res as any).syncedProposalId) {
        navigate(`/painel/orcamento/${(res as any).syncedProposalId}`);
      } else {
        navigate('/painel');
      }
    } catch (error: any) {
      setGenericError(error.response?.data?.detail || 'Credenciais inválidas. Tente novamente.');
    }
  };

  const handleOAuthLogin = async (provider: string) => {
    try {
      const { data } = await apiClient.get<{ url: string }>(`/auth/${provider}/login`);
      window.location.href = data.url;
    } catch {
      setGenericError(`Falha ao iniciar autenticação com ${provider}.`);
    }
  };

  return (
    <div style={{
      width: '100%', maxWidth: '420px', margin: '0 auto',
      background: 'var(--ds-surface)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--radius-lg)',
      padding: '36px',
    }}>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <img src={logo} alt="Café com BPO" style={{ height: '40px', margin: '0 auto 16px' }} />
        <h2 style={{ font: 'var(--text-h2)', color: 'var(--ds-text)', marginBottom: '4px' }}>
          Bem-vindo
        </h2>
        <p style={{ font: 'var(--text-body)', color: 'var(--ds-text-muted)' }}>
          Entre com sua conta BPO
        </p>
      </div>

        {sessionStorage.getItem('cafe_bpo_proposal') && (
          <div className="ds-alert ds-alert-warning" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <strong>Quase lá!</strong> Faça login ou cadastre-se para salvar sua simulação e baixar sua proposta em PDF.
          </div>
        )}

      {genericError && (
        <div className="ds-alert ds-alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{genericError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="ds-input-group">
          <label className="ds-label" htmlFor="email">E-mail</label>
          <div style={{ position: 'relative' }}>
            <Mail size={15} style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ds-text-subtle)', pointerEvents: 'none'
            }} />
            <input
              id="email" type="email"
              {...register('email')}
              className={`ds-input ${errors.email ? 'error' : ''}`}
              style={{ paddingLeft: '36px' }}
              placeholder="seu@email.com"
            />
          </div>
          {errors.email && <p className="ds-error-text">{errors.email.message}</p>}
        </div>

        <div className="ds-input-group">
          <label className="ds-label" htmlFor="password">Senha</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ds-text-subtle)', pointerEvents: 'none'
            }} />
            <input
              id="password" type="password"
              {...register('password')}
              className={`ds-input ${errors.password ? 'error' : ''}`}
              style={{ paddingLeft: '36px' }}
              placeholder="••••••••"
            />
          </div>
          {errors.password && <p className="ds-error-text">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="ds-btn ds-btn-primary"
          style={{ width: '100%', marginTop: '4px', padding: '12px', fontSize: '14px', borderRadius: 'var(--radius-md)' }}
        >
          {isSubmitting
            ? 'Entrando...'
            : <><span>Entrar</span><LogIn size={15} /></>
          }
        </button>
      </form>

      {/* Divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        margin: '24px 0', color: 'var(--ds-text-subtle)', fontSize: '12px'
      }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        <span>ou continue com</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* OAuth */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button
          type="button"
          onClick={() => handleOAuthLogin('google')}
          className="ds-btn ds-btn-ghost"
          style={{ padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '13px' }}
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="" style={{ width: '16px', height: '16px' }} />
          Google
        </button>
        <button
          type="button"
          onClick={() => handleOAuthLogin('microsoft')}
          className="ds-btn ds-btn-ghost"
          style={{ padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '13px' }}
        >
          <svg width="16" height="16" viewBox="0 0 21 21">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          Microsoft
        </button>
      </div>
    </div>
  );
};
