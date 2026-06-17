import React, { useState, useCallback } from 'react';
import { maskCPF, maskCNPJ, maskPhone, onlyNumbers } from '../../lib/formatters';
import { cn } from '../../lib/utils';

/* ── Shared types ── */

type TipoMask = 'cpf' | 'cnpj' | 'phone' | 'date';

interface MaskedInputBaseProps {
  value?: string;
  onChange?: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
}

/* ── Date mask helper ── */

const maskDate = (value: string): string =>
  value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
    .slice(0, 10);

/* ── Tipo → mask function + metadata ── */

const MASK_CONFIG: Record<
  TipoMask,
  { mask: (v: string) => string; placeholder: string; maxLength: number }
> = {
  cpf: { mask: maskCPF, placeholder: '000.000.000-00', maxLength: 14 },
  cnpj: { mask: maskCNPJ, placeholder: '00.000.000/0000-00', maxLength: 18 },
  phone: { mask: maskPhone, placeholder: '(00) 00000-0000', maxLength: 15 },
  date: { mask: maskDate, placeholder: 'DD/MM/AAAA', maxLength: 10 },
};

/* ── Unified MaskedInput ── */

interface MaskedInputProps extends MaskedInputBaseProps {
  tipo: TipoMask;
}

export const MaskedInput: React.FC<MaskedInputProps> = ({
  tipo,
  value: externalValue,
  onChange: externalOnChange,
  placeholder,
  className,
  disabled,
  required,
  id,
  name,
}) => {
  const config = MASK_CONFIG[tipo];
  const isControlled = externalValue !== undefined;
  const [internalValue, setInternalValue] = useState('');

  const displayValue = isControlled
    ? (externalValue ? config.mask(externalValue) : '')
    : internalValue;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = onlyNumbers(e.target.value);
      const masked = config.mask(raw);
      if (!isControlled) {
        setInternalValue(masked);
      }
      externalOnChange?.(raw);
    },
    [externalOnChange, config, isControlled]
  );

  return (
    <input
      type="text"
      inputMode="numeric"
      data-slot="input-group-control"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder ?? config.placeholder}
      className={cn(
        'flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent',
        className
      )}
      disabled={disabled}
      required={required}
      id={id}
      name={name}
      maxLength={config.maxLength}
    />
  );
};

/* ── Individual named exports (backwards-compat) ── */

export const MaskedCPF: React.FC<MaskedInputBaseProps> = (props) => (
  <MaskedInput tipo="cpf" {...props} />
);

export const MaskedCNPJ: React.FC<MaskedInputBaseProps> = (props) => (
  <MaskedInput tipo="cnpj" {...props} />
);

export const MaskedPhone: React.FC<MaskedInputBaseProps> = (props) => (
  <MaskedInput tipo="phone" {...props} />
);

export const MaskedDate: React.FC<MaskedInputBaseProps> = (props) => (
  <MaskedInput tipo="date" {...props} />
);
