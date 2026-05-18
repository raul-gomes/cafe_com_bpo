import React, { useState, useEffect, useCallback } from 'react';
import { maskCPF, maskCNPJ, maskPhone, onlyNumbers } from '../../lib/formatters';

interface MaskedInputProps {
  value: string;
  onChange: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
}

const maskDate = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
    .slice(0, 10);
};

export const MaskedCPF: React.FC<MaskedInputProps> = ({
  value,
  onChange,
  placeholder = '000.000.000-00',
  className,
  disabled,
  required,
  id,
  name,
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(value ? maskCPF(value) : '');
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = onlyNumbers(e.target.value);
      setDisplayValue(maskCPF(raw));
      onChange(raw);
    },
    [onChange]
  );

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      required={required}
      id={id}
      name={name}
      maxLength={14}
    />
  );
};

export const MaskedCNPJ: React.FC<MaskedInputProps> = ({
  value,
  onChange,
  placeholder = '00.000.000/0000-00',
  className,
  disabled,
  required,
  id,
  name,
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(value ? maskCNPJ(value) : '');
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = onlyNumbers(e.target.value);
      setDisplayValue(maskCNPJ(raw));
      onChange(raw);
    },
    [onChange]
  );

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      required={required}
      id={id}
      name={name}
      maxLength={18}
    />
  );
};

export const MaskedPhone: React.FC<MaskedInputProps> = ({
  value,
  onChange,
  placeholder = '(00) 00000-0000',
  className,
  disabled,
  required,
  id,
  name,
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(value ? maskPhone(value) : '');
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = onlyNumbers(e.target.value);
      setDisplayValue(maskPhone(raw));
      onChange(raw);
    },
    [onChange]
  );

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      required={required}
      id={id}
      name={name}
      maxLength={15}
    />
  );
};

export const MaskedDate: React.FC<MaskedInputProps> = ({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  className,
  disabled,
  required,
  id,
  name,
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(value ? maskDate(value) : '');
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = onlyNumbers(e.target.value);
      setDisplayValue(maskDate(raw));
      onChange(raw);
    },
    [onChange]
  );

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      required={required}
      id={id}
      name={name}
      maxLength={10}
    />
  );
};
