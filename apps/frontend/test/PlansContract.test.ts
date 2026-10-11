import { describe, it, expect } from 'vitest'

import { planSchema, priceSyncResponseSchema } from '../src/schemas/plans'

/**
 * Contrato do `POST /plans/{id}/sync-prices` (Fase 10).
 *
 * Decisão de produto (§5 do plano): o resultado da ressincronização é o
 * `{synced, failed, skipped}` que o backend devolve — não há badge persistente
 * por plano. Estes testes congelam essa decisão no contrato:
 * 1. o payload do provedor é exatamente três contagens não-negativas; e
 * 2. a linha do catálogo (`planSchema`) NÃO carrega `price_sync_status`, um
 *    campo que nunca existiu aqui e não deve ressurgir por acidente.
 */
describe('plans contract — ressincronização de preços', () => {
  it('aceita o payload de três contagens que o backend devolve', () => {
    expect(
      priceSyncResponseSchema.parse({ synced: 3, failed: 1, skipped: 2 }),
    ).toEqual({ synced: 3, failed: 1, skipped: 2 })
  })

  it('rejeita contagens negativas', () => {
    expect(
      priceSyncResponseSchema.safeParse({ synced: -1, failed: 0, skipped: 0 }).success,
    ).toBe(false)
  })

  it('rejeita campos extras (contrato estrito)', () => {
    expect(
      priceSyncResponseSchema.safeParse({ synced: 1, failed: 0, skipped: 0, extra: 1 }).success,
    ).toBe(false)
  })

  it('a linha do catálogo não carrega status de sync persistente', () => {
    const plan = {
      id: 'plan-1',
      code: 'monthly',
      name: 'Mensal',
      price: '27.90',
      cycle: 'MONTHLY',
      is_active: true,
      description: null,
      subscriber_count: 12,
    }

    expect(planSchema.parse(plan)).toEqual(plan)
    expect(planSchema.safeParse({ ...plan, price_sync_status: 'ok' }).success).toBe(false)
  })
})