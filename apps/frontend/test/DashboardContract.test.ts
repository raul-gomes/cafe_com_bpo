import { describe, expect, it } from 'vitest';

import { dashboardSummarySchema } from '../src/schemas/dashboard';

/**
 * Contrato de payload do painel (regra §6).
 *
 * O resumo do painel era um `interface` escrito à mão: o TypeScript conferia o
 * que o teste author escrevia, não o que o servidor mandava. Um campo que
 * saísse do backend chegaria na tela e o tipo continuaria afirmar que ele
 * existia. O schema é `.strict()` — sem isso o Zod descarta a chave extra em
 * silêncio e o `.parse()` nãoDIRIA nada.
 */

const RESUMO = {
  user_name: 'Ana',
  urgent_tasks: [
    {
      id: 't-1',
      title: 'Fechar planilha',
      client_name: 'Empresa Alfa',
      deadline: '2026-10-02T12:00:00Z',
      days_remaining: 1,
      is_overdue: false,
    },
  ],
  activities: [
    {
      id: 'n-1',
      type: 'post_commented',
      created_at: '2026-10-01T12:00:00Z',
      is_read: false,
      post_id: 'd-1',
      triggered_by_name: 'Bruno',
      message_snippet: 'Comentário',
    },
  ],
  pending_invitations: [
    {
      invitation_id: 'i-1',
      client_name: 'Empresa Alfa',
      inviter_name: 'Bruno',
      created_at: '2026-10-01T12:00:00Z',
    },
  ],
  stats: { pending_tasks_count: 4, unread_notifications_count: 25 },
};

describe('contrato do resumo do painel', () => {
  it('aceita o payload que o painel renderiza', () => {
    expect(dashboardSummarySchema.parse(RESUMO)).toEqual(RESUMO);
  });

  it('rejeita a chave que nenhuma tela lê', () => {
    // `internal_counter` saiu do backend e não é lido por ninguém.
    expect(() =>
      dashboardSummarySchema.parse({ ...RESUMO, internal_counter: 7 }),
    ).toThrow();
  });

  it('rejeita o campo de prioridade e fase que saíram da tarefa urgente', () => {
    for (const extra of [{ priority: 'high' }, { phase_id: 'p-1' }]) {
      expect(() =>
        dashboardSummarySchema.parse({
          ...RESUMO,
          urgent_tasks: [{ ...RESUMO.urgent_tasks[0], ...extra }],
        }),
      ).toThrow();
    }
  });

  it('aceita a tarefa e o convite sem os campos opcionais', () => {
    const sem_opcionais = {
      ...RESUMO,
      urgent_tasks: [
        {
          id: 't-2',
          title: 'Sem prazo',
          client_name: 'Empresa',
          is_overdue: false,
        },
      ],
      pending_invitations: [
        { invitation_id: 'i-2', created_at: '2026-10-01T12:00:00Z' },
      ],
      activities: [],
    };
    expect(() => dashboardSummarySchema.parse(sem_opcionais)).not.toThrow();
  });

  it('aceita o convite sem nome de empresa e o contador em zero', () => {
    expect(() =>
      dashboardSummarySchema.parse({
        ...RESUMO,
        pending_invitations: [
          { invitation_id: 'i-3', created_at: '2026-10-01T12:00:00Z' },
        ],
        stats: { pending_tasks_count: 0, unread_notifications_count: 0 },
      }),
    ).not.toThrow();
  });
});
