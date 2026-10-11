import { z } from 'zod';

/**
 * Contrato de payload da Governança (regra §6).
 *
 * Os tipos viviam em `api/governanca.ts` como interfaces escritas à mão, então o
 * TypeScript conferia o palpite do autor contra ele mesmo. Saiu de lá na migração
 * para `companies` porque o payload mudou de verdade: a tag deixou de ser do
 * negócio e passou a ser do mês (`appearances`), e com ela `status`,
 * `reference_date` e `client_id` saíram do `Deal`.
 *
 * `.strict()` porque o Zod **descarta** chaves desconhecidas: sem ele, um campo
 * que voltasse a ser enviado entraria em silêncio e o `parse` viraria decorativo.
 */

/** Um mês em que o negócio aparece, e a tag que ele carrega naquele mês. */
const dealAppearanceSchema = z
    .object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        status: z.enum(['conquistado', 'em_negociacao', 'perdido']),
    })
    .strict();

/** Último orçamento do negócio. `client_name` saiu: a tela mostra o nome do
 *  negócio, e o do orçamento é o mesmo texto duplicado. */
const dealProposalSchema = z
    .object({
        id: z.string(),
        number: z.number().nullable().optional(),
        final_price: z.number().nullable().optional(),
        created_at: z.string().nullable().optional(),
    })
    .strict();

/** Contrato relevante (finalizado, ou o mais recente). `finalized_at` e
 *  `created_at` entram porque a linha do tempo usa a data real. */
const dealContractSchema = z
    .object({
        id: z.string(),
        number: z.number().nullable().optional(),
        status: z.string(),
        finalized_at: z.string().nullable().optional(),
        created_at: z.string().nullable().optional(),
    })
    .strict();

/** Evento da linha do tempo do funil. `mock` marca o "Aguardando aprovação",
 *  que é placeholder e não tem data por isso. */
const timelineEventSchema = z
    .object({
        type: z.enum([
            'created',
            'sent',
            'approved',
            'rejected',
            'changes',
            'pending',
        ]),
        label: z.string(),
        date: z.string().nullable().optional(),
        mock: z.boolean().optional(),
    })
    .strict();

export const dealSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        cnpj: z.string().nullable().optional(),
        segment: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        representante_nome: z.string().nullable().optional(),
        representante_cargo: z.string().nullable().optional(),
        representante_email: z.string().nullable().optional(),
        representante_telefone: z.string().nullable().optional(),
        representante_cpf: z.string().nullable().optional(),
        appearances: z.array(dealAppearanceSchema),
        proposal: dealProposalSchema.nullable().optional(),
        contract: dealContractSchema.nullable().optional(),
        timeline: z.array(timelineEventSchema),
    })
    .strict();

export const governancaResponseSchema = z
    .object({
        months: z.array(z.string()),
        deals: z.array(dealSchema),
    })
    .strict();

export type DealAppearance = z.infer<typeof dealAppearanceSchema>;
export type DealProposal = z.infer<typeof dealProposalSchema>;
export type DealContract = z.infer<typeof dealContractSchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type Deal = z.infer<typeof dealSchema>;
export type GovernancaResponse = z.infer<typeof governancaResponseSchema>;
export type DealStatus = DealAppearance['status'];
