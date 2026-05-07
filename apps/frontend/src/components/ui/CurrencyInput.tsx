import React, { useState, useEffect, useCallback } from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0,00',
  className,
  disabled,
  min,
  max,
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value > 0) {
      setDisplayValue(
        (value / 100).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/\D/g, '');

      if (raw.length === 0) {
        setDisplayValue('');
        onChange(0);
        return;
      }

      if (raw.length > 12) raw = raw.slice(0, 12);

      let numericValue = parseInt(raw, 10) / 100;

      if (min !== undefined && numericValue < min) numericValue = min;
      if (max !== undefined && numericValue > max) numericValue = max;

      const formatted = numericValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      setDisplayValue(formatted);
      onChange(numericValue);
    },
    [onChange, min, max]
  );

  return (
    <div style={{ position: 'relative' }}>
      <span
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--ds-text-muted)',
          fontSize: '14px',
          fontWeight: 600,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        style={{ paddingLeft: '40px' }}
      />
    </div>
  );
};
