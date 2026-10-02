import { describe, expect, it } from 'vitest';

import { dealInMonth, dealsByMonth } from '../src/pages/panel/governancaMonth';

/**
 * Regra do dono (2026-10-01): um negócio aparece no mês em que começou a
 * prospecção, com a tag `em_negociacao`, e no mês em que fechou, com a tag
 * `conquistado`. O mesmo negócio, em dois cards, com a tag de cada época.
 *
 * O cálculo mora aqui e não na página porque ele é regra de negócio: a página
 * só escolhe o mês ativo e filtra o que a pessoa está olhando.
 */

const CONVERTIDO = {
    id: 'c-1',
    name: 'Fechou Depois',
    appearances: [
        { month: '2026-03', status: 'em_negociacao' as const },
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
    it('devolve o negócio nos dois meses com a tag de cada um', () => {
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
        expect(dealInMonth(CONVERTIDO, '2026-04')).toBeNull();
    });

    it('agrupa por mês preservando a ordem de aparição', () => {
        const porMes = dealsByMonth([CONVERTIDO, ABERTO, PERDIDO]);
        expect(Object.keys(porMes)).toEqual(['2026-03', '2026-05', '2026-04', '2026-06']);
        expect(porMes['2026-03']?.map(d => d.name)).toEqual(['Fechou Depois']);
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
