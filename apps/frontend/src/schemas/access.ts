import { z } from 'zod';

/**
 * Contrato do `GET /access` — a tela que lê permissão de módulo, vencimento e
 * banners (D12/§17.6).
 *
 * `.strict()` porque o Zod **descarta** chaves desconhecidas: sem ele, um campo
 * interno que voltasse a ser enviado entraria em silêncio e o `parse` viraria
 * decorativo. A chave `shows_beta_banner` é obrigatória de propósito — o aviso
 * do painel nasce dela, e sumir da resposta é uma deriva de contrato, não um
 * default seguro.
 */

/** Resumo do plano como `GET /access` devolve para o card de pagamento. */
const planSummarySchema = z
    .object({
        code: z.string(),
        name: z.string(),
        price: z.string(),
        cycle: z.string(),
    })
    .strict();

export const accessSchema = z
    .object({
        access: z.string(),
        read_only_modules: z.array(z.string()),
        writable_modules: z.array(z.string()),
        expires_at: z.string().nullable(),
        grace_until: z.string().nullable(),
        shows_dunning_banner: z.boolean(),
        shows_beta_banner: z.boolean(),
        subscription_status: z.string().nullable(),
        plan: planSummarySchema.nullable(),
        is_admin: z.boolean(),
    })
    .strict();

/** Payload completo de `GET /access`, inferido do schema. */
export type Access = z.infer<typeof accessSchema>;
