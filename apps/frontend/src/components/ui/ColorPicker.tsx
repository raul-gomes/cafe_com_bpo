import React, { useState } from 'react';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const COLOR_SWATCHES = [
  // Red / Pink
  { name: 'Vermelho', hex: '#ef4444' },
  { name: 'Rosa', hex: '#e91e63' },
  { name: 'Vinho', hex: '#9b1b30' },

  // Orange
  { name: 'Laranja', hex: '#f97316' },
  { name: 'Tangerina', hex: '#ff6b35' },
  { name: 'Âmbar', hex: '#f59e0b' },

  // Yellow
  { name: 'Amarelo', hex: '#eab308' },
  { name: 'Mostarda', hex: '#d4a017' },
  { name: 'Dourado', hex: '#b8860b' },

  // Green
  { name: 'Verde', hex: '#22c55e' },
  { name: 'Verde Escuro', hex: '#166534' },
  { name: 'Verde Musgo', hex: '#4a7c59' },

  // Teal / Cyan
  { name: 'Ciano', hex: '#06b6d4' },
  { name: 'Verde Água', hex: '#14b8a6' },
  { name: 'Petróleo', hex: '#0d7377' },

  // Blue
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Azul Escuro', hex: '#1e3a5f' },
  { name: 'Azul Marinho', hex: '#0a1628' },

  // Purple
  { name: 'Roxo', hex: '#8b5cf6' },
  { name: 'Lavanda', hex: '#a78bfa' },
  { name: 'Violeta', hex: '#7c3aed' },

  // Gray / Neutral
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
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="ds-input-group perfil-form__full">
      <label className="ds-label">{label}</label>

      {/* Swatch grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '6px',
          marginBottom: '12px',
        }}
      >
        {/* "None" option (clear) */}
        <button
          type="button"
          title="Nenhuma cor"
          onClick={() => onChange('')}
          style={{
            width: '100%',
            aspectRatio: '1',
            borderRadius: '6px',
            border: value === '' ? '2px solid var(--ds-primary)' : '1px solid var(--ds-border)',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: 'var(--ds-text-muted)',
          }}
        >
          ✕
        </button>
        {COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            title={swatch.name}
            onClick={() => {
              onChange(swatch.hex);
              setShowCustom(false);
            }}
            style={{
              width: '100%',
              aspectRatio: '1',
              borderRadius: '6px',
              border: value.toLowerCase() === swatch.hex
                ? '2px solid var(--ds-white)'
                : '1px solid var(--ds-border)',
              background: swatch.hex,
              cursor: 'pointer',
              outline: value.toLowerCase() === swatch.hex
                ? '2px solid var(--ds-primary)'
                : 'none',
            }}
          />
        ))}
      </div>

      {/* Custom hex input */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          className="ds-input"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            if (COLOR_SWATCHES.some(s => s.hex === v.toLowerCase())) {
              setShowCustom(false);
            }
          }}
          placeholder={placeholder}
          style={{ flex: 1, fontFamily: 'monospace' }}
        />
        <button
          type="button"
          className="ds-btn ds-btn-outline ds-btn-sm"
          onClick={() => setShowCustom(!showCustom)}
          style={{ whiteSpace: 'nowrap' }}
        >
          {showCustom ? 'Fechar' : 'Personalizado'}
        </button>
      </div>

      {/* Color preview */}
      {value && value.match(/^#[0-9a-fA-F]{6}$/) && (
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              background: value,
              border: '1px solid var(--ds-border)',
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)', fontFamily: 'monospace' }}>
            {value.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
};
