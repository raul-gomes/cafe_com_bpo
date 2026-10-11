import { z } from 'zod';

/**
 * Contrato das chamadas de assinatura (Fase 9 da seção Pagamentos).
 *
 * O plano do produto é de três blocos na tela: o plano + as ações (assinar ou
 * cancelar), os dados de cobrança (`PUT/GET /subscriptions/billing`) e o
 * histórico mês a mês (`GET /payments/`). Cada bloco vive de um schema abaixo;
 * o `.strict()` está em todos porque o Zod **descarta** chaves desconhecidas —
 * sem ele, um campo interno que voltasse a ser enviado entraria em silêncio e o
 * `parse` viraria decorativo.
 *
 * Dinheiro atravessa como string e não como número: o banco guarda
 * `NUMERIC(12,2)`, o backend devolve `str(price)` e o Zod rejeita float, para a
 * tela nunca arredondar o valor cobrado por conta própria.
 */

/** Corpo do `PUT /subscriptions/billing` — as máscaras do formulário geram dígitos. */
export const billingDataSchema = z
    .object({
        cpf_cnpj: z
            .string()
            .regex(/^\d{11}$|^\d{14}$/, 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).'),
        phone: z.string().regex(/^\d{10,11}$/, 'Informe o telefone com DDD, apenas números.'),
        address: z.string().min(3, 'Informe o endereço completo.').max(200),
        address_number: z.string().min(1, 'Informe o número.').max(20),
        complement: z.string().max(120).nullable().optional(),
        city: z.string().min(2, 'Informe a cidade.').max(100),
        state: z
            .string()
            .length(2, 'Use a sigla do estado, como SP.')
            .regex(/^[A-Z]{2}$/, 'Use a sigla do estado, como SP.'),
        postal_code: z.string().regex(/^\d{8}$/, 'Informe o CEP com 8 dígitos.'),
    })
    .strict();

/** Resposta do `GET/PUT /subscriptions/billing` — os oito campos que o formulário lê. */
export const billingProfileSchema = z
    .object({
        cpf_cnpj: z.string(),
        phone: z.string(),
        address: z.string(),
        address_number: z.string(),
        complement: z.string().nullable(),
        city: z.string(),
        state: z.string(),
        postal_code: z.string(),
    })
    .strict();

/** Resposta do `POST /subscriptions/checkout` — só o que a tela mostra (§17.2). */
export const checkoutResponseSchema = z
    .object({
        link: z.string(),
        plan_name: z.string(),
        price: z.string(),
        cycle: z.string(),
        status: z.string(),
    })
    .strict();

/** Resposta do `POST /subscriptions/cancel` — até quando o acesso fica (§17.5). */
export const cancelResponseSchema = z
    .object({
        current_period_end: z.string().nullable(),
    })
    .strict();

/** Uma linha de cobrança do histórico mês a mês (`GET /payments/`). */
export const billingHistoryRowSchema = z
    .object({
        id: z.string(),
        cycle_month: z.string().nullable(),
        amount: z.string(),
        status: z.string(),
        paid_at: z.string().nullable(),
        invoice_url: z.string().nullable(),
    })
    .strict();

/** A lista inteira é validada como lista, senão um objeto solto passa. */
export const billingHistoryListSchema = z.array(billingHistoryRowSchema);

export type BillingDataInput = z.infer<typeof billingDataSchema>;
export type BillingProfile = z.infer<typeof billingProfileSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
export type CancelResponse = z.infer<typeof cancelResponseSchema>;
export type BillingHistoryRow = z.infer<typeof billingHistoryRowSchema>;