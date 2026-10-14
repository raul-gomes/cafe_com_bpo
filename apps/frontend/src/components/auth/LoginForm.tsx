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
import { safeReturnTo } from '../../lib/returnTo';

interface LoginFormProps {
  onForgotPassword?: () => void;
  /** Abre o modal de cadastro — o login é a tela base e o registro é um popup. */
  onRegisterClick?: () => void;
  /** Inside the login dialog: no card of its own and tighter spacing. */
  compact?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword, onRegisterClick, compact = false }) => {
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<LoginFormData & { terms: boolean }>({
    defaultValues: { email: '', password: '', terms: false },
  });
  const [genericError, setGenericError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite_token');
  // Only people coming from the proposal download button (simulator) see the save-your-simulation notice.
  const cameFromProposal = searchParams.get('motivo') === 'proposta' && Boolean(sessionStorage.getItem('cafe_bpo_proposal'));
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
        // Back to where the session expired, when it is a path of the app (AUD-039).
        navigate(safeReturnTo(searchParams.get('return_to')) ?? '/painel');
      }
    } catch (error: any) {
      setGenericError(error.response?.data?.detail || 'Credenciais inválidas. Tente novamente.');
    }
  };

  return (
    <>
    <Card className={compact ? 'border-0 bg-transparent shadow-none ring-0' : 'mx-auto max-w-[480px]'}>
      <CardContent className={compact ? 'p-0' : 'pt-7 px-8 pb-7'}>
        {/* Brand: inside the login page it lives in the side column (LoginPage). */}
        {!compact && <div className="text-center mb-5">
          <img src={logoFor(mode)} alt="Café com BPO" className="mx-auto mb-[12px] h-auto w-[132px]" />
          <h2 className="font-editorial text-[1.75rem] font-medium leading-tight text-foreground">
            Bem-vindo de volta
          </h2>
          <p className="mt-[2px] text-sm text-muted-foreground">
            Entre com sua conta do Café com BPO
          </p>
        </div>}

        {cameFromProposal && (
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

          <div className="text-center mt-5 text-[13px] text-muted-foreground">
            Ainda não tem conta?{' '}
            <button
              type="button"
              onClick={onRegisterClick}
              className="text-primary-strong no-underline font-medium bg-transparent border-none cursor-pointer hover:underline p-0"
            >
              Cadastre-se
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
    </>
  );
};
