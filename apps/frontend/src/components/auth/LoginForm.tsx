import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { loginSchema, LoginFormData } from '../../schemas/auth';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';

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
      await login(response.data.access_token);
      navigate('/dashboard');
    } catch (error: any) {
      setGenericError(error.response?.data?.detail || 'Erro ao realizar login. Verifique suas credenciais.');
    }
  };

  const handleOAuthLogin = async (provider: string) => {
    try {
      const { data } = await apiClient.get<{url: string}>(`/auth/${provider}/login`);
      window.location.href = data.url;
    } catch (error) {
      setGenericError(`Falha ao iniciar autenticação com o ${provider}. Tente novamente.`);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2>Bem-vindo</h2>
        <p>Entre com sua conta BPO</p>
      </div>
      
      {genericError && (
        <div className="alert-error">
          <AlertCircle size={20} />
          <span>{genericError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label className="form-label" htmlFor="email">E-mail</label>
          <div className="input-wrapper">
            <div className="input-icon">
              <Mail size={18} />
            </div>
            <input
              id="email"
              type="email"
              {...register('email')}
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="seu@email.com"
            />
          </div>
          {errors.email && <p className="error-text">{errors.email.message}</p>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Senha</label>
          <div className="input-wrapper">
            <div className="input-icon">
              <Lock size={18} />
            </div>
            <input
              id="password"
              type="password"
              {...register('password')}
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="••••••••"
            />
          </div>
          {errors.password && <p className="error-text">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="submit-btn"
        >
          {isSubmitting ? (
            'Entrando...'
          ) : (
            <>
              Entrar <LogIn size={18} />
            </>
          )}
        </button>
      </form>

      <div className="divider">
        <span>Ou continue com</span>
      </div>

      <div className="oauth-grid">
        <button
          type="button"
          onClick={() => handleOAuthLogin('google')}
          className="oauth-btn"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google Logo" className="oauth-logo" />
          Google
        </button>
        
        <button
          type="button"
          onClick={() => handleOAuthLogin('microsoft')}
          className="oauth-btn"
        >
          <img src="https://www.svgrepo.com/show/503468/microsoft.svg" alt="Microsoft Logo" className="oauth-logo" />
          Microsoft
        </button>
      </div>
    </div>
  );
};
