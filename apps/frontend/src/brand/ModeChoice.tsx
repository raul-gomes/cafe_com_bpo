import React from 'react';
import { MODES, MODE_LABELS, useAppearance, type Mode } from './appearance';
import { cn } from '../lib/utils';

/**
 * Amostras de claro e escuro da família Café, copiadas de cafe-themes.css (V4).
 * Os tokens do kit vivem no :root, então a prévia lado a lado precisa dos
 * valores literais. Ao atualizar o kit, conferir estes valores.
 */
const SWATCHES: Record<Mode, { canvas: string; paper: string; accent: string; ink: string; line: string }> = {
  light: { canvas: '#F8F5EF', paper: '#FFFDFA', accent: '#FFC72C', ink: '#29241F', line: '#DCD3C6' },
  dark: { canvas: '#211A16', paper: '#2C241E', accent: '#FFD268', ink: '#F3EEE7', line: '#584A3D' },
};

/** Miniatura de uma tela no modo: fundo, cartão, linhas de texto e o botão de ação. */
function Preview({ mode }: { mode: Mode }) {
  const s = SWATCHES[mode];
  return (
    <div className="flex h-[88px] gap-[6px] rounded-md p-[8px]" style={{ background: s.canvas }} aria-hidden="true">
      <div className="w-[22px] rounded-sm" style={{ background: s.paper, border: `1px solid ${s.line}` }} />
      <div className="flex flex-1 flex-col justify-between rounded-sm p-[8px]" style={{ background: s.paper, border: `1px solid ${s.line}` }}>
        <div className="space-y-[5px]">
          <div className="h-[5px] w-3/4 rounded-full" style={{ background: s.ink, opacity: 0.8 }} />
          <div className="h-[5px] w-1/2 rounded-full" style={{ background: s.ink, opacity: 0.35 }} />
        </div>
        <div className="h-[12px] w-[40px] self-end rounded-sm" style={{ background: s.accent }} />
      </div>
    </div>
  );
}

/** Escolha de claro ou escuro (Configurações › Aparência). */
export const ModeChoice: React.FC = () => {
  const [current, setAppearance] = useAppearance();
  return (
    <div className="grid max-w-[560px] gap-[16px] sm:grid-cols-2" role="radiogroup" aria-label="Modo do painel">
      {MODES.map(mode => {
        const selected = current.mode === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setAppearance({ mode })}
            className={cn(
              'rounded-lg border bg-card p-[10px] text-left transition-colors hover:border-input',
              selected ? 'border-primary-strong ring-2 ring-primary-strong/30' : 'border-border'
            )}
          >
            <Preview mode={mode} />
            <div className="mt-[10px] flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">
                {MODE_LABELS[mode]}
                {mode === 'light' && <span className="ml-[6px] font-normal text-muted-foreground">(padrão)</span>}
              </span>
              {selected && <span className="text-xs font-semibold text-primary-strong">Em uso</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
};
