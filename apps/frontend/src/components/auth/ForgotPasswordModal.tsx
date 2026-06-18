import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { apiClient } from '../../api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';

const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ open, onOpenChange }) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]" showCloseButton={!submitted}>
        {submitted ? (
          <div className="text-center py-4">
            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Verifique seu e-mail</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enviamos instruções para redefinir sua senha.
            </p>
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="gap-2">
              <ArrowLeft size={16} /> Voltar ao login
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Esqueceu a senha?</DialogTitle>
              <DialogDescription>Informe seu e-mail para receber instruções</DialogDescription>
            </DialogHeader>

            {serverError && (
              <Alert variant="destructive">
                <span>{serverError}</span>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide" htmlFor="modal-email">E-mail</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="modal-email" type="email"
                    {...register('email')}
                    className="pl-9"
                    placeholder="seu@email.com"
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive font-medium">{errors.email.message}</p>}
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Enviando...' : 'Enviar instruções'}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
