/**
 * Máscara para CNPJ: 00.000.000/0000-00
 */
export const maskCNPJ = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
};

/**
 * Máscara para Telefone: (00) 00000-0000 ou (00) 0000-0000
 */
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

/**
 * Filtra apenas números
 */
export const onlyNumbers = (value: string): string => {
  return value.replace(/\D/g, '');
};
