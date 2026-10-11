import React from 'react';

import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { formatBRL } from '../../lib/formatters';
import type { BillingHistoryRow } from '../../schemas/subscription';

/**
 * Histórico mês a mês do assinante (bloco de baixo da seção Pagamentos, Fase 9).
 *
 * O servidor devolve só o que a tela mostra — `{id, cycle_month, amount, status,
 * paid_at, invoice_url}` — e o mês chega como "2026-09". O rótulo "setembro
 * 2026" nasce aqui com `Intl` em pt-BR, montado a partir de um `Date.UTC` para
 * não deslocar o mês com o fuso. `paid_at` é exibido no fuso do assinante
 * (`America/Sao_Paulo`), pois é um instante real, não uma meia-noite.
 */

const STATUS_META: Record<string, { label: string; className: string }> = {
    confirmed: { label: 'Pago', className: 'text-emerald-600 dark:text-emerald-400' },
    received: { label: 'Pago', className: 'text-emerald-600 dark:text-emerald-400' },
    overdue: { label: 'Vencido', className: 'text-destructive' },
    refunded: { label: 'Reembolsado', className: 'text-amber-600 dark:text-amber-400' },
    pending: { label: 'Pendente', className: 'text-muted-foreground' },
    deleted: { label: 'Cancelado', className: 'text-muted-foreground' },
};

const monthNameOf = (cycleMonth: string): string => {
    const [year, month] = cycleMonth.split('-').map(Number);
    const name = new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1)));
    return `${name} ${year}`;
};

const paidAtLabel = (iso: string): string =>
    new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso));

interface BillingHistoryListProps {
    /** Linhas de cobrança do `GET /payments/`, do mês mais recente para o mais antigo. */
    rows: BillingHistoryRow[] | undefined;
    /** `true` enquanto a lista carrega — esqueleto no lugar da lista. */
    isLoading: boolean;
}

export const BillingHistoryList: React.FC<BillingHistoryListProps> = ({ rows, isLoading }) => {
    if (isLoading) {
        return (
            <Card className="p-6">
                <Skeleton className="mb-2 h-4 w-44" />
                <Skeleton className="h-3 w-72" />
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <h2 className="text-base font-semibold">Histórico mês a mês</h2>
            {!rows || rows.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                    Você ainda não tem cobranças. Ao assinar, o histórico aparece aqui mês a
                    mês.
                </p>
            ) : (
                <ul className="mt-3 flex flex-col gap-2">
                    {rows.map((row) => {
                        const status =
                            STATUS_META[row.status] ?? {
                                label: row.status,
                                className: 'text-muted-foreground',
                            };
                        return (
                            <li
                                key={row.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
                            >
                                <div>
                                    <div className="text-sm font-semibold">
                                        {row.cycle_month
                                            ? monthNameOf(row.cycle_month)
                                            : 'Cobrança avulsa'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {row.paid_at
                                            ? `Pago em ${paidAtLabel(row.paid_at)}`
                                            : 'Não pago'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span
                                        data-testid="history-amount"
                                        className="text-base font-extrabold text-primary-strong"
                                    >
                                        {formatBRL(Number(row.amount))}
                                    </span>
                                    <span className={`text-xs font-semibold ${status.className}`}>
                                        {status.label}
                                    </span>
                                    {row.invoice_url && (
                                        <a
                                            href={row.invoice_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-medium text-primary-strong underline underline-offset-3"
                                        >
                                            Ver fatura
                                        </a>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
};