import { describe, expect, it } from 'vitest';

import {
  acceptResponseSchema,
  invitationListResponseSchema,
  teamListResponseSchema,
} from '../src/schemas/team';
import { prospectSchema } from '../src/schemas/prospects';

/**
 * Contrato de payload no cliente (regra §6).
 *
 * O `.strict()` dos schemas é o que estes testes sustentam: sem ele o Zod
 * descarta a chave desconhecida e um campo que voltou a ser enviado entraria
 * silenciosamente na tela. Aqui a chave extra é rejeitada.
 */

const MEMBER = {
  user_id: 'u-1',
  name: 'Membro',
  email: 'membro@cafe.com',
  routines: [{ template_id: 't-1', name: 'Fechamento mensal' }],
};

const INVITATION = {
  invitation_id: 'i-1',
  email: 'convidado@cafe.com',
  status: 'pending',
  expires_at: '2026-09-22T10:00:00',
  accepted_at: null,
};

describe('contrato de equipe', () => {
  it('aceita o payload que a tela renderiza', () => {
    expect(teamListResponseSchema.parse({ members: [MEMBER] })).toEqual({
      members: [MEMBER],
    });
    expect(invitationListResponseSchema.parse({ invitations: [INVITATION] })).toEqual({
      invitations: [INVITATION],
    });
    expect(
      acceptResponseSchema.parse({
        status: 'accepted',
        client_name: 'Empresa',
        client_id: 'c-1',
      }),
    ).toEqual({ status: 'accepted', client_name: 'Empresa', client_id: 'c-1' });
  });

  it('rejeita a data de entrada, o papel e o is_active que saíram do membro', () => {
    for (const extra of [{ joined_at: '2026-09-01T00:00:00' }, { role: 'member' }, { is_active: true }]) {
      expect(() => teamListResponseSchema.parse({ members: [{ ...MEMBER, ...extra }] })).toThrow();
    }
  });

  it('rejeita as rotinas e a data de criação que saíram do convite', () => {
    for (const extra of [
      { routines: [{ template_id: 't-1', name: 'Fechamento' }] },
      { created_at: '2026-09-01T00:00:00' },
    ]) {
      expect(() =>
        invitationListResponseSchema.parse({ invitations: [{ ...INVITATION, ...extra }] }),
      ).toThrow();
    }
  });

  it('aceita o convite sem aceite (null) e o membro sem nome (null)', () => {
    expect(() =>
      invitationListResponseSchema.parse({
        invitations: [{ ...INVITATION, accepted_at: null }],
      }),
    ).not.toThrow();
    expect(() =>
      teamListResponseSchema.parse({ members: [{ ...MEMBER, name: null }] }),
    ).not.toThrow();
  });
});

describe('contrato de prospecto', () => {
  const PROSPECT = {
    id: 'p-1',
    name: 'Empresa',
    cnpj: null,
    phone: null,
    email: null,
    color: null,
    description: null,
    segment: null,
    street: null,
    number: null,
    complement: null,
    neighborhood: null,
    city: null,
    state: null,
    cep: null,
    representante_nome: 'Pessoa',
    representante_email: null,
    representante_cpf: null,
    representante_telefone: null,
    representante_cargo: null,
  };

  it('aceita o payload que a tela renderiza', () => {
    expect(prospectSchema.parse(PROSPECT)).toEqual(PROSPECT);
  });

  it('rejeita os campos internos que saíram do payload', () => {
    for (const extra of [
      { user_id: 'u-1' },
      { created_at: '2026-09-01T00:00:00' },
      { converted_at: null },
      { reproved_at: null },
      { converted_client_id: null },
    ]) {
      expect(() => prospectSchema.parse({ ...PROSPECT, ...extra })).toThrow();
    }
  });
});
