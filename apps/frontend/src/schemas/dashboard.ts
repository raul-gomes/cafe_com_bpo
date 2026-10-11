import { z } from 'zod';

/**
 * Contrato de payload do painel (regra §6).
 *
 * O resumo é o primeiro paint de `/painel`: `DashboardPage.tsx` desenha o
 * carrossel de urgentes, a feed de atividades e os cartões de convite, e a barra
 * lateral mostra os dois contadores. Cada campo aqui existe porque alguma dessas
 * telas o lê.
 *
 * `.strict()` de propósito: o Zod **descarta** chaves desconhecidas por padrão,
 * então um campo que voltasse a ser enviado entraria em silêncio e o `.parse()`
 * viraria decorativo — que é exatamente o que a regra §6 pede para evitar.
 */

/** Tarefa do carrossel de urgentes. Não é o `TaskResponse`: o resumo entrega só
 *  o que o painel desenha. `priority` e `phase_id` saíram — o painel destaca a
 *  tarefa pelo prazo, e quem a conclui manda a fase que a própria página tirou
 *  da lista de fases. */
const urgentTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    client_name: z.string(),
    deadline: z.string().nullable().optional(),
    days_remaining: z.number().nullable().optional(),
    is_overdue: z.boolean(),
  })
  .strict();

/** Entrada da feed de atividades. `comment_id` saiu: era `None` fixo e nada o
 *  lia. `post_id` só vem preenchido para post da discussão, e é por ele que o
 *  clique navega. */
const activitySchema = z
  .object({
    id: z.string(),
    type: z.string(),
    created_at: z.string(),
    is_read: z.boolean(),
    post_id: z.string().nullable().optional(),
    triggered_by_name: z.string().nullable().optional(),
    message_snippet: z.string().nullable().optional(),
  })
  .strict();

/** Cartão de convite pendente: quem convidou, para qual empresa e quando
 *  chegou. `client_id` e `expires_at` saíram — nada navega pelo id, e a consulta
 *  já descarta os expirados. */
const pendingInvitationSchema = z
  .object({
    invitation_id: z.string(),
    client_name: z.string().nullable().optional(),
    inviter_name: z.string().nullable().optional(),
    created_at: z.string(),
  })
  .strict();

/** Os dois contadores da barra lateral. `unread_notifications_count` é o total
 *  real de não lidas, não o tamanho da feed — que vem truncada em 20 linhas. */
const dashboardStatsSchema = z
  .object({
    pending_tasks_count: z.number(),
    unread_notifications_count: z.number(),
  })
  .strict();

export const dashboardSummarySchema = z
  .object({
    user_name: z.string(),
    urgent_tasks: z.array(urgentTaskSchema),
    activities: z.array(activitySchema),
    pending_invitations: z.array(pendingInvitationSchema),
    stats: dashboardStatsSchema,
  })
  .strict();

export type UrgentTaskItem = z.infer<typeof urgentTaskSchema>;
export type ActivityItem = z.infer<typeof activitySchema>;
export type PendingInvitationItem = z.infer<typeof pendingInvitationSchema>;
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
