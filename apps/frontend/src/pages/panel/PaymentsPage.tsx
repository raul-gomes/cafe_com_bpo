import { useEffect, useRef } from 'react';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { getAccess } from '../../api/access';
import { useAccess } from '../../api/hooks/useAccess';
import { useBillingProfile, useSaveBillingProfile } from '../../api/hooks/useBillingProfile';
import { useBillingHistory, useCancelSubscription, useOpenCheckout } from '../../api/hooks/useSubscription';
import { usePlans } from '../../api/hooks/usePlans';
import { BillingHistoryList } from '../../components/payments/BillingHistoryList';
import { BillingProfileForm } from '../../components/payments/BillingProfileForm';
import { SubscriptionStatusCard } from '../../components/payments/SubscriptionStatusCard';
import type { BillingDataInput } from '../../schemas/subscription';

/**
 * Seção Pagamentos — reescrita na Fase 9 do plano de pagamentos.
 *
 * Três blocos: o plano + as ações (assinar via checkout Asaas ou cancelar), os
 * dados de cobrança (`PUT/GET /subscriptions/billing`) e o histórico mês a mês
 * (`GET /payments/`). Os endpoints antigos (/payments/create) foram aposentados
 * no backend: tudo aqui gira em torno da assinatura.
 *
 * O retorno do checkout volta como `?checkout=paid|canceled|expired` (§17.2) —
 * o toast nasce de um efeito único que também estoura as caches de `access` e de
 * histórico e limpa a query string com `history.replaceState`, para um reload
 * não reexibir o aviso.
 */

const ACCESS_KEY = ['access'] as const;
const HISTORY_KEY = ['billing', 'history'] as const;

const periodEndLabel = (iso: string): string =>
    new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(iso));

const firstApiError = (error: unknown): string | null => {
    const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
    if (typeof detail === 'string') {
        return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
        const msg = (detail[0] as { msg?: unknown })?.msg;
        if (typeof msg === 'string') {
            return msg.replace(/^Value error, /, '');
        }
    }
    return null;
};

/**
 * Retorno `?checkout=paid`: consulta o acesso no servidor antes de anunciar.
 * Plano ativo confirma; ainda sem o webhook (ou sem resposta), avisa que a
 * confirmação está a caminho em vez de prometer o acesso.
 */
const confirmPaidCheckout = async (queryClient: QueryClient): Promise<void> => {
    try {
        const access = await queryClient.fetchQuery({
            queryKey: ACCESS_KEY,
            queryFn: getAccess,
            staleTime: 0,
        });
        if (access.access === 'active') {
            toast.success('Pagamento confirmado. Bem-vindo(a) ao plano!');
            return;
        }
    } catch {
        // sem resposta do servidor, cai no aviso de espera
    }
    toast.info(
        'Pagamento enviado. Estamos aguardando a confirmação do Asaas, e o plano é liberado assim que ela chegar (costuma levar poucos minutos).',
    );
};

