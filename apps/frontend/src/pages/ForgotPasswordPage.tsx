import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { apiClient } from '../api/client';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Alert } from '../components/ui/alert';
import logo from '../assets/logo.png';

const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage: React.FC = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError(null);
    try {
      await apiClient.post('/auth/forgot-password', { email: data.email });
      setSubmitted(true);
    } catch (error: any) {
      setServerError(error.response?.data?.detail || 'Erro ao solicitar redefinição. Tente novamente.');
    }
  };

  if (submitted) {
    return (
      <Card className="mx-auto max-w-[420px] text-center">
        <CardContent className="pt-9">
          <img src={logo} alt="Café com BPO" className="h-10 mx-auto mb-4" />
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            Verifique seu e-mail
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Enviamos instruções para redefinir sua senha.
          </p>
          <a href="/login" className="text-primary no-underline inline-flex items-center gap-2 text-sm">
            <ArrowLeft size={16} />
            Voltar ao login
          </a>
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
            Esqueceu a senha?
          </h2>
          <p className="text-sm text-muted-foreground">
            Informe seu e-mail para receber instruções
          </p>
        </div>

        {serverError && (
          <Alert variant="destructive" className="mb-5">
            <span>{serverError}</span>
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

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-1"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar instruções'}
          </Button>
        </form>

        <div className="text-center mt-5">
          <a href="/login" className="text-primary no-underline inline-flex items-center gap-2 text-sm">
            <ArrowLeft size={16} />
            Voltar ao login
          </a>
        </div>
      </CardContent>
    </Card>
  );
};
