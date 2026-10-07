import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';

import { Alert, AlertAction, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';

/**
 * Convite para assinar exibido no topo do painel para quem está no plano free
 * (§5 Fase 10).
 *
 * Quem decide se ele aparece é o `PanelLayout`, que lê `access.access ===
 * 'free'`; o banner só guarda o próprio descarte. O descarte é por sessão: ele
 * sobrevive à navegação dentro do painel (o `PanelLayout` permanece montado) e
 * volta a aparecer num novo carregamento — deliberadamente em memória, sem
 * localStorage.
 */
export const UpsellBanner: React.FC = () => {
    const [visible, setVisible] = useState(true);

    if (!visible) {
        return null;
    }

    return (
        <Alert className="mb-4 border-primary/20 bg-primary/5 [&>svg]:text-primary dark:[&>svg]:text-primary">
            <Sparkles />
            <AlertTitle className="text-primary-strong">Você está no plano gratuito</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2 pr-14">
                <span>
                    A leitura é liberada em todos os módulos. Assinar abre a escrita também em
                    captar e gestão — seus dados ficam preservados.
                </span>
                <Button size="sm" render={<Link to="/painel/pagamentos" />}>
                    Assinar
                </Button>
            </AlertDescription>
            <AlertAction>
                <button
                    type="button"
                    aria-label="Fechar aviso"
                    onClick={() => setVisible(false)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <X className="size-4" />
                </button>
            </AlertAction>
        </Alert>
    );
};

export default UpsellBanner;