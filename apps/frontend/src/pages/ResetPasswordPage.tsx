import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Alert } from '../components/ui/alert';
import logo from '../assets/logo.png';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const ResetPasswordPage: React.FC = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const token = searchParams.get('token');

  const onSubmit = async (data: ResetPasswordFormData) => {
    setServerError(null);
    if (!token) {
      setServerError('Token de redefinição ausente.');
      return;
    }
    try {
      await apiClient.post('/auth/reset-password', {
        token,
        new_password: data.password,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (error: any) {
      setServerError(error.response?.data?.detail || 'Erro ao redefinir senha. Tente novamente.');
    }
  };

  if (!token) {
    return (
      <Card className="mx-auto max-w-[420px] text-center">
        <CardContent className="pt-9">
          <p className="text-muted-foreground">Token de redefinição ausente. Solicite um novo link.</p>
          <a href="/esqueci-minha-senha" className="text-primary no-underline text-sm">
            Solicitar novo link
          </a>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="mx-auto max-w-[420px] text-center">
        <CardContent className="pt-9">
          <img src={logo} alt="Café com BPO" className="h-10 mx-auto mb-4" />
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            Senha redefinida!
          </h2>
          <p className="text-sm text-muted-foreground">
            Redirecionando para o login...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-[420px]">
      <CardContent className="pt-9">
        <div className="text-center mb-7">
          <img src={logo} alt="Café com BPO" className="h-10 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-1">
            Nova senha
          </h2>
          <p className="text-sm text-muted-foreground">
            Defina sua nova senha
          </p>
        </div>

        {serverError && (
          <Alert variant="destructive" className="mb-5">
            <span>{serverError}</span>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="ds-input-group">
            <label className="ds-label" htmlFor="password">Nova senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="password" type="password"
                {...register('password')}
                className="pl-9"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            {errors.password && <p className="ds-error-text">{errors.password.message}</p>}
          </div>

          <div className="ds-input-group">
            <label className="ds-label" htmlFor="confirmPassword">Confirmar senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="confirmPassword" type="password"
                {...register('confirmPassword')}
                className="pl-9"
                placeholder="Repita a senha"
              />
            </div>
            {errors.confirmPassword && <p className="ds-error-text">{errors.confirmPassword.message}</p>}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-1"
          >
            {isSubmitting ? 'Redefinindo...' : 'Redefinir senha'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
