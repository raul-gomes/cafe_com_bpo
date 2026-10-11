import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ModeChoice } from '../../brand/ModeChoice';
import { PerfilPage } from './PerfilPage';
import { cn } from '../../lib/utils';

const TABS = [
  { id: 'perfil', label: 'Meu perfil' },
  { id: 'aparencia', label: 'Aparência' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Gestão › Configurações: perfil (mesma tela de /painel/perfil) e aparência. */
export const ConfiguracoesPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('aba') === 'aparencia' ? 'aparencia' : 'perfil';

  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-[24px]">
        <p className="text-xs font-bold uppercase tracking-[0.11em] text-module">Gestão</p>
        <h1 className="mt-[6px] font-editorial text-[2.25rem] font-medium leading-tight tracking-[-0.02em] text-foreground">
          Configurações
        </h1>
      </header>

      <div className="mb-[28px] flex gap-[4px] border-b border-input" role="tablist" aria-label="Configurações">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setParams(item.id === 'perfil' ? {} : { aba: item.id }, { replace: true })}
            className={cn('panel-module-tab h-auto px-[18px] py-[10px] text-[0.9375rem] font-semibold', 'flex-none')}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'perfil' ? (
        <PerfilPage />
      ) : (
        <section aria-labelledby="aparencia-titulo" className="rounded-lg border border-border bg-card p-[clamp(20px,3vw,32px)]">
          <h2 id="aparencia-titulo" className="text-lg font-bold text-foreground">Aparência</h2>
          <p className="mb-[20px] mt-[4px] text-[0.9375rem] text-muted-foreground">
            O claro é o padrão do Café; o escuro descansa a vista à noite. Em qualquer um, cada módulo
            mantém a sua cor nos detalhes. A escolha fica salva neste navegador.
          </p>
          <ModeChoice />
        </section>
      )}
    </div>
  );
};
