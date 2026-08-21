import { apiClient } from './client';

export interface InviteCreate {
  emails: string[];
  template_ids: string[];
}

export interface InviteResult {
  email: string;
  status: string;
  invitation_id?: string;
  error?: string;
}

export interface InviteBatchResponse {
  results: InviteResult[];
  total_sent: number;
  total_errors: number;
}

export interface TeamMemberResponse {
  user_id: string;
  name: string | null;
  email: string;
  joined_at: string;
  role: string | null;
  is_active: boolean;
  routines: { template_id: string; name: string }[];
}

export interface TeamListResponse {
  members: TeamMemberResponse[];
}

export interface AcceptResponse {
  status: string;
  client_name?: string;
  client_id?: string;
}

export interface InvitationResponse {
  invitation_id: string;
  email: string;
  status: string;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  routines: { template_id: string; name: string }[];
}

export interface InvitationListResponse {
  invitations: InvitationResponse[];
}

export const inviteCollaborator = (clientId: string, data: InviteCreate) =>
  apiClient.post<InviteBatchResponse>(`/clients/${clientId}/invite`, data);

export const acceptInvitation = (token: string) =>
  apiClient.get<AcceptResponse>('/invitations/accept', { params: { token } });

export const acceptInvitationById = (invitationId: string) =>
  apiClient.post<AcceptResponse>(`/invitations/${invitationId}/accept`);

export const declineInvitationById = (invitationId: string) =>
  apiClient.post<{ status: string }>(`/invitations/${invitationId}/decline`);

export const listTeamMembers = (clientId: string) =>
  apiClient.get<TeamListResponse>(`/clients/${clientId}/team`);

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
) =>
  apiClient.post(`/clients/${clientId}/team/${userId}/routines/${templateId}`);

export const listInvitations = (clientId: string) =>
  apiClient.get<InvitationListResponse>(`/clients/${clientId}/invitations`);

export const resendInvitation = (clientId: string, invitationId: string) =>
  apiClient.post<InvitationResponse>(`/clients/${clientId}/invitations/${invitationId}/resend`);

export const cancelInvitation = (clientId: string, invitationId: string) =>
  apiClient.delete(`/clients/${clientId}/invitations/${invitationId}`);
