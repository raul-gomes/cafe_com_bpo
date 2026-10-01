import { apiClient } from './client';
import {
  acceptResponseSchema,
  inviteBatchResponseSchema,
  invitationListResponseSchema,
  teamListResponseSchema,
  type AcceptData,
  type InviteBatchData,
  type InvitationListData,
  type TeamListData,
} from '../schemas/team';

/**
 * Narrowing the response body to the parsed DTO while keeping the Axios
 * envelope (`data`, `status`, ...) that the callers destructure.
 */
const withData =
  <T,>(parse: (raw: unknown) => T) =>
  (response: { data: unknown }): { data: T } => ({ ...response, data: parse(response.data) });

export interface InviteCreate {
  emails: string[];
  template_ids: string[];
}

// The payload is parsed against the Zod schema (regra §6): the types come from
// `z.infer`, so there is one source of truth for the contract, and a server that
// starts sending a removed field fails here instead of rendering `undefined`.
export const inviteCollaborator = (clientId: string, data: InviteCreate) =>
  apiClient
    .post<unknown>(`/clients/${clientId}/invite`, data)
    .then(withData(raw => inviteBatchResponseSchema.parse(raw) as InviteBatchData));

export const acceptInvitation = (token: string) =>
  apiClient
    .get<unknown>('/invitations/accept', { params: { token } })
    .then(withData(raw => acceptResponseSchema.parse(raw) as AcceptData));

export const acceptInvitationById = (invitationId: string) =>
  apiClient
    .post<unknown>(`/invitations/${invitationId}/accept`)
    .then(withData(raw => acceptResponseSchema.parse(raw) as AcceptData));

export const declineInvitationById = (invitationId: string) =>
  apiClient.post<{ status: string }>(`/invitations/${invitationId}/decline`);

export const listTeamMembers = (clientId: string) =>
  apiClient
    .get<unknown>(`/clients/${clientId}/team`)
    .then(withData(raw => teamListResponseSchema.parse(raw) as TeamListData));

export const removeTeamMember = (clientId: string, userId: string) =>
  apiClient.delete(`/clients/${clientId}/team/${userId}`);

export const revokeRoutineFromMember = (
  clientId: string,
  userId: string,
  templateId: string,
) =>
  apiClient.delete(`/clients/${clientId}/team/${userId}/routines/${templateId}`);

export const grantRoutineToMember = (
  clientId: string,
  userId: string,
  templateId: string,
) => apiClient.post(`/clients/${clientId}/team/${userId}/routines/${templateId}`);

export const listInvitations = (clientId: string) =>
  apiClient
    .get<unknown>(`/clients/${clientId}/invitations`)
    .then(withData(raw => invitationListResponseSchema.parse(raw) as InvitationListData));

// The resend response is the same DTO as the listing, but the page only shows a
// toast — the payload is discarded. It is parsed anyway so the contract has a
// single shape instead of a silent hole.
export const resendInvitation = (clientId: string, invitationId: string) =>
  apiClient.post(`/clients/${clientId}/invitations/${invitationId}/resend`);

export const cancelInvitation = (clientId: string, invitationId: string) =>
  apiClient.delete(`/clients/${clientId}/invitations/${invitationId}`);
