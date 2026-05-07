import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import logo from '../assets/logo.png';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const ResetPasswordPage: React.FC = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const token = searchParams.get('token');

  const onSubmit = async (data: ResetPasswordFormData) => {
    setServerError(null);
    if (!token) {
      setServerError('Token de redefinição ausente.');
      return;
    }
    try {
      await apiClient.post('/auth/reset-password', {
        token,
        new_password: data.password,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (error: any) {
      setServerError(error.response?.data?.detail || 'Erro ao redefinir senha. Tente novamente.');
    }
  };

  if (!token) {
    return (
      <div style={{
        width: '100%', maxWidth: '420px', margin: '0 auto',
        background: 'var(--ds-surface)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-lg)',
        padding: '36px',
        textAlign: 'center',
      }}>
        <p style={{ color: 'var(--ds-text-muted)' }}>Token de redefinição ausente. Solicite um novo link.</p>
        <a href="/esqueci-minha-senha" style={{ color: 'var(--ds-primary)', textDecoration: 'none', fontSize: '14px' }}>
          Solicitar novo link
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{
        width: '100%', maxWidth: '420px', margin: '0 auto',
        background: 'var(--ds-surface)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-lg)',
        padding: '36px',
        textAlign: 'center',
      }}>
        <img src={logo} alt="Café com BPO" style={{ height: '40px', margin: '0 auto 16px' }} />
        <CheckCircle size={48} style={{ color: 'var(--ds-success)', margin: '0 auto 16px' }} />
        <h2 style={{ font: 'var(--text-h2)', color: 'var(--ds-text)', marginBottom: '8px' }}>
          Senha redefinida!
        </h2>
        <p style={{ font: 'var(--text-body)', color: 'var(--ds-text-muted)' }}>
          Redirecionando para o login...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', maxWidth: '420px', margin: '0 auto',
      background: 'var(--ds-surface)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--radius-lg)',
      padding: '36px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <img src={logo} alt="Café com BPO" style={{ height: '40px', margin: '0 auto 16px' }} />
        <h2 style={{ font: 'var(--text-h2)', color: 'var(--ds-text)', marginBottom: '4px' }}>
          Nova senha
        </h2>
        <p style={{ font: 'var(--text-body)', color: 'var(--ds-text-muted)' }}>
          Defina sua nova senha
        </p>
      </div>

      {serverError && (
        <div className="ds-alert ds-alert-error" style={{ marginBottom: '20px' }}>
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="ds-input-group">
          <label className="ds-label" htmlFor="password">Nova senha</label>
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
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          {errors.password && <p className="ds-error-text">{errors.password.message}</p>}
        </div>

        <div className="ds-input-group">
          <label className="ds-label" htmlFor="confirmPassword">Confirmar senha</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ds-text-subtle)', pointerEvents: 'none'
            }} />
            <input
              id="confirmPassword" type="password"
              {...register('confirmPassword')}
              className={`ds-input ${errors.confirmPassword ? 'error' : ''}`}
              style={{ paddingLeft: '36px' }}
              placeholder="Repita a senha"
            />
          </div>
          {errors.confirmPassword && <p className="ds-error-text">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="ds-btn ds-btn-primary"
          style={{ width: '100%', marginTop: '4px', padding: '12px', fontSize: '14px', borderRadius: 'var(--radius-md)' }}
        >
          {isSubmitting ? 'Redefinindo...' : 'Redefinir senha'}
        </button>
      </form>
    </div>
  );
};
