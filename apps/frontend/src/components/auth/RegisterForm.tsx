import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormData } from '../../schemas/auth';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { AlertCircle } from 'lucide-react';

export const RegisterForm: React.FC = () => {
  const { register: authRegister } = useAuth();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema) as any,
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      await authRegister({
        name: data.name,
        email: data.email,
        company: data.company || '',
        password: data.password,
      });

      navigate('/painel');
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Erro ao criar conta. Tente novamente.';
      setServerError(Array.isArray(msg) ? msg[0]?.msg ?? String(msg) : String(msg));
    }
  };

  return (
    <div style={{
      width: '100%', maxWidth: '420px', margin: '0 auto', background: 'var(--ds-surface)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-lg)', padding: '36px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <img src={logo} alt="Café com BPO" style={{ height: '40px', margin: '0 auto 16px' }} />
        <h2 style={{ font: 'var(--text-h2)', color: 'var(--ds-text)', marginBottom: '4px' }}>Crie sua conta</h2>
        <p style={{ font: 'var(--text-body)', color: 'var(--ds-text-muted)' }}>Preencha os dados abaixo</p>
      </div>

      {serverError && (
        <div className="ds-alert ds-alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} /><span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ gap: '16px', display: 'flex', flexDirection: 'column' }}>
        <div className="ds-input-group">
          <label className="ds-label">Nome completo *</label>
          <input type="text" className={`ds-input ${errors.name ? 'error' : ''}`} placeholder="Ex: João Silva" {...register('name')} />
          {errors.name && <p className="ds-error-text">{errors.name.message}</p>}
        </div>

        <div className="ds-input-group">
          <label className="ds-label">E-mail *</label>
          <input type="email" className={`ds-input ${errors.email ? 'error' : ''}`} placeholder="seu@email.com" {...register('email')} />
          {errors.email && <p className="ds-error-text">{errors.email.message}</p>}
        </div>

        <div className="ds-input-group">
          <label className="ds-label">Empresa (opcional)</label>
          <input type="text" className="ds-input" placeholder="Nome da empresa" {...register('company')} />
        </div>

        <div className="ds-input-group">
          <label className="ds-label">Senha *</label>
          <div style={{ position: 'relative' }}>
            <input type={showPw ? 'text' : 'password'} className={`ds-input ${errors.password ? 'error' : ''}`} placeholder="Mínimo 8 caracteres" {...register('password')} />
            <button type="button" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }} onClick={() => setShowPw(v => !v)}>{showPw ? '🙈' : '👁'}</button>
          </div>
          {errors.password && <p className="ds-error-text">{errors.password.message}</p>}
        </div>

        <div className="ds-input-group">
          <label className="ds-label">Confirmar senha *</label>
          <div style={{ position: 'relative' }}>
            <input type={showCPw ? 'text' : 'password'} className={`ds-input ${errors.confirmPassword ? 'error' : ''}`} placeholder="Repita a senha" {...register('confirmPassword')} />
            <button type="button" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }} onClick={() => setShowCPw(v => !v)}>{showCPw ? '🙈' : '👁'}</button>
          </div>
          {errors.confirmPassword && <p className="ds-error-text">{errors.confirmPassword.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="ds-btn ds-btn-primary" style={{ width: '100%', marginTop: '16px', padding: '12px', fontSize: '14px', borderRadius: 'var(--radius-md)' }}>
          {isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>
    </div>
  );
};
