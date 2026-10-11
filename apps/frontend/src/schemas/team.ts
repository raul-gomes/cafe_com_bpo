import { z } from 'zod';

// Contrato de payload do módulo de equipe (regra §6 — Fase 3, item 5).
//
// Os schemas são `.strict()` de propósito: o Zod **descarta** chaves
// desconhecidas por padrão, então um campo que voltou a ser enviado passaria
// silenciosamente e o `.parse()` não acusaria nada. Com `.strict()`, a deriva vira
// falha — no teste primeiro, na tela nunca.

const routineAccessSchema = z.object({
  template_id: z.string(),
  name: z.string(),
}).strict();

// Card de membro: avatar (iniciais de name ou email), nome, e-mail e os chips
// de rotina. `joined_at`, `role` e `is_active` saíram — a tela não mostra data
// de entrada nem papel.
const teamMemberSchema = z.object({
  user_id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  routines: z.array(routineAccessSchema),
}).strict();

export const teamListResponseSchema = z.object({
  members: z.array(teamMemberSchema),
}).strict();

// Card de "Convites enviados": e-mail, status, expiração e aceite. `routines`
// e `created_at` saíram — as rotinas eram montadas com duas queries por
// convite e nunca exibidas.
const invitationSchema = z.object({
  invitation_id: z.string(),
  email: z.string(),
  status: z.string(),
  expires_at: z.string(),
  accepted_at: z.string().nullable(),
}).strict();

export const invitationListResponseSchema = z.object({
  invitations: z.array(invitationSchema),
}).strict();

export const acceptResponseSchema = z.object({
  status: z.string(),
  client_name: z.string().nullable(),
  client_id: z.string().nullable(),
}).strict();

export const inviteBatchResponseSchema = z.object({
  results: z.array(
    z.object({
      email: z.string(),
      status: z.string(),
      invitation_id: z.string().nullable(),
      error: z.string().nullable(),
    }).strict(),
  ),
  total_sent: z.number(),
  total_errors: z.number(),
}).strict();

export type TeamMemberData = z.infer<typeof teamMemberSchema>;
export type TeamListData = z.infer<typeof teamListResponseSchema>;
export type InvitationData = z.infer<typeof invitationSchema>;
export type InvitationListData = z.infer<typeof invitationListResponseSchema>;
export type AcceptData = z.infer<typeof acceptResponseSchema>;
export type InviteResultData = z.infer<typeof inviteBatchResponseSchema>['results'][number];
export type InviteBatchData = z.infer<typeof inviteBatchResponseSchema>;
