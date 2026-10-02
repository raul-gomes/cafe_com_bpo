import { describe, expect, it } from 'vitest';

import { dealSchema, governancaResponseSchema } from '../src/schemas/governanca';

/**
 * Contrato de payload da Governança (regra §6).
 *
 * A migração para `companies` trocou a identidade do negócio e, com ela, o
 * formato do payload: a tag deixou de ser do negócio e passou a ser do mês. Este
 * teste trava o que a tela consome e impede que os campos que saíram voltem por
 * descuido — `status`, `reference_date` e `client_id` não são mais lidos por
 * ninguém.
 */

const DEAL = {
    id: 'c-1',
    name: 'Fechou Depois',
    cnpj: '39123456000180',
    appearances: [
        { month: '2026-03', status: 'em_negociacao' },
        { month: '2026-05', status: 'conquistado' },
    ],
    proposal: { id: 'p-1', number: 1, final_price: 8990, created_at: '2026-03-02T09:00:00' },
    contract: {
        id: 'c-1',
        number: 12,
        status: 'finalized',
        finalized_at: '2026-05-15T10:00:00',
        created_at: '2026-05-15T09:00:00',
    },
    timeline: [
        { type: 'created', label: 'Prospecção iniciada', date: '2026-03-01T09:00:00' },
        { type: 'approved', label: 'Proposta aprovada', date: '2026-05-15T10:00:00' },
    ],
};

describe('contrato da Governança', () => {
    it('aceita o negócio nos dois meses, com a tag de cada um', () => {
        expect(dealSchema.parse(DEAL)).toEqual(DEAL);
    });

    it('rejeita os campos que saíram do negócio', () => {
        for (const extra of [
            { status: 'conquistado' },
            { reference_date: '2026-03-01T09:00:00' },
            { client_id: 'c-1' },
        ]) {
            expect(() => dealSchema.parse({ ...DEAL, ...extra })).toThrow();
        }
    });

    it('rejeita a tag de mês que a tela não conhece', () => {
        expect(() =>
            dealSchema.parse({
                ...DEAL,
                appearances: [{ month: '2026-03', status: 'negocio_fechado' }],
            }),
        ).toThrow();
    });

    it('rejeita mês fora do formato, que quebraria o filtro da barra de meses', () => {
        for (const month of ['2026-3', '03/2026', '2026-03-01']) {
            expect(() =>
                dealSchema.parse({
                    ...DEAL,
                    appearances: [{ month, status: 'perdido' }],
                }),
            ).toThrow();
        }
    });

    it('rejeita evento de timeline fora do vocabulário da coluna do tempo', () => {
        expect(() =>
            dealSchema.parse({
                ...DEAL,
                timeline: [{ type: 'closed', label: 'Fechado' }],
            }),
        ).toThrow();
    });

    it('aceita a resposta com a barra de meses', () => {
        const resposta = { months: ['2026-05', '2026-03'], deals: [DEAL] };
        expect(governancaResponseSchema.parse(resposta)).toEqual(resposta);
    });

    it('aceita o negócio sem os documentos e sem a linha do tempo', () => {
        const sem_docs = {
            id: 'p-9',
            name: 'Só Prospecção',
            appearances: [{ month: '2026-04', status: 'em_negociacao' }],
            timeline: [],
        };
        expect(() => dealSchema.parse(sem_docs)).not.toThrow();
    });
});
