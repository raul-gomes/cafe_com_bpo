import { Deal, DealStatus } from '../../api/governanca';

/**
 * Um negócio no mês que a pessoa está olhando: o `Deal` mais o mês e a tag
 * daquele mês.
 */
export interface DealNoMes extends Deal {
    month: string;
    status: DealStatus;
}

/**
 * O negócio como ele aparece em um mês específico, ou `null` se não aparece.
 *
 * Regra do dono (2026-10-01): o negócio capturado aparece no mês da prospecção
 * como `em_negociacao` e no mês do fechamento como `conquistado`. A tag é do mês,
 * não do negócio — por isso a resposta carrega o `status` junto do `month`, e a
 * página nunca lê um status "do negócio".
 */
export function dealInMonth(deal: Deal, month: string): DealNoMes | null {
    const aparicoes = deal.appearances.filter(a => a.month === month);
    if (aparicoes.length === 0) return null;
    // Mais de uma aparição no mesmo mês não deveria chegar (o backend colapsa),
    // mas se chegar, a última é o estado final do mês — e um negócio não pode
    // virar dois cards, nem contar dobrado no resumo do mês.
    const aparicao = aparicoes[aparicoes.length - 1];
    return { ...deal, month: aparicao.month, status: aparicao.status };
}

/**
 * Todos os negócios agrupados por mês, para a barra de meses e para a lista do
 * mês ativo saírem da mesma fonte.
 *
 * A ordem de inserção segue a ordem das aparições, e não é reordenada: a página
 * filtra pelo mês ativo, e o agrupamento só precisa ser estável.
 */
export function dealsByMonth(deals: Deal[]): Record<string, DealNoMes[]> {
    const porMes: Record<string, DealNoMes[]> = {};
    for (const deal of deals) {
        // Itera meses **únicos**, e não aparições: um negócio com duas
        // aparições no mesmo mês entraria duas vezes na lista e contaria dobrado
        // no resumo. `dealInMonth` já resolve a tag vencedora.
        for (const mes of new Set(deal.appearances.map(a => a.month))) {
            const noMes = dealInMonth(deal, mes);
            if (noMes === null) continue;
            porMes[mes] = [...(porMes[mes] ?? []), noMes];
        }
    }
    return porMes;
}
