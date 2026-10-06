import { describe, expect, it } from 'vitest';

import { accessSchema } from '../src/schemas/access';

/**
 * Contrato de `GET /access` no cliente (regra §6).
 *
 * O `.strict()` é o que estes testes sustentam: sem ele o Zod descarta a chave
 * desconhecida e um campo interno que voltasse a ser enviado entraria
 * silenciosamente na tela. Aqui a chave extra é rejeitada, e a remoção de
 * `shows_beta_banner` — a chave que ergue o aviso do painel — também.
 */

const BETA_ACCESS = {
  access: 'beta',
  read_only_modules: [],
  writable_modules: ['captar', 'comunidade', 'gestao', 'operacional', 'pagamentos'],
  expires_at: '2026-11-04T00:00:00Z',
  grace_until: null,
  shows_dunning_banner: false,
  shows_beta_banner: true,
  subscription_status: null,
  plan: null,
  is_admin: false,
};

describe('contrato de acesso', () => {
  it('aceita o payload completo que a tela de pagamentos recebe', () => {
    expect(accessSchema.parse(BETA_ACCESS)).toEqual(BETA_ACCESS);

    const paid = {
      ...BETA_ACCESS,
      access: 'active',
      expires_at: '2026-12-04T00:00:00Z',
      shows_beta_banner: false,
      subscription_status: 'active',
      plan: { code: 'mensal', name: 'Mensal', price: '27.90', cycle: 'MONTHLY' },
      is_admin: false,
    };
    expect(accessSchema.parse(paid)).toEqual(paid);
  });

  it('rejeita chaves que o endpoint nunca manda', () => {
    for (const extra of [
      { user_id: 'u-1' },
      { created_at: '2026-01-01T00:00:00Z' },
      { shows_beta_banner_date: '2026-11-04' },
    ]) {
      expect(() => accessSchema.parse({ ...BETA_ACCESS, ...extra })).toThrow();
    }
  });

  it('rejeita o payload sem shows_beta_banner — o aviso depende dela', () => {
    const without: Record<string, unknown> = { ...BETA_ACCESS };
    delete without.shows_beta_banner;

    expect(() => accessSchema.parse(without)).toThrow();
  });
});
