import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../../lib/utils';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const COLOR_SWATCHES = [
  { name: 'Vermelho', hex: '#ef4444' },
  { name: 'Rosa', hex: '#e91e63' },
  { name: 'Vinho', hex: '#9b1b30' },

  { name: 'Laranja', hex: '#f97316' },
  { name: 'Tangerina', hex: '#ff6b35' },
  { name: 'Âmbar', hex: '#f59e0b' },

  { name: 'Amarelo', hex: '#eab308' },
  { name: 'Mostarda', hex: '#d4a017' },
  { name: 'Dourado', hex: '#b8860b' },

  { name: 'Verde', hex: '#22c55e' },
  { name: 'Verde Escuro', hex: '#166534' },
  { name: 'Verde Musgo', hex: '#4a7c59' },

  { name: 'Ciano', hex: '#06b6d4' },
  { name: 'Verde Água', hex: '#14b8a6' },
  { name: 'Petróleo', hex: '#0d7377' },

  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Azul Escuro', hex: '#1e3a5f' },
  { name: 'Azul Marinho', hex: '#0a1628' },

  { name: 'Roxo', hex: '#8b5cf6' },
  { name: 'Lavanda', hex: '#a78bfa' },
  { name: 'Violeta', hex: '#7c3aed' },

  { name: 'Cinza', hex: '#6b7280' },
  { name: 'Chumbo', hex: '#4b5563' },
  { name: 'Preto', hex: '#111827' },
  { name: 'Marrom', hex: '#6d4c41' },
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value,
  onChange,
  placeholder = '#3b82f6',
}) => {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const selectColor = (hex: string) => {
    onChange(hex);
    setShowCustom(false);
    setOpen(false);
  };

  return (
    <div className="ds-input-group perfil-form__full">
      <label className="ds-label">{label}</label>

      <div className="flex items-center gap-2">
        {/* Hex input */}
        <input
          type="text"
          className="ds-input flex-1"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            if (COLOR_SWATCHES.some((s) => s.hex === v.toLowerCase())) {
              setShowCustom(false);
            }
          }}
          placeholder={placeholder}
          style={{ fontFamily: 'monospace' }}
        />

        {/* Color trigger button with popover */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className={cn(
              'size-9 shrink-0 cursor-pointer rounded-lg border-2 outline-none transition-all hover:scale-105',
              value && value.match(/^#[0-9a-fA-F]{6}$/)
                ? 'border-border'
                : 'border-dashed border-muted-foreground',
            )}
            style={{
              background: value && value.match(/^#[0-9a-fA-F]{6}$/) ? value : 'transparent',
            }}
            title="Selecionar cor"
          >
            {(!value || !value.match(/^#[0-9a-fA-F]{6}$/)) && (
              <span className="text-[10px] font-bold text-muted-foreground">cor</span>
            )}
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-[240px] p-3">
            {/* Swatch grid */}
            <div className="grid grid-cols-8 gap-1">
              {/* Clear option */}
              <button
                type="button"
                title="Nenhuma cor"
                onClick={() => selectColor('')}
                className={cn(
                  'flex aspect-square cursor-pointer items-center justify-center rounded-md text-sm transition-colors',
                  value === ''
                    ? 'border-2 border-primary'
                    : 'border border-border hover:border-muted-foreground',
                )}
              >
                ✕
              </button>
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  title={swatch.name}
                  onClick={() => selectColor(swatch.hex)}
                  className={cn(
                    'aspect-square cursor-pointer rounded-md border-2 transition-transform hover:scale-110',
                    value.toLowerCase() === swatch.hex
                      ? 'border-white shadow-[0_0_0_2px_hsl(var(--primary))]'
                      : 'border-border',
                  )}
                  style={{ background: swatch.hex }}
                />
              ))}
            </div>

            {/* Custom hex input section */}
            <div className="mt-2 flex items-center gap-1.5">
              <input
                type="text"
                className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-xs font-mono outline-none focus-visible:border-ring"
                value={value}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange(v);
                  if (COLOR_SWATCHES.some((s) => s.hex === v.toLowerCase())) {
                    setShowCustom(false);
                  }
                }}
                placeholder={placeholder}
              />
              <button
                type="button"
                className="h-7 cursor-pointer rounded-md border border-input bg-transparent px-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
                onClick={() => setShowCustom(!showCustom)}
              >
                {showCustom ? 'Fechar' : 'Personalizado'}
              </button>
            </div>

            {/* Color preview */}
            {value && value.match(/^#[0-9a-fA-F]{6}$/) && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <div
                  className="size-4 rounded-sm border border-border"
                  style={{ background: value }}
                />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {value.toUpperCase()}
                </span>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
