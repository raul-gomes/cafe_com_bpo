import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoginFormData } from '../../schemas/auth';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { acceptInvitation } from '../../api/team';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import { logoFor, useAppearance } from '../../brand/appearance';

interface LoginFormProps {
  onForgotPassword?: () => void;
  /** Dentro da janela suspensa: sem cartão próprio e com espaçamentos menores. */
  compact?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword, compact = false }) => {
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<LoginFormData & { terms: boolean }>({
    defaultValues: { email: '', password: '', terms: false },
  });
  const [genericError, setGenericError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [googleSoon, setGoogleSoon] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite_token');
  // Só quem veio do botão de baixar a proposta (simulador) vê o aviso de salvar a simulação.
  const vindoDaProposta = searchParams.get('motivo') === 'proposta' && Boolean(sessionStorage.getItem('cafe_bpo_proposal'));
  const termsAccepted = watch('terms');
  const [{ mode }] = useAppearance();

  const onSubmit = async (data: LoginFormData & { terms: boolean }) => {
    setGenericError(null);

    // Validate all required fields
    const missingFields: string[] = [];
    if (!data.email?.trim()) missingFields.push('e-mail');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      setGenericError('Formato de e-mail inválido.');
      return;
    }
    if (!data.password) missingFields.push('senha');
    if (!data.terms) missingFields.push('aceite dos Termos de Uso e Política de Privacidade (LGPD)');

    if (missingFields.length > 0) {
      setGenericError(`Não é possível entrar: preencha ${missingFields.join(', ')}.`);
      return;
    }
    
    try {
      const formData = new URLSearchParams();
      formData.append('username', data.email);
      formData.append('password', data.password);
      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const res = await login(response.data.access_token);

      if (inviteToken) {
        try {
          await acceptInvitation(inviteToken);
        } catch (inviteError: any) {
          setGenericError(inviteError.response?.data?.detail || 'Erro ao aceitar o convite.');
          return;
        }
        navigate('/painel/tarefas');
        return;
      }

      if (res && (res as any).syncedProposalId) {
        navigate(`/painel/orcamento/${(res as any).syncedProposalId}`);
      } else {
        navigate('/painel');
      }
    } catch (error: any) {
      setGenericError(error.response?.data?.detail || 'Credenciais inválidas. Tente novamente.');
    }
  };

  return (
    <>
    <Card className={compact ? 'border-0 bg-transparent shadow-none ring-0' : 'mx-auto max-w-[480px]'}>
      <CardContent className={compact ? 'p-0' : 'pt-7 px-8 pb-7'}>
        {/* Marca: na janela suspensa ela fica na coluna ao lado (LoginDialog). */}
        {!compact && <div className="text-center mb-5">
          <img src={logoFor(mode)} alt="Café com BPO" className="mx-auto mb-[12px] h-auto w-[132px]" />
          <h2 className="font-editorial text-[1.75rem] font-medium leading-tight text-foreground">
            Bem-vindo de volta
          </h2>
          <p className="mt-[2px] text-sm text-muted-foreground">
            Entre com sua conta do Café com BPO
          </p>
        </div>}

        {vindoDaProposta && (
          <Alert className="mb-5 text-center">
            <strong>Quase lá!</strong> Faça login para salvar sua simulação e baixar sua proposta em PDF.
          </Alert>
        )}

        {genericError && (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle size={16} className="shrink-0" />
            <span>{genericError}</span>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
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
          </div>

          <div className="ds-input-group">
            <label className="ds-label" htmlFor="password">Senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                className="pl-9 pr-10"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-0"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="text-right -mt-2">
            <button type="button" onClick={onForgotPassword} className="bg-transparent border-none cursor-pointer text-muted-foreground text-[13px] hover:text-foreground">
              Esqueceu a senha?
            </button>
          </div>

          {/* LGPD Terms Checkbox */}
          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(v) => setValue('terms', v)}
              disabled={isSubmitting}
              className="mt-0.5 shrink-0"
            />
            <div className="text-[12px] text-muted-foreground leading-relaxed">
              <Label htmlFor="terms" className="cursor-pointer">
                Li e concordo com os{' '}
              </Label>
              <Link to="/termos-de-uso" className="text-primary-strong hover:underline text-[12px] leading-relaxed font-medium">
                Termos de Uso
              </Link>
              <Label htmlFor="terms" className="cursor-pointer">
                {' '}e{' '}
              </Label>
              <Link to="/politica-de-privacidade" className="text-primary-strong hover:underline text-[12px] leading-relaxed font-medium">
                Política de Privacidade
              </Link>
              <Label htmlFor="terms" className="cursor-pointer">
                {' '}(LGPD).
              </Label>
            </div>
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

        {/* Login com Google: o servidor já gera a autorização (auth/oauth/service.py),
            mas ainda não tem a rota que conecta ao site — o botão avisa "em breve". */}
        <div className="my-[12px] flex items-center gap-[10px] text-xs text-muted-foreground" aria-hidden="true">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>
        <button
          type="button"
          onClick={() => setGoogleSoon(true)}
          className="flex w-full items-center justify-center gap-[10px] rounded-md border border-input bg-card px-[14px] py-[9px] text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <svg className="size-[18px]" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.1-4.5H2.2v2.8A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.9 14.2a6.6 6.6 0 0 1 0-4.3V7H2.2a11 11 0 0 0 0 9.9l3.7-2.7z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.2 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
          </svg>
          Entrar com Google
        </button>
        {googleSoon && (
          <p role="status" className="mt-[8px] text-center text-xs text-muted-foreground">
            O login com Google chega em breve. Por enquanto, entre com e-mail e senha.
          </p>
        )}
      </CardContent>
    </Card>
    </>
  );
};
