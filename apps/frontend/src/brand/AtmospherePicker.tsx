import React from 'react';
import {
  MODES,
  MODE_LABELS,
  PALETTES,
  PALETTE_LABELS,
  useAppearance,
  type Mode,
  type Palette,
} from './appearance';
import { cn } from '../lib/utils';

/**
 * Amostras de cada atmosfera, copiadas de cafe-themes.css (V4). Os tokens do kit
 * vivem no :root, então uma prévia lado a lado precisa dos valores literais.
 * Ao atualizar o kit, conferir estes valores.
 */
const SWATCHES: Record<Palette, Record<Mode, { canvas: string; paper: string; accent: string; ink: string; line: string }>> = {
  cafe: {
    light: { canvas: '#F8F5EF', paper: '#FFFDFA', accent: '#FFC72C', ink: '#29241F', line: '#DCD3C6' },
    dark: { canvas: '#211A16', paper: '#2C241E', accent: '#FFD268', ink: '#F3EEE7', line: '#584A3D' },
  },
  verde: {
    light: { canvas: '#F1F5F0', paper: '#FCFEFB', accent: '#245941', ink: '#1D3026', line: '#CDDACC' },
    dark: { canvas: '#10281E', paper: '#17372A', accent: '#9DC7A8', ink: '#E7F0E9', line: '#42634C' },
  },
  azul: {
    light: { canvas: '#F1F4F7', paper: '#FCFDFF', accent: '#2A5579', ink: '#233442', line: '#CCD8E3' },
    dark: { canvas: '#142432', paper: '#1C3143', accent: '#A8C9E0', ink: '#E8EFF5', line: '#47647B' },
  },
};

/** Miniatura de uma tela na atmosfera: fundo, cartão, linhas de texto e o botão de ação. */
function Preview({ palette, mode }: { palette: Palette; mode: Mode }) {
  const s = SWATCHES[palette][mode];
  return (
    <div className="flex h-[72px] gap-[6px] rounded-md p-[8px]" style={{ background: s.canvas }} aria-hidden="true">
      <div className="w-[18px] rounded-sm" style={{ background: s.paper, border: `1px solid ${s.line}` }} />
      <div className="flex flex-1 flex-col justify-between rounded-sm p-[6px]" style={{ background: s.paper, border: `1px solid ${s.line}` }}>
        <div className="space-y-[4px]">
          <div className="h-[4px] w-3/4 rounded-full" style={{ background: s.ink, opacity: 0.8 }} />
          <div className="h-[4px] w-1/2 rounded-full" style={{ background: s.ink, opacity: 0.35 }} />
        </div>
        <div className="h-[10px] w-[34px] self-end rounded-sm" style={{ background: s.accent }} />
      </div>
    </div>
  );
}

/** Grade com as seis atmosferas (Configurações › Aparência). */
export const AtmosphereGrid: React.FC = () => {
  const [current, setAppearance] = useAppearance();
  return (
    <div className="grid gap-[16px] sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Atmosfera do painel">
      {PALETTES.flatMap(palette =>
        MODES.map(mode => {
          const selected = current.palette === palette && current.mode === mode;
          return (
            <button
              key={`${palette}-${mode}`}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setAppearance({ palette, mode })}
              className={cn(
                'rounded-lg border bg-card p-[10px] text-left transition-colors hover:border-input',
                selected ? 'border-primary-strong ring-2 ring-primary-strong/30' : 'border-border'
              )}
            >
              <Preview palette={palette} mode={mode} />
              <div className="mt-[10px] flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">
                  {PALETTE_LABELS[palette]} · {MODE_LABELS[mode]}
                </span>
                {selected && <span className="text-xs font-semibold text-primary-strong">Em uso</span>}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
};

/** Versão compacta para o topo: família de cor + claro/escuro. */
export const AtmosphereQuickPicker: React.FC = () => {
  const [current, setAppearance] = useAppearance();
  return (
    <div className="space-y-[14px]">
      <div>
        <div className="mb-[8px] text-xs font-bold uppercase tracking-[0.11em] text-muted-foreground">Cor</div>
        <div className="grid grid-cols-3 gap-[8px]" role="radiogroup" aria-label="Família de cor">
          {PALETTES.map(palette => {
            const s = SWATCHES[palette][current.mode];
            const selected = current.palette === palette;
            return (
              <button
                key={palette}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setAppearance({ palette })}
                className={cn(
                  'flex flex-col items-center gap-[6px] rounded-md border p-[8px] text-xs font-semibold transition-colors',
                  selected ? 'border-primary-strong text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <span
                  className="size-[24px] rounded-full"
                  style={{ background: `linear-gradient(135deg, ${s.accent} 50%, ${s.canvas} 50%)`, border: `1px solid ${s.line}` }}
                  aria-hidden="true"
                />
                {PALETTE_LABELS[palette]}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-[8px] text-xs font-bold uppercase tracking-[0.11em] text-muted-foreground">Luz</div>
        <div className="grid grid-cols-2 gap-[4px] rounded-md bg-muted p-[4px]" role="radiogroup" aria-label="Claro ou escuro">
          {MODES.map(mode => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={current.mode === mode}
              onClick={() => setAppearance({ mode })}
              className={cn(
                'rounded-sm py-[6px] text-sm font-semibold transition-colors',
                current.mode === mode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
