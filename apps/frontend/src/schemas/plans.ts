import { z } from 'zod';

/**
 * Contrato do catálogo de planos (`GET/POST/PATCH /plans`).
 *
 * O preço é **string** e não número: o banco guarda `NUMERIC(12,2)` e o backend
 * devolve `str(price)`, o mesmo formato de `GET /access`. Se este arquivo
 * declarasse `number`, a tela passaria a arredondar por conta própria e o preço
 * mostrado no Config poderia divergir do preço cobrado.
 *
 * `.strict()` porque o Zod **descarta** chaves desconhecidas: sem ele, um campo
 * que voltasse a ser enviado entraria em silêncio e o `parse` viraria decorativo.
 */

/** Uma linha do catálogo, como a tela de Config renderiza. */
export const planSchema = z
    .object({
        id: z.string(),
        code: z.string(),
        name: z.string(),
        price: z.string(),
        cycle: z.string(),
        is_active: z.boolean(),
        description: z.string().nullable(),
        subscriber_count: z.number(),
    })
    .strict();

/** A lista inteira é validada como lista, senão um objeto solto passa. */
export const planListSchema = z.array(planSchema);

/**
 * Resposta de `POST /plans/{id}/sync-prices` (Fase 10).
 *
 * O admin re-passa o preço atual de cada assinatura ao provedor de cobrança. O
 * resultado é exatamente três contagens — não há status persistente por plano;
 * a tela de Config renderiza os contadores do último sync.
 */
export const priceSyncResponseSchema = z
    .object({
        synced: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
    })
    .strict();

/** Campos que o admin pode editar depois que o plano existe (§17.1). */
export const planUpdateSchema = z
    .object({
        name: z.string().min(2, 'O nome precisa de ao menos 2 caracteres.').max(150).optional(),
        price: z
            .string()
            .regex(/^\d+([.,]\d{1,2})?$/, 'Informe um valor como 27,90.')
            .optional(),
        description: z.string().max(500).nullable().optional(),
        is_active: z.boolean().optional(),
    })
    .strict();

/** Campos da criação. `code` e `cycle` são imutáveis depois disso. */
export const planCreateSchema = planUpdateSchema
    .extend({
        code: z
            .string()
            .min(2, 'O código precisa de ao menos 2 caracteres.')
            .max(50)
            .regex(
                /^[a-z0-9][a-z0-9_-]*$/,
                'Use apenas letras minúsculas, números, hífen e underscore.',
            ),
        cycle: z.enum([
            'WEEKLY',
            'BIWEEKLY',
            'MONTHLY',
            'BIMONTHLY',
            'QUARTERLY',
            'SEMIANNUALLY',
            'YEARLY',
        ]),
    })
    .strict();

export type Plan = z.infer<typeof planSchema>;
export type PlanCreateInput = z.infer<typeof planCreateSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
export type PriceSyncResponse = z.infer<typeof priceSyncResponseSchema>;
