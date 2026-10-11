/**
 * PIX estático no padrão BR Code (EMV® QRCPS-MPM, Manual de Padrões para
 * Iniciação do Pix — Banco Central). O texto gerado é o "copia e cola" e
 * também o conteúdo do QR Code. Sem valor: quem paga escolhe quanto contribuir.
 */

interface PixPayloadInput {
  /** Chave PIX (e-mail, telefone, CPF/CNPJ ou aleatória). */
  key: string;
  /** Nome do recebedor (até 25 caracteres, sem acentos). */
  merchantName: string;
  /** Cidade do recebedor (até 15 caracteres, sem acentos). */
  merchantCity: string;
  /** Identificador da transação; "***" quando não há um. */
  txid?: string;
}

/** Campo EMV: ID (2 dígitos) + tamanho (2 dígitos) + valor. */
function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** Remove acentos e caracteres fora do conjunto aceito, em maiúsculas, com limite. */
function sanitize(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max);
}

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildPixPayload({ key, merchantName, merchantCity, txid = '***' }: PixPayloadInput): string {
  const account = field('00', 'br.gov.bcb.pix') + field('01', key.trim());
  const body =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    field('58', 'BR') +
    field('59', sanitize(merchantName, 25)) +
    field('60', sanitize(merchantCity, 15)) +
    field('62', field('05', txid)) +
    '6304';
  return body + crc16(body);
}
