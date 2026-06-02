/**
 * Formata um valor aplicando a máscara de CNPJ: XX.XXX.XXX/XXXX-XX
 */
export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * Formata um valor aplicando a máscara de telefone: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    // Telefone fixo: (XX) XXXX-XXXX
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  // Celular: (XX) XXXXX-XXXX
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

/**
 * Remove todos os caracteres não numéricos de uma string.
 */
export function unmask(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Hook-friendly mask applicator: returns the masked value and the raw digits.
 */
export function applyMask(value: string, type: 'cnpj' | 'phone'): string {
  if (type === 'cnpj') return maskCNPJ(value);
  return maskPhone(value);
}
