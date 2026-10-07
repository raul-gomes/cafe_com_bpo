import { apiClient } from './client';

import {
    type Plan,
    type PlanCreateInput,
    type PlanUpdateInput,
    type PriceSyncResponse,
    planListSchema,
    planSchema,
    priceSyncResponseSchema,
} from '../schemas/plans';

/**
 * O contrato vive em `schemas/plans.ts`, com validação em runtime: o tipo sai do
 * schema pelo `z.infer`, então a tela e o servidor não divergem sem que o teste
 * acuse. O preço atravessa como string justamente para não ser reinterpretado.
 */

export type { Plan, PlanCreateInput, PlanUpdateInput, PriceSyncResponse };
export { planCreateSchema, planUpdateSchema } from '../schemas/plans';

/** Lista o catálogo visível para quem está logado. */
export const listPlans = async (): Promise<Plan[]> => {
    const response = await apiClient.get('/plans');
    return planListSchema.parse(response.data);
};

/** Cria um plano. Recusado com 403 para quem não é admin. */
export const createPlan = async (data: PlanCreateInput): Promise<Plan> => {
    const response = await apiClient.post('/plans', data);
    return planSchema.parse(response.data);
};

/** Edita nome, preço, descrição ou ativação de um plano existente. */
export const updatePlan = async (
    planId: string,
    data: PlanUpdateInput,
): Promise<Plan> => {
    const response = await apiClient.patch(`/plans/${planId}`, data);
    return planSchema.parse(response.data);
};

/**
 * Re-envia ao provedor de cobrança o preço atual de cada assinatura do plano
 * (Fase 10). Permissão de admin; o resultado são três contagens.
 */
export const resyncPlanPrices = async (planId: string): Promise<PriceSyncResponse> => {
    const response = await apiClient.post(`/plans/${planId}/sync-prices`);
    return priceSyncResponseSchema.parse(response.data);
};