export function PaymentsPage() {
    const { data: access } = useAccess();
    const { data: plans, isLoading: isCheckingPlans } = usePlans();
    const { data: profile, isLoading: isProfileLoading } = useBillingProfile();
    const { data: history, isLoading: isHistoryLoading } = useBillingHistory();
    const openCheckout = useOpenCheckout();
    const cancelSubscription = useCancelSubscription();
    const saveProfile = useSaveBillingProfile();
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const formAnchorRef = useRef<HTMLDivElement>(null);

    const hasSavedProfile = profile !== null && profile !== undefined;

    useEffect(() => {
        const checkout = new URLSearchParams(window.location.search).get('checkout');
        if (checkout === 'paid') {
            // A URL só diz que o checkout terminou; quem confirma o pagamento
            // é o servidor, depois do webhook do Asaas (AUD-034).
            void confirmPaidCheckout(queryClient);
        } else if (checkout === 'canceled') {
            toast.info('Checkout cancelado. Nada foi cobrado.');
        } else if (checkout === 'expired') {
            toast.info('A sessão de pagamento expirou. Tente novamente quando quiser.');
        } else {
            return;
        }
        void queryClient.invalidateQueries({ queryKey: ACCESS_KEY });
        void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
        window.history.replaceState({}, '', '/painel/pagamentos');
    }, [queryClient]);

    const handleSubscribe = async (planId: string) => {
        if (!hasSavedProfile) {
            toast.warning('Preencha seus dados de cobrança abaixo para assinar.');
            if (typeof formAnchorRef.current?.scrollIntoView === 'function') {
                formAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }
        try {
            const checkout = await openCheckout.mutateAsync(planId);
            window.location.assign(checkout.link);
        } catch (error) {
            toast.error(firstApiError(error) ?? 'Não foi possível abrir o checkout.');
        }
    };

    const handleCancel = async () => {
        const approved = await confirm({
            title: 'Cancelar assinatura?',
            message:
                'Você mantém o acesso até o fim do período já pago, e o valor não é reembolsado.',
            confirmLabel: 'Sim, cancelar',
            variant: 'warning',
        });
        if (!approved) {
            return;
        }
        try {
            const result = await cancelSubscription.mutateAsync();
            if (result.current_period_end) {
                toast.success(
                    `Assinatura cancelada. Acesso liberado até ${periodEndLabel(result.current_period_end)}.`,
                );
            } else {
                toast.info('Checkout abandonado descartado. Nada foi cobrado.');
            }
        } catch (error) {
            toast.error(firstApiError(error) ?? 'Não foi possível cancelar a assinatura.');
        }
    };

    // P-22, opção A: quem está em atraso reabre o checkout do plano atual para
    // regularizar. O plano-alvo vem do catálogo (o access só traz o `code`) e
    // o pagamento reativa a assinatura (§17.4 "volta ao normal sozinho").
    const handleRegularize = async () => {
        const currentPlan = access?.plan;
        const target = plans?.find((candidate) => candidate.code === currentPlan?.code);
        if (!target) {
            toast.error('Não foi possível localizar o plano em atraso.');
            return;
        }
        try {
            const checkout = await openCheckout.mutateAsync(target.id);
            window.location.assign(checkout.link);
        } catch (error) {
            toast.error(
                firstApiError(error) ?? 'Não foi possível regularizar o pagamento.',
            );
        }
    };

    const handleSaveProfile = (data: BillingDataInput) => {
        saveProfile.mutate(data, {
            // A mensagem de produto do 422 (ex.: "Informe um CPF ou CNPJ válido")
            // vai para o formulário pela prop `apiError` — regra §17.8: "erro de
            // validação aparece no formulário". O toast genérico fica só para
            // erros sem mensagem (rede, servidor).
            onError: (error) => {
                if (!firstApiError(error)) {
                    toast.error('Não foi possível salvar os dados de cobrança.');
                }
            },
        });
    };

    return (
        <div className="animate-[panelFadeIn_0.4s_ease-out]">
                <Breadcrumb
                    items={[
                        { label: 'Painel', to: '/painel' },
                        { label: 'Pagamentos' },
                    ]}
                />

                <div className="mb-6">
                    <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">
                        Pagamentos
                    </h1>
                    <p className="text-[14px] text-muted-foreground">
                        Plano, cobrança e histórico da sua assinatura.
                    </p>
                </div>

                {access && (
                    <div ref={formAnchorRef}>
                        <SubscriptionStatusCard
                            access={access}
                            plans={plans}
                            isCheckingPlans={isCheckingPlans}
                            hasSavedProfile={hasSavedProfile}
                            onSubscribe={handleSubscribe}
                            onCancel={handleCancel}
                            onRegularize={handleRegularize}
                        />
                    </div>
                )}

                <BillingProfileForm
                    profile={profile}
                    isLoading={isProfileLoading}
                    isSaving={saveProfile.isPending}
                    apiError={saveProfile.error ? firstApiError(saveProfile.error) : null}
                    onSave={handleSaveProfile}
                />

                <BillingHistoryList rows={history} isLoading={isHistoryLoading} />
            </div>
    );
}