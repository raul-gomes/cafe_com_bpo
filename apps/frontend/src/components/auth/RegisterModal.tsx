import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormData } from '../../schemas/auth';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useGeneratePDF } from '../../lib/useGeneratePDF';
import { PricingFormData } from '../../schemas/pricing';
import { PricingResult } from '../../lib/pricingEngine';
import logoAsset from '../../assets/logo.png';

interface RegisterModalProps {
  onClose: () => void;
  form: PricingFormData;
  pricing: PricingResult;
  clientName: string;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  onClose,
  form,
  pricing,
  clientName,
}) => {
  const { register: authRegister } = useAuth();
  const navigate = useNavigate();
  const { generate: generatePDF, isGenerating } = useGeneratePDF();
  const [showPw, setShowPw]     = useState(false);
  const [showCPw, setShowCPw]   = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema) as any,
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      const res = await authRegister({
        name: data.name,
        email: data.email,
        company: data.company,
        password: data.password,
      });

      // Gera e baixa o PDF
      await generatePDF({
        form,
        pricing,
        logoUrl: logoAsset,
        clientName: clientName || data.name,
      });

      // Fecha modal e vai para a proposta no painel (ou painel geral)
      onClose();
      if (res && (res as any).syncedProposalId) {
        navigate(`/painel/orcamento/${(res as any).syncedProposalId}`);
      } else {
        navigate('/painel');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Erro ao criar conta. Tente novamente.';
      setServerError(Array.isArray(msg) ? msg[0]?.msg ?? String(msg) : String(msg));
    }
  };

  // Fecha ao clicar no backdrop
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isPending = isSubmitting || isGenerating;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-box">
        <button className="modal-close" onClick={onClose} aria-label="Fechar modal">✕</button>

        <h2 className="modal-title" id="modal-title">Acesse seu relatório</h2>
        <p className="modal-sub">
          Crie sua conta gratuitamente para baixar a proposta em PDF.
        </p>

        {serverError && (
          <div className="modal-server-error" role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="modal-form-grid">

            {/* Nome */}
            <div className="modal-field">
              <label htmlFor="reg-name">Nome completo *</label>
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                placeholder="Ex: João Silva"
                className={errors.name ? 'input-error' : ''}
                {...register('name')}
              />
              {errors.name && <span className="modal-field-error">{errors.name.message}</span>}
            </div>

            {/* Email */}
            <div className="modal-field">
              <label htmlFor="reg-email">E-mail *</label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                className={errors.email ? 'input-error' : ''}
                {...register('email')}
              />
              {errors.email && <span className="modal-field-error">{errors.email.message}</span>}
            </div>

            {/* Empresa */}
            <div className="modal-field">
              <label htmlFor="reg-company">Empresa <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span></label>
              <input
                id="reg-company"
                type="text"
                autoComplete="organization"
                placeholder="Nome da empresa"
                {...register('company')}
              />
            </div>

            {/* Senha */}
            <div className="modal-field">
              <label htmlFor="reg-password">Senha *</label>
              <div className="modal-password-wrap">
                <input
                  id="reg-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  className={errors.password ? 'input-error' : ''}
                  {...register('password')}
                />
                <button type="button" className="modal-pw-toggle" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Esconder senha' : 'Mostrar senha'}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
              {errors.password && <span className="modal-field-error">{errors.password.message}</span>}
            </div>

            {/* Confirmar senha */}
            <div className="modal-field">
              <label htmlFor="reg-confirm">Confirmar senha *</label>
              <div className="modal-password-wrap">
                <input
                  id="reg-confirm"
                  type={showCPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                  className={errors.confirmPassword ? 'input-error' : ''}
                  {...register('confirmPassword')}
                />
                <button type="button" className="modal-pw-toggle" onClick={() => setShowCPw(v => !v)} aria-label={showCPw ? 'Esconder confirmação' : 'Mostrar confirmação'}>
                  {showCPw ? '🙈' : '👁'}
                </button>
              </div>
              {errors.confirmPassword && <span className="modal-field-error">{errors.confirmPassword.message}</span>}
            </div>

            <button type="submit" className="modal-submit" disabled={isPending}>
              {isPending ? 'Criando conta e gerando PDF...' : 'Criar conta e baixar PDF'}
            </button>
          </div>
        </form>

        <div className="modal-footer-link">
          Já tem conta?{' '}
          <button onClick={() => { onClose(); window.location.href = '/login'; }}>
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
};
