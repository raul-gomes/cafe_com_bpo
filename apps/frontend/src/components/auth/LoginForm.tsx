import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { LegalDocumentModal } from '../ui/LegalDocumentModal';
import { TERMOS_USO_HTML } from '../../content/termos-uso';
import { POLITICA_PRIVACIDADE_HTML } from '../../content/politica-privacidade';
import logo from '../../assets/logo.png';

interface LoginFormProps {
  onForgotPassword?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword }) => {
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<LoginFormData & { terms: boolean }>({
    defaultValues: { email: '', password: '', terms: false },
  });
  const [genericError, setGenericError] = useState<string | null>(null);
  const [openTerms, setOpenTerms] = useState(false);
  const [openPrivacy, setOpenPrivacy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite_token');
  const termsAccepted = watch('terms');

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
    <Card className="mx-auto max-w-[480px]">
      <CardContent className="pt-7 px-8 pb-7">
        {/* Brand */}
        <div className="text-center mb-5">
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
              <button type="button" onClick={() => setOpenTerms(true)} className="text-primary-strong hover:underline bg-transparent border-none cursor-pointer p-0 text-[12px] leading-relaxed font-medium inline">
                Termos de Uso
              </button>
              <Label htmlFor="terms" className="cursor-pointer">
                {' '}e{' '}
              </Label>
              <button type="button" onClick={() => setOpenPrivacy(true)} className="text-primary-strong hover:underline bg-transparent border-none cursor-pointer p-0 text-[12px] leading-relaxed font-medium inline">
                Política de Privacidade
              </button>
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
      </CardContent>
    </Card>
    <LegalDocumentModal open={openTerms} onOpenChange={setOpenTerms} title="Termos de Uso" content={TERMOS_USO_HTML} />
    <LegalDocumentModal open={openPrivacy} onOpenChange={setOpenPrivacy} title="Política de Privacidade" content={POLITICA_PRIVACIDADE_HTML} />
    </>
  );
};
