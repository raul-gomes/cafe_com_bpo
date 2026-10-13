/**
 * Static PIX in the BR Code standard (EMV® QRCPS-MPM, Banco Central's Pix
 * initiation manual). The generated text is the "copia e cola" code and also
 * the QR Code content. No amount: the payer chooses how much to contribute.
 */

interface PixPayloadInput {
  /** PIX key (e-mail, phone, CPF/CNPJ or random). */
  key: string;
  /** Receiver name (up to 25 characters, no accents). */
  merchantName: string;
  /** Receiver city (up to 15 characters, no accents). */
  merchantCity: string;
  /** Transaction id; "***" when there is none. */
  txid?: string;
}

/** EMV field: ID (2 digits) + length (2 digits) + value. */
function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** Removes accents and characters outside the accepted set, uppercase, with a length limit. */
function sanitize(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max);
}

/**
 * CRC16-CCITT (polynomial 0x1021, initial value 0xFFFF), required in field 63.
 *
 * @param payload Text the checksum covers.
 * @returns Four uppercase hex digits.
 */
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

/**
 * Builds the static PIX payload.
 *
 * @returns The "copia e cola" text, which is also the QR Code content.
 */
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
