import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { loginSchema, LoginFormData } from '../../schemas/auth';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
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
    <Card className="mx-auto max-w-[420px]">
      <CardContent className="pt-9 px-6">
        {/* Brand */}
        <div className="text-center mb-7">
          <img src={logo} alt="Café com BPO" className="h-10 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-1">
            Bem-vindo
          </h2>
          <p className="text-sm text-muted-foreground">
            Entre com sua conta BPO
          </p>
        </div>

        {sessionStorage.getItem('cafe_bpo_proposal') && (
          <Alert className="mb-5 text-center">
            <strong>Quase lá!</strong> Faça login ou cadastre-se para salvar sua simulação e baixar sua proposta em PDF.
          </Alert>
        )}

        {genericError && (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle size={16} className="shrink-0" />
            <span>{genericError}</span>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="ds-input-group">
            <label className="ds-label" htmlFor="email">E-mail</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="email" type="email"
                {...register('email')}
                className="pl-9"
                placeholder="seu@email.com"
              />
            </div>
            {errors.email && <p className="ds-error-text">{errors.email.message}</p>}
          </div>

          <div className="ds-input-group">
            <label className="ds-label" htmlFor="password">Senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="password" type="password"
                {...register('password')}
                className="pl-9"
                placeholder="••••••••"
              />
            </div>
            {errors.password && <p className="ds-error-text">{errors.password.message}</p>}
          </div>

          <div className="text-right -mt-2">
            <a href="/esqueci-minha-senha" className="text-muted-foreground no-underline text-[13px] hover:text-foreground">
              Esqueceu a senha?
            </a>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-1"
          >
            {isSubmitting
              ? 'Entrando...'
              : <><span>Entrar</span><LogIn size={15} /></>
            }
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6 text-muted-foreground text-xs">
          <div className="flex-1 h-px bg-border" />
          <span>ou continue com</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* OAuth */}
        <div className="max-w-[200px] mx-auto">
          <Button
            variant="ghost"
            onClick={() => handleOAuthLogin('google')}
            className="w-full py-2.5 h-auto text-xs"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="" className="size-4" />
            Google
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
