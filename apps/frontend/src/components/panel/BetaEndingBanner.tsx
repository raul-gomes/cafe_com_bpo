import React from 'react';
import { Hourglass } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

/**
 * Aviso de fim de beta no painel (D12/§17.6) — a metade em tempo real do aviso
 * por e-mail. Presentacional de propósito: quem decide se ele aparece é o
 * `PanelLayout`, que lê `shows_beta_banner` do `GET /access`; aqui entra só a
 * data, o que torna o componente testável sem rede.
 *
 * A data é formatada **em UTC** porque `expires_at` é meia-noite em UTC: no
 * fuso de São Paulo o mesmo instante cairia no dia anterior e o banner
 * mostraria uma data diferente do e-mail para o mesmo fim.
 */
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
});

interface BetaEndingBannerProps {
    /** `expires_at` em ISO/UTC, como o `GET /access` devolve. */
    expiresAt: string;
}

export const BetaEndingBanner: React.FC<BetaEndingBannerProps> = ({ expiresAt }) => (
    <Alert className="mb-4 border-amber-500/15 bg-amber-500/5 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
        <Hourglass />
        <AlertTitle className="text-amber-600 dark:text-amber-400">
            Seu acesso beta está terminando
        </AlertTitle>
        <AlertDescription>
            Seu período beta termina em {dateFormatter.format(new Date(expiresAt))}.
            Quem já tem assinatura ativa não perde nada; sem assinatura, a conta passa
            para o plano free, com tudo preservado e leitura liberada.
        </AlertDescription>
    </Alert>
);
