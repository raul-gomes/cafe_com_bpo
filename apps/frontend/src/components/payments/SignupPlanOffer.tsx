import React from 'react';
import { Link } from 'react-router-dom';
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

interface SignupPlanOfferProps {
    /** Plano ativo do catálogo — é o "investimento" apresentado. */
    plan: Plan;
    /** Sobe a conta para o painel sem assinar (plano gratuito). */
    onContinue: () => void;
}

/**
 * Oferta exibida logo após o cadastro de um novo usuário.
 *
 * Mostra o investimento do plano ativo (preço + ciclo) com o CTA de assinatura
 * e a alternativa explícita de continuar sem assinar. Componente presentacional:
 * quem decide o plano é o `RegisterModal` do login (`usePlans`), então não há
 * rede aqui — e o destino de "Continuar sem assinar" é o gestor de tarefas.
 * Não substitui o write gate — quem continua no free vê os cadeados nas ações
 * bloqueadas de captar/gestão.
 */
export const SignupPlanOffer: React.FC<SignupPlanOfferProps> = ({ plan, onContinue }) => {
    const price = formatBRL(plan.price);
    const cycle = CYCLE_LABEL[plan.cycle] ?? `/${plan.cycle.toLowerCase()}`;

    return (
        <Card className="relative mx-auto w-full max-w-[768px]">
            <CardContent className="pt-7 px-8 pb-7">
                <div className="text-center mb-5">
                    <img src={logo} alt="Café com BPO" className="h-10 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-foreground mb-1">Conta criada</h2>
                    <p className="text-sm text-muted-foreground">
                        Bem-vindo à plataforma. Seu espaço já está pronto no plano gratuito — leitura
                        liberada em todos os módulos.
                    </p>
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-sm text-muted-foreground">Investimento</p>
                            <p className="text-[22px] font-extrabold text-primary-strong leading-tight">
                                {price}
                                <span className="text-sm font-medium text-muted-foreground">{cycle}</span>
                            </p>
                        </div>
                        <span className="text-primary-strong">
                            <Sparkles size={24} />
                        </span>
                    </div>
                    {plan.description && (
                        <p className="mt-2 text-[13px] text-muted-foreground">{plan.description}</p>
                    )}
                    <ul className="mt-3 space-y-1 text-[13px] text-foreground/90">
                        <li className="flex items-center gap-2">
                            <Check className="size-4 text-primary-strong" /> Escrita liberada em Captar e Gestão
                        </li>
                        <li className="flex items-center gap-2">
                            <Check className="size-4 text-primary-strong" /> Seus dados ficam preservados
                        </li>
                    </ul>
                </div>

                <div className="mt-6 flex flex-col gap-2">
                    <Link to="/painel/pagamentos">
                        <Button className="w-full">Assinar {plan.name}</Button>
                    </Link>
                    <Button variant="outline" className="w-full" onClick={onContinue}>
                        Continuar sem assinar
                    </Button>
                </div>

                <p className="mt-4 text-center text-[12px] text-muted-foreground">
                    Sem fidelidade: assine quando quiser pela tela de Pagamentos.
                </p>
            </CardContent>
        </Card>
    );
};

export default SignupPlanOffer;