import { describe, it, expect } from 'vitest'
import { buildPixPayload, crc16 } from '../src/lib/pix'

describe('PIX BR Code', () => {
  it('CRC16-CCITT bate com o valor de referência ("123456789" → 29B1)', () => {
    expect(crc16('123456789')).toBe('29B1')
  })

  it('monta o payload estático com chave, recebedor, cidade e CRC', () => {
    const payload = buildPixPayload({
      key: 'ajude@cafecombpo.com',
      merchantName: 'Café com BPO',
      merchantCity: 'São Paulo',
    })
    expect(payload).toBe(
      '00020126420014br.gov.bcb.pix0120ajude@cafecombpo.com' +
        '5204000053039865802BR5912CAFE COM BPO6009SAO PAULO62070503***6304' +
        crc16(
          '00020126420014br.gov.bcb.pix0120ajude@cafecombpo.com' +
            '5204000053039865802BR5912CAFE COM BPO6009SAO PAULO62070503***6304'
        )
    )
    expect(payload).toMatch(/6304[0-9A-F]{4}$/)
  })

  it('limita nome (25) e cidade (15) e tira acentos', () => {
    const payload = buildPixPayload({
      key: 'x@y.com',
      merchantName: 'Associação Café com BPO do Brasil Inteiro',
      merchantCity: 'São José dos Campos',
    })
    expect(payload).toContain('5925ASSOCIACAO CAFE COM BPO')
    expect(payload).toContain('6015SAO JOSE DOS CA6')
  })
})
