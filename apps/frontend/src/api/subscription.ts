import { apiClient } from './client';

import {
    billingProfileSchema,
    billingHistoryListSchema,
    cancelResponseSchema,
    checkoutResponseSchema,
    type BillingDataInput,
    type BillingHistoryRow,
    type BillingProfile,
    type CancelResponse,
    type CheckoutResponse,
} from '../schemas/subscription';

/**
 * O contrato vive em `schemas/subscription.ts`, com validação em runtime: o tipo
 * sai do schema pelo `z.infer`, então a tela e o servidor não divergem sem que o
 * teste acuse. Nenhum endpoint destes devolve o ORM — as respostas são DTOs
 * escritos à mão no backend e aqui validadas campo a campo.
 */

/** Dados de cobrança salvos para a sessão atual; `null` quando nunca salvos (404). */
export const getBillingProfile = async (): Promise<BillingProfile> => {
    const response = await apiClient.get('/subscriptions/billing');
    return billingProfileSchema.parse(response.data);
};

/** Grava/atualiza os dados de cobrança usados pelo checkout da Asaas. */
export const saveBillingProfile = async (data: BillingDataInput): Promise<BillingProfile> => {
    const response = await apiClient.put('/subscriptions/billing', data);
    return billingProfileSchema.parse(response.data);
};

/** Abre a sessão de checkout: resposta com o link da página de cartão da Asaas. */
export const openCheckout = async (planId: string): Promise<CheckoutResponse> => {
    const response = await apiClient.post('/subscriptions/checkout', { plan_id: planId });
    return checkoutResponseSchema.parse(response.data);
};

/** Cancela a assinatura; o mês já pago continua valendo (§17.5). */
export const cancelSubscription = async (): Promise<CancelResponse> => {
    const response = await apiClient.post('/subscriptions/cancel');
    return cancelResponseSchema.parse(response.data);
};

/** Histórico de cobranças da assinatura, do mês mais recente para o mais antigo. */
export const listBillingHistory = async (): Promise<BillingHistoryRow[]> => {
    const response = await apiClient.get('/payments/');
    return billingHistoryListSchema.parse(response.data);
};