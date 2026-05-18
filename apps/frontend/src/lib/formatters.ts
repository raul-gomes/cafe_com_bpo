export const maskCNPJ = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
};

export const maskCPF = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/\.(\d{3})(\d)/, '.$1.$2')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
    .slice(0, 14);
};

export const maskPhone = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 10) {
    return clean
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 14);
  }
  return clean
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
};

export const maskCEP = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{5})(\d)/, '$1-$2')
    .slice(0, 9);
};

export const onlyNumbers = (value: string): string => {
  return value.replace(/\D/g, '');
};

export const formatBRL = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const parseCurrencyInput = (value: string): number => {
  const clean = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const maskCurrency = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  
  let cents = parseInt(digits, 10);
  const isNegative = cents < 0;
  if (isNegative) cents = Math.abs(cents);
  
  if (digits.length > 2) {
    // cents already has the correct value
  }
  
  const result = (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return result;
};
