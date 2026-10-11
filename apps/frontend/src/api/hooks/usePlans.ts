import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createPlan, listPlans, resyncPlanPrices, updatePlan } from '../plans';
import type { PlanCreateInput, PlanUpdateInput } from '../../schemas/plans';

/**
 * Catálogo de planos do admin (Config → Planos).
 *
 * O `queryKey` é `['plans']` e não carrega o id: quem escreve invalida a lista
 * inteira, porque o preço de um plano muda o que o checkout oferece e o que o
 * `GET /access` devolve para os assinantes. Uma cache por plano deixaria as duas
 * telas discordando até o próximo invalidate.
 */
const PLANS_KEY = ['plans'] as const;

export const usePlans = () =>
    useQuery({
        queryKey: PLANS_KEY,
        queryFn: listPlans,
    });

export const useCreatePlan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: PlanCreateInput) => createPlan(data),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: PLANS_KEY });
            toast.success('Plano criado.');
        },
        onError: () => {
            toast.error('Não foi possível criar o plano.');
        },
    });
};

export const useUpdatePlan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ planId, data }: { planId: string; data: PlanUpdateInput }) =>
            updatePlan(planId, data),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: PLANS_KEY });
            toast.success('Plano atualizado.');
        },
        onError: () => {
            toast.error('Não foi possível atualizar o plano.');
        },
    });
};

/**
 * Ressincroniza os preços de um plano com o provedor (Config → Planos, Fase 10).
 *
 * Não observa o `subscriber_count` na tela: o sync muda o que o provedor cobra,
 * não o catálogo. O invalidate mantém a lista fresca caso outro admin edite.
 */
export const useResyncPlanPrices = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (planId: string) => resyncPlanPrices(planId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: PLANS_KEY });
            toast.success('Preços sincronizados com o provedor.');
        },
        onError: () => {
            toast.error('Não foi possível sincronizar os preços.');
        },
    });
};
