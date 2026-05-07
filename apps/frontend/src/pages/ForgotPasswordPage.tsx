import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { apiClient } from '../api/client';
import logo from '../assets/logo.png';

const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage: React.FC = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError(null);
    try {
      await apiClient.post('/auth/forgot-password', { email: data.email });
      setSubmitted(true);
    } catch (error: any) {
      setServerError(error.response?.data?.detail || 'Erro ao solicitar redefinição. Tente novamente.');
    }
  };

  if (submitted) {
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
          Verifique seu e-mail
        </h2>
        <p style={{ font: 'var(--text-body)', color: 'var(--ds-text-muted)', marginBottom: '24px' }}>
          Enviamos instruções para redefinir sua senha.
        </p>
        <a href="/login" style={{
          color: 'var(--ds-primary)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
        }}>
          <ArrowLeft size={16} />
          Voltar ao login
        </a>
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
          Esqueceu a senha?
        </h2>
        <p style={{ font: 'var(--text-body)', color: 'var(--ds-text-muted)' }}>
          Informe seu e-mail para receber instruções
        </p>
      </div>

      {serverError && (
        <div className="ds-alert ds-alert-error" style={{ marginBottom: '20px' }}>
          <span>{serverError}</span>
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="ds-btn ds-btn-primary"
          style={{ width: '100%', marginTop: '4px', padding: '12px', fontSize: '14px', borderRadius: 'var(--radius-md)' }}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar instruções'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <a href="/login" style={{
          color: 'var(--ds-primary)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
        }}>
          <ArrowLeft size={16} />
          Voltar ao login
        </a>
      </div>
    </div>
  );
};
