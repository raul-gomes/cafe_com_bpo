import React from 'react';
import { AtmosphereGrid } from '../../brand/AtmospherePicker';

/** Gestão › Configurações. Por enquanto só Aparência; outras preferências entram aqui. */
export const ConfiguracoesPage: React.FC = () => (
  <div className="mx-auto max-w-[1080px]">
    <header className="mb-[32px]">
      <p className="text-xs font-bold uppercase tracking-[0.11em] text-muted-foreground">Gestão</p>
      <h1 className="mt-[6px] font-editorial text-[2.25rem] font-medium leading-tight tracking-[-0.02em] text-foreground">
        Configurações
      </h1>
    </header>

    <section aria-labelledby="aparencia-titulo" className="rounded-lg border border-border bg-card p-[clamp(20px,3vw,32px)]">
      <h2 id="aparencia-titulo" className="text-lg font-bold text-foreground">Aparência</h2>
      <p className="mb-[20px] mt-[4px] text-[0.9375rem] text-muted-foreground">
        Escolha a família de cor e a luz do painel. Cada área (Operacional, Captar, Comunidade, Gestão)
        mantém a própria cor de orientação em qualquer atmosfera. A escolha fica salva neste navegador.
      </p>
      <AtmosphereGrid />
    </section>
  </div>
);
