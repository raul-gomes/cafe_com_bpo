import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';

import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import type { Plan } from '../../schemas/plans';
import logo from '../../assets/logo.png';

const CYCLE_LABEL: Record<string, string> = {
    WEEKLY: '/semana',
    BIWEEKLY: '/quinzena',
    MONTHLY: '/mês',
    BIMONTHLY: '/bimestre',
    QUARTERLY: '/trimestre',
    SEMIANNUALLY: '/semestre',
    YEARLY: '/ano',
};

const formatBRL = (price: string): string => {
    const value = Number.parseFloat(price.replace(',', '.'));
    if (Number.isNaN(value)) {
        return price;
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

/** What the new user chose to do after signing up. */
export type SignupChoice = 'subscribe' | 'free';

interface SignupPlanOfferProps {
    /** Plano ativo do catálogo — é o "investimento" apresentado. */
    plan: Plan;
    /** Sobe a conta para o painel conforme a escolha (assinar ou gratuito). */
    onContinue: (choice: SignupChoice) => void;
}

/**
 * Oferta exibida logo após o cadastro de um novo usuário.
 *
 * Duas opções selecionáveis — "Assinar {plano}" (pré-selecionada) e "Continuar
 * no plano gratuito" — com um único botão "Continuar" que decide o destino.
 * Componente presentacional: quem decide o plano é o `RegisterModal` do login
 * (`usePlans`), então não há rede aqui. Não substitui o write gate — quem
 * continua no free vê os cadeados nas ações bloqueadas de captar/gestão.
 *
 * @returns The offer card.
 */
export const SignupPlanOffer: React.FC<SignupPlanOfferProps> = ({ plan, onContinue }) => {
    const [choice, setChoice] = useState<SignupChoice>('subscribe');
    const price = formatBRL(plan.price);
    const cycle = CYCLE_LABEL[plan.cycle] ?? `/${plan.cycle.toLowerCase()}`;

    return (
        <Card className="relative mx-auto w-full max-w-[768px]">
            <CardContent className="pt-7 px-8 pb-7">
                <div className="text-center mb-5">
                    <img src={logo} alt="Café com BPO" className="h-10 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-foreground mb-1">Conta criada</h2>
                    <p className="text-sm text-muted-foreground">
                        Bem-vindo à plataforma. Escolha como quer começar — dá para mudar depois.
                    </p>
                </div>

                <div className="flex flex-col gap-3" role="radiogroup" aria-label="Escolha do plano">
                    <button
                        type="button"
                        role="radio"
                        aria-checked={choice === 'subscribe'}
                        onClick={() => setChoice('subscribe')}
                        className={`w-full rounded-lg border p-4 text-left transition-colors ${
                            choice === 'subscribe'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-border hover:border-primary/40'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <Sparkles size={16} className="text-primary-strong" /> Assinar {plan.name}
                                </p>
                                <p className="mt-1 text-[22px] font-extrabold text-primary-strong leading-tight">
                                    {price}
                                    <span className="text-sm font-medium text-muted-foreground">{cycle}</span>
                                </p>
                            </div>
                            <span
                                className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                                    choice === 'subscribe' ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                                }`}
                                aria-hidden="true"
                            >
                                {choice === 'subscribe' && <Check size={13} />}
                            </span>
                        </div>
                        <ul className="mt-3 space-y-1 text-[13px] text-foreground/90">
                            <li className="flex items-center gap-2">
                                <Check className="size-4 text-primary-strong" /> Escrita liberada em Captar e Gestão
                            </li>
                            <li className="flex items-center gap-2">
                                <Check className="size-4 text-primary-strong" /> Seus dados ficam preservados
                            </li>
                        </ul>
                    </button>

                    <button
                        type="button"
                        role="radio"
                        aria-checked={choice === 'free'}
                        onClick={() => setChoice('free')}
                        className={`w-full rounded-lg border p-4 text-left transition-colors ${
                            choice === 'free'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-border hover:border-primary/40'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">Continuar no plano gratuito</p>
                            <span
                                className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                                    choice === 'free' ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                                }`}
                                aria-hidden="true"
                            >
                                {choice === 'free' && <Check size={13} />}
                            </span>
                        </div>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                            Leitura liberada em todos os módulos. Assine quando quiser pela tela de Pagamentos.
                        </p>
                    </button>
                </div>

                <div className="mt-6 flex flex-col gap-2">
                    <Button className="w-full" onClick={() => onContinue(choice)}>
                        Continuar
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default SignupPlanOffer;
