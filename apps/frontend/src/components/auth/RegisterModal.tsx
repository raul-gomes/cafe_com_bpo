import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { usePlans } from '../../api/hooks/usePlans';
import { Dialog, DialogContent } from '../ui/dialog';
import { RegisterForm } from './RegisterForm';
import { SignupPlanOffer } from '../payments/SignupPlanOffer';

interface RegisterModalProps {
  /** Se o modal está aberto (o pai — LoginPage — controla junto do redirect). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal de cadastro aberto a partir da tela de login.
 *
 * Fluxo em dois passos: o formulário de registro e, após o cadastro (o
 * AuthContext já faz o auto-login), a oferta de assinatura — "Assinar" (opção
 * pré-selecionada) leva a `/painel/pagamentos` e "Continuar no plano gratuito"
 * ao painel (`/painel`). O catálogo só é buscado quando a oferta está aberta:
 * `GET /plans` exige sessão e, disparado no mount, derrubaria o visitante
 * anônimo de volta ao login pelo interceptor do `client`.
 */
export const RegisterModal: React.FC<RegisterModalProps> = ({ open, onOpenChange }) => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [showOffer, setShowOffer] = useState(false);
    const { data: plans, isLoading: plansLoading } = usePlans({ enabled: open && showOffer });
    const activePlan = plans?.find(p => p.is_active) ?? plans?.[0] ?? null;

    useEffect(() => {
        if (!open) {
            setShowOffer(false);
        }
    }, [open]);

    // Sem plano ativo no catálogo não há investimento a mostrar: segue direto
    // para o painel.
    useEffect(() => {
        if (open && showOffer && !plansLoading && !activePlan) {
            navigate('/painel');
        }
    }, [open, showOffer, plansLoading, activePlan, navigate]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:!max-w-[768px] p-0 border-0 bg-transparent ring-0 max-h-[90vh] overflow-y-auto">
                {showOffer ? (
                    plansLoading || !activePlan || !isAuthenticated ? (
                        <div className="flex h-44 items-center justify-center text-[14px] text-muted-foreground">
                            Preparando seu espaço…
                        </div>
                    ) : (
                        <SignupPlanOffer
                            plan={activePlan}
                            onContinue={(choice) => navigate(choice === 'subscribe' ? '/painel/pagamentos' : '/painel')}
                        />
                    )
                ) : (
                    <RegisterForm
                        onClose={() => onOpenChange(false)}
                        onRegistered={() => setShowOffer(true)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};