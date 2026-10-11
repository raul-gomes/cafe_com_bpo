import React from 'react';
import { BadgeCheck, CreditCard, Sparkles } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { formatBRL } from '../../lib/formatters';
import type { Access } from '../../schemas/access';
import type { Plan } from '../../schemas/plans';

/**
 * Bloco de plano + ações da seção Pagamentos (Fase 9).
 *
 * Presentacional de propósito: quem decide o que aparece é o `PaymentsPage`,
 * que lê o `GET /access`; aqui entra só o estado atual e o catálogo, o que
 * torna o componente testável sem rede. Os gatilhos vêm do pai — `onSubscribe`
 * decide se pede dados de cobrança ou abre o checkout, `onCancel` abre o
 * diálogo de confirmação.
 *
 * Datas formatadas em UTC: `expires_at` e `grace_until` são meia-noite em UTC —
 * no fuso de São Paulo o mesmo instante cairia no dia anterior.
 */

const CYCLE_LABEL: Record<string, string> = {
    WEEKLY: 'semanal',
    BIWEEKLY: 'quinzenal',
    MONTHLY: 'mensal',
    BIMONTHLY: 'bimestral',
    QUARTERLY: 'trimestral',
    SEMIANNUALLY: 'semestral',
    YEARLY: 'anual',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
});

const formatDate = (iso: string): string => dateFormatter.format(new Date(iso));

const cycleDisplay = (cycle: string): string => CYCLE_LABEL[cycle] ?? cycle.toLowerCase();

interface SubscriptionStatusCardProps {
    /** Resumo do `GET /access` — o estado da conta decide o bloco renderizado. */
    access: Access;
    /** Catálogo de planos ativos, mostrado só para quem pode assinar (free/beta). */
    plans: Plan[] | undefined;
    /** `true` enquanto o catálogo carrega — mostra esqueleto em vez de pulo. */
    isCheckingPlans: boolean;
    /** `true` quando o usuário já salvou os dados de cobrança. */
    hasSavedProfile: boolean;
    /** Clique em "Assinar" de um plano do catálogo. */
    onSubscribe: (planId: string) => void;
    /** Clique em "Cancelar assinatura" do plano atual. */
    onCancel: () => void;
}

const CurrentPlanCard: React.FC<{
    access: Access;
    onCancel?: () => void;
}> = ({ access, onCancel }) => {
    const plan = access.plan;
    if (!plan) {
        return null;
    }
    return (
        <Card className="mb-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold">{plan.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Cobrança {cycleDisplay(plan.cycle)}
                        {access.expires_at ? ` · acesso até ${formatDate(access.expires_at)}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-extrabold text-primary-strong">
                        {formatBRL(Number(plan.price))}
                    </span>
                    {onCancel && (
                        <Button
                            variant="outline"
                            aria-label="Cancelar assinatura"
                            onClick={onCancel}
                        >
                            Cancelar assinatura
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
};

const SubscribeCatalog: React.FC<{
    access: Access;
    plans: Plan[] | undefined;
    isCheckingPlans: boolean;
    hasSavedProfile: boolean;
    onSubscribe: (planId: string) => void;
}> = ({ access, plans, isCheckingPlans, hasSavedProfile, onSubscribe }) => {
    const isBeta = access.access === 'beta';
    return (
        <Card className="mb-4 p-6">
            <div className="flex items-center gap-2">
                <Sparkles className="text-primary" size={18} />
                <h2 className="text-base font-semibold">
                    {isBeta ? 'Seu acesso beta está ativo' : 'Escolha seu plano'}
                </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
                {isBeta && access.expires_at ? (
                    <>
                        Antes do fim do beta, em{' '}
                        <strong>{formatDate(access.expires_at)}</strong>, não há cobrança: a
                        primeira fatura começa depois do período.
                    </>
                ) : hasSavedProfile ? (
                    'Confirme o plano e conclua o pagamento na página da Asaas.'
                ) : (
                    'Preencha os dados de cobrança abaixo e depois escolha o plano.'
                )}
            </p>

            {isCheckingPlans ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
            ) : plans && plans.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            className="flex flex-col justify-between rounded-lg border border-border p-4"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-semibold">{plan.name}</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Cobrança {cycleDisplay(plan.cycle)}
                                    </p>
                                    {plan.description && (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {plan.description}
                                        </p>
                                    )}
                                </div>
                                <span className="text-lg font-extrabold text-primary-strong">
                                    {formatBRL(Number(plan.price))}
                                </span>
                            </div>
                            <Button
                                className="mt-3 w-full"
                                aria-label={`Assinar ${plan.name}`}
                                onClick={() => onSubscribe(plan.id)}
                            >
                                <CreditCard size={16} /> Assinar
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                    Nenhum plano disponível no momento.
                </p>
            )}
        </Card>
    );
};

export const SubscriptionStatusCard: React.FC<SubscriptionStatusCardProps> = ({
    access,
    plans,
    isCheckingPlans,
    hasSavedProfile,
    onSubscribe,
    onCancel,
}) => {
    if (access.is_admin) {
        return (
            <Card className="mb-4 p-6">
                <div className="flex items-center gap-2">
                    <BadgeCheck className="text-primary-strong" size={18} />
                    <h2 className="text-base font-semibold">Conta de administrador</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    Você administra a plataforma — a assinatura da comunidade não se aplica
                    à sua conta.
                </p>
            </Card>
        );
    }

    if (access.access === 'past_due') {
        return (
            <>
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Pagamento em atraso</AlertTitle>
                    <AlertDescription>
                        Regularize a cobrança até{' '}
                        {access.grace_until ? (
                            <strong>{formatDate(access.grace_until)}</strong>
                        ) : (
                            'o fim do prazo de tolerância'
                        )}{' '}
                        para manter o acesso ao painel.
                    </AlertDescription>
                </Alert>
                <CurrentPlanCard access={access} />
            </>
        );
    }

    if (access.access === 'active') {
        return <CurrentPlanCard access={access} onCancel={onCancel} />;
    }

    return (
        <SubscribeCatalog
            access={access}
            plans={plans}
            isCheckingPlans={isCheckingPlans}
            hasSavedProfile={hasSavedProfile}
            onSubscribe={onSubscribe}
        />
    );
};