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
      // Redireciona o usuário pra a URI do OAuth do backend (que repassa pra google/ms)
      window.location.href = data.url;
    } catch (error) {
      setGenericError(`Falha ao iniciar autenticação com o ${provider}. Tente novamente.`);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 rounded-2xl bg-white/70 backdrop-blur-xl shadow-2xl border border-white/50">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Bem-vindo</h2>
        <p className="text-gray-500 font-medium">Entre com sua conta BPO</p>
      </div>
      
      {genericError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3 animate-pulse">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <span className="text-sm font-medium">{genericError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="email">E-mail</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Mail className="h-5 w-5" />
            </div>
            <input
              id="email"
              type="email"
              {...register('email')}
              className={`block w-full pl-11 pr-3 py-3 border ${errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-white/80 transition-all outline-none text-gray-900`}
              placeholder="seu@email.com"
            />
          </div>
          {errors.email && <p className="mt-1.5 text-sm text-red-500 font-medium">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="password">Senha</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Lock className="h-5 w-5" />
            </div>
            <input
              id="password"
              type="password"
              {...register('password')}
              className={`block w-full pl-11 pr-3 py-3 border ${errors.password ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-white/80 transition-all outline-none text-gray-900`}
              placeholder="••••••••"
            />
          </div>
          {errors.password && <p className="mt-1.5 text-sm text-red-500 font-medium">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-base font-bold text-gray-900 bg-primary hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-95"
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
          ) : (
            <>
              Entrar <LogIn className="ml-2 w-5 h-5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white/70 text-gray-500 font-semibold rounded-full blur-none">Ou continue com</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            className="w-full flex items-center justify-center px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google Logo" className="w-5 h-5 mr-2" />
            Google
          </button>
          
          <button
            type="button"
            onClick={() => handleOAuthLogin('microsoft')}
            className="w-full flex items-center justify-center px-4 py-2.5 border border-gray-200 rounded-xl shadow-sm bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors"
          >
            <img src="https://www.svgrepo.com/show/503468/microsoft.svg" alt="Microsoft Logo" className="w-5 h-5 mr-2" />
            Microsoft
          </button>
        </div>
      </div>
    </div>
  );
};
