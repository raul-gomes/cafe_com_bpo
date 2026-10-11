import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cancelSubscription, listBillingHistory, openCheckout } from '../subscription';

/**
 * Ações de assinatura do bloco de plano (seção Pagamentos, Fase 9).
 *
 * Cancelar muda o `GET /access` (estado volta para free e o banner some), por
 * isso o sucesso invalida `['access']`. Cada mutação **não** mostra toast aqui:
 * quem decide o texto é a página — o checkout, por exemplo, precisa exibir a
 * mensagem de erro que o servidor manda no `detail` (§17.3) sem duplicar aviso.
 */
const ACCESS_KEY = ['access'] as const;
const HISTORY_KEY = ['billing', 'history'] as const;

export const useBillingHistory = () =>
    useQuery({ queryKey: HISTORY_KEY, queryFn: listBillingHistory });

/** Abre a sessão de checkout da Asaas para um plano; o link vai para fora do SPA. */
export const useOpenCheckout = () =>
    useMutation({
        mutationFn: (planId: string) => openCheckout(planId),
    });

/** Cancela a assinatura atual; o período já pago continua valendo (§17.5). */
export const useCancelSubscription = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => cancelSubscription(),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ACCESS_KEY });
        },
    });
};