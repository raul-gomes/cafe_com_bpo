import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormData } from '../../schemas/auth';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { acceptInvitation } from '../../api/team';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import { AlertCircle, X } from 'lucide-react';
import logo from '../../assets/logo.png';

interface RegisterFormProps {
  onClose?: () => void;
  /** Chamada após o cadastro self-service (sem convite) para a página decidir
   *  o próximo passo — ex.: exibir a oferta de assinatura antes do painel. */
  onRegistered?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onClose, onRegistered }) => {
  const { register: authRegister } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite_token');
  const [showPw, setShowPw] = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema) as any,
    defaultValues: { terms: false },
  });

  const termsAccepted = watch('terms');

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      await authRegister({
        name: data.name,
        email: data.email,
        company: data.company || '',
        password: data.password,
        terms_accepted: data.terms,
      });

      if (inviteToken) {
        try {
          await acceptInvitation(inviteToken);
        } catch (inviteError: any) {
          setServerError(inviteError.response?.data?.detail || 'Erro ao aceitar o convite.');
          return;
        }
        navigate('/painel/tarefas');
        return;
      }

      if (onRegistered) {
        onRegistered();
      } else {
        navigate('/painel');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Erro ao criar conta. Tente novamente.';
      setServerError(Array.isArray(msg) ? msg[0]?.msg ?? String(msg) : String(msg));
    }
  };

  return (
    <>
    <Card className="relative mx-auto w-full max-w-[768px]">
      <CardContent className="pt-7 px-8 pb-7">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <X size={18} />
          </button>
        )}
        <div className="text-center mb-5">
          <img src={logo} alt="Café com BPO" className="h-10 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-1">Crie sua conta</h2>
          <p className="text-sm text-muted-foreground">Preencha os dados abaixo</p>
        </div>

        {serverError && (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle size={16} className="shrink-0" /><span>{serverError}</span>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
          <div className="ds-input-group">
            <label className="ds-label">Nome completo *</label>
            <Input type="text" placeholder="Ex: João Silva" {...register('name')} />
            {errors.name && <p className="ds-error-text">{errors.name.message}</p>}
          </div>

          <div className="ds-input-group">
            <label className="ds-label">E-mail *</label>
            <Input type="email" placeholder="seu@email.com" {...register('email')} />
            {errors.email && <p className="ds-error-text">{errors.email.message}</p>}
          </div>

          <div className="ds-input-group">
            <label className="ds-label">Empresa (opcional)</label>
            <Input type="text" placeholder="Nome da empresa" {...register('company')} />
          </div>

          <div className="ds-input-group">
            <label className="ds-label">Senha *</label>
            <div className="relative">
              <Input type={showPw ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" {...register('password')} />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted-foreground cursor-pointer text-sm" onClick={() => setShowPw(v => !v)}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            {errors.password && <p className="ds-error-text">{errors.password.message}</p>}
          </div>

          <div className="ds-input-group">
            <label className="ds-label">Confirmar senha *</label>
            <div className="relative">
              <Input type={showCPw ? 'text' : 'password'} placeholder="Repita a senha" {...register('confirmPassword')} />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted-foreground cursor-pointer text-sm" onClick={() => setShowCPw(v => !v)}>
                {showCPw ? '🙈' : '👁'}
              </button>
            </div>
            {errors.confirmPassword && <p className="ds-error-text">{errors.confirmPassword.message}</p>}
          </div>

          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="register-terms"
              checked={termsAccepted}
              onCheckedChange={(v) => setValue('terms', Boolean(v))}
              disabled={isSubmitting}
              className="mt-0.5 shrink-0"
            />
            <div className="text-[12px] text-muted-foreground leading-relaxed">
              <Label htmlFor="register-terms" className="cursor-pointer">
                Li e concordo com os{' '}
              </Label>
              {/* Opens in a new tab so the half-filled sign-up form is not lost. */}
              <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="text-primary-strong hover:underline text-[12px] leading-relaxed font-medium">
                Termos de Uso
              </a>
              <Label htmlFor="register-terms" className="cursor-pointer">
                {' '}e{' '}
              </Label>
              <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-primary-strong hover:underline text-[12px] leading-relaxed font-medium">
                Política de Privacidade
              </a>
              <Label htmlFor="register-terms" className="cursor-pointer">
                {' '}(LGPD).
              </Label>
            </div>
          </div>
          {errors.terms && <p className="ds-error-text -mt-1">{errors.terms.message}</p>}

          <div className="mt-2 border-t border-border pt-5">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    </>
  );
};
