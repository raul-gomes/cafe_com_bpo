import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormData } from '../../schemas/auth';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { AlertCircle } from 'lucide-react';
import logo from '../../assets/logo.png';

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
    <Card className="mx-auto max-w-[420px]">
      <CardContent className="pt-9 px-8 pb-8">
        <div className="text-center mb-7">
          <img src={logo} alt="Café com BPO" className="h-10 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-1">Crie sua conta</h2>
          <p className="text-sm text-muted-foreground">Preencha os dados abaixo</p>
        </div>

        {serverError && (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle size={16} className="shrink-0" /><span>{serverError}</span>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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

          <Button type="submit" disabled={isSubmitting} className="w-full mt-4">
            {isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
