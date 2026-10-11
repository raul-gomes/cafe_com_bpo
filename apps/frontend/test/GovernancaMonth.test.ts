import { describe, expect, it } from 'vitest';

import { dealInMonth, dealsByMonth } from '../src/pages/panel/governancaMonth';

/**
 * Regra do dono (2026-10-01, ampliada em 2026-10-02): um negócio ocupa **todos os
 * meses em que esteve em negociação**, do mês da prospecção até o fechamento, e —
 * se ainda estiver aberto — até o mês corrente. Quem fecha leva a tag do
 * desfecho no mês em que fechou; os meses anteriores ficam `em_negociacao`.
 *
 * O cálculo mora aqui e não na página porque ele é regra de negócio: a página
 * só escolhe o mês ativo e filtra o que a pessoa está olhando.
 */

const CONVERTIDO = {
    id: 'c-1',
    name: 'Fechou Depois',
    appearances: [
        { month: '2026-03', status: 'em_negociacao' as const },
        { month: '2026-04', status: 'em_negociacao' as const },
        { month: '2026-05', status: 'conquistado' as const },
    ],
    timeline: [],
};

const ABERTO = {
    id: 'p-1',
    name: 'Segue Negociando',
    appearances: [{ month: '2026-04', status: 'em_negociacao' as const }],
    timeline: [],
};

const PERDIDO = {
    id: 'p-2',
    name: 'Foi Perdido',
    appearances: [{ month: '2026-06', status: 'perdido' as const }],
    timeline: [],
};

describe('negócio por mês na Governança', () => {
    it('devolve o negócio nos meses em que esteve aberto, com a tag de cada um', () => {
        expect(dealInMonth(CONVERTIDO, '2026-03')).toMatchObject({
            month: '2026-03',
            status: 'em_negociacao',
        });
        expect(dealInMonth(CONVERTIDO, '2026-05')).toMatchObject({
            month: '2026-05',
            status: 'conquistado',
        });
    });

    it('não devolve o negócio em mês em que ele não aparece', () => {
        expect(dealInMonth(CONVERTIDO, '2026-02')).toBeNull();
        expect(dealInMonth(CONVERTIDO, '2026-06')).toBeNull();
    });

    it('um negócio ainda aberto aparece no mês corrente em negociação', () => {
        const correndo = {
            ...ABERTO,
            appearances: [
                { month: '2026-09', status: 'em_negociacao' as const },
                { month: '2026-10', status: 'em_negociacao' as const },
            ],
        };
        expect(dealInMonth(correndo, '2026-10')).toMatchObject({
            month: '2026-10',
            status: 'em_negociacao',
        });
    });

    it('agrupa por mês preservando a ordem de aparição', () => {
        const porMes = dealsByMonth([CONVERTIDO, ABERTO, PERDIDO]);
        expect(Object.keys(porMes)).toEqual([
            '2026-03',
            '2026-04',
            '2026-05',
            '2026-06',
        ]);
        expect(porMes['2026-03']?.map(d => d.name)).toEqual(['Fechou Depois']);
        // Abril é mês de conversa dos dois: o convertido segue em negociação e
        // o aberto também aparece — é a regra de "todos os meses até fechar".
        expect(porMes['2026-04']?.map(d => d.name)).toEqual([
            'Fechou Depois',
            'Segue Negociando',
        ]);
        expect(porMes['2026-05']?.map(d => d.name)).toEqual(['Fechou Depois']);
    });

    it('não devolve o mesmo negócio duas vezes no mesmo mês', () => {
        // Cenário de defesa: o backend colapsa isso, mas a tela não pode
        // duplicar card se algum dia chegar assim — contaria dobrado no resumo.
        const duplicado = {
            ...CONVERTIDO,
            appearances: [
                { month: '2026-03', status: 'em_negociacao' as const },
                { month: '2026-03', status: 'conquistado' as const },
            ],
        };
        const porMes = dealsByMonth([duplicado]);
        expect(porMes['2026-03']).toHaveLength(1);
        // E a tag vencedora é a última: o estado final do mês.
        expect(porMes['2026-03']?.[0]?.status).toBe('conquistado');
    });

    it('um negócio sem aparições não aparece em nenhum mês', () => {
        expect(dealsByMonth([{ ...ABERTO, appearances: [] }])).toEqual({});
    });
});
