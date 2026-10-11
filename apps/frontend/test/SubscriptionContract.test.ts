import { describe, expect, it } from 'vitest'

import {
  billingDataSchema,
  billingHistoryListSchema,
  billingHistoryRowSchema,
  billingProfileSchema,
  cancelResponseSchema,
  checkoutResponseSchema,
} from '../src/schemas/subscription'

/**
 * Contrato das chamadas de pagamento no cliente (regra §6).
 *
 * O `.strict()` é o que estes testes sustentam: sem ele o Zod descarta a chave
 * desconhecida e um campo interno que voltasse a ser enviado entraria em
 * silêncio na tela. Os três blocos da PaymentsPage (plano, dados de cobrança e
 * histórico) vivem destes schemas — um campo removido do backend quebra o
 * `parse` aqui antes de renderizar errado.
 */

const HISTORY_ROW = {
  id: 'row-1',
  cycle_month: '2026-09',
  amount: '27.90',
  status: 'confirmed',
  paid_at: '2026-09-05T12:00:00Z',
  invoice_url: 'https://sandbox.asaas.com/invoice/inv_1',
}

const PROFILE = {
  cpf_cnpj: '24971563792',
  phone: '4738010919',
  address: 'Av. Paulista',
  address_number: '150',
  complement: null,
  city: 'São Paulo',
  state: 'SP',
  postal_code: '01310000',
}

describe('billingDataSchema (corpo do PUT /subscriptions/billing)', () => {
  it('aceita os dígitos que as máscaras do formulário produzem', () => {
    expect(
      billingDataSchema.parse({
        cpf_cnpj: '24971563792',
        phone: '4738010919',
        address: 'Av. Paulista',
        address_number: '150',
        city: 'São Paulo',
        state: 'SP',
        postal_code: '01310000',
      }),
    ).toBeDefined()
  })

  it('aceita complemento enviado como string ou omitido', () => {
    const withoutComplement = {
      cpf_cnpj: '24971563792',
      phone: '4738010919',
      address: 'Av. Paulista',
      address_number: '150',
      city: 'São Paulo',
      state: 'SP',
      postal_code: '01310000',
    }
    expect(billingDataSchema.parse(withoutComplement)).toBeDefined()
    expect(
      billingDataSchema.parse({ ...withoutComplement, complement: 'Apto 12' }),
    ).toBeDefined()
  })

  it('rejeita chaves que o backend nunca aceita (extra="forbid" no servidor)', () => {
    const extra = { ...PROFILE, complement: null, pix_key: 'anyone@example.com' }
    expect(() => billingDataSchema.parse(extra)).toThrow()
  })

  it('rejeita um documento curto — o servidor valida o dígito verificador', () => {
    const short = { ...PROFILE, complement: null, cpf_cnpj: '123' }
    expect(() => billingDataSchema.parse(short)).toThrow()
  })
})

describe('billingProfileSchema (resposta do GET/PUT /subscriptions/billing)', () => {
  it('aceita os oito campos que o formulário lê, complement nulo incluso', () => {
    expect(billingProfileSchema.parse(PROFILE)).toEqual(PROFILE)
  })

  it('rejeita uma chave extra', () => {
    expect(() => billingProfileSchema.parse({ ...PROFILE, user_id: 'u-1' })).toThrow()
  })

  it('exige a chave complement — null é dado, ausência é deriva de contrato', () => {
    const without = {
      cpf_cnpj: PROFILE.cpf_cnpj,
      phone: PROFILE.phone,
      address: PROFILE.address,
      address_number: PROFILE.address_number,
      city: PROFILE.city,
      state: PROFILE.state,
      postal_code: PROFILE.postal_code,
    }
    expect(() => billingProfileSchema.parse(without)).toThrow()
  })
})

describe('checkoutResponseSchema (POST /subscriptions/checkout)', () => {
  it('aceita a resposta completa, com o preço como string (§17.1)', () => {
    const payload = {
      link: 'https://sandbox.asaas.com/000/checkoutSession/show/chk_1',
      plan_name: 'Mensal',
      price: '27.90',
      cycle: 'MONTHLY',
      status: 'incomplete',
    }
    expect(checkoutResponseSchema.parse(payload)).toEqual(payload)
  })

  it('rejeita chave extra e preço numérico — dinheiro nunca atravessa como float', () => {
    expect(() =>
      checkoutResponseSchema.parse({
        link: 'https://x',
        plan_name: 'Mensal',
        price: '27.90',
        cycle: 'MONTHLY',
        status: 'incomplete',
        subscription_id: 's-1',
      }),
    ).toThrow()
    expect(() =>
      checkoutResponseSchema.parse({
        link: 'https://x',
        plan_name: 'Mensal',
        price: 27.9,
        cycle: 'MONTHLY',
        status: 'incomplete',
      }),
    ).toThrow()
  })
})

describe('cancelResponseSchema (POST /subscriptions/cancel)', () => {
  it('aceita a data de fim do acesso, e null quando nada foi pago', () => {
    expect(
      cancelResponseSchema.parse({ current_period_end: '2026-11-04T00:00:00Z' }),
    ).toEqual({ current_period_end: '2026-11-04T00:00:00Z' })
    expect(cancelResponseSchema.parse({ current_period_end: null })).toEqual({
      current_period_end: null,
    })
  })

  it('exige a chave — a tela decide o texto da confirmação a partir dela', () => {
    expect(() => cancelResponseSchema.parse({})).toThrow()
  })
})

describe('histórico mês a mês (GET /payments/)', () => {
  it('aceita a linha de cobrança do card de histórico', () => {
    expect(billingHistoryRowSchema.parse(HISTORY_ROW)).toEqual(HISTORY_ROW)
  })

  it('aceita paid_at e invoice_url nulos (cobrança não paga)', () => {
    expect(
      billingHistoryRowSchema.parse({
        ...HISTORY_ROW,
        status: 'overdue',
        paid_at: null,
        invoice_url: null,
      }),
    ).toBeDefined()
  })

  it('rejeita chave extra — nome, método e datas internas não chegam à tela', () => {
    expect(() =>
      billingHistoryRowSchema.parse({ ...HISTORY_ROW, payment_method: 'CREDIT_CARD' }),
    ).toThrow()
  })

  it('valida a lista inteira, e um objeto solto, como um erro de contrato', () => {
    expect(billingHistoryListSchema.parse([HISTORY_ROW])).toHaveLength(1)
    expect(() => billingHistoryListSchema.parse(HISTORY_ROW)).toThrow()
  })
})