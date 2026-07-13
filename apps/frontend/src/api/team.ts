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

export const inviteCollaborator = (clientId: string, data: InviteCreate) =>
  apiClient.post<InviteBatchResponse>(`/clients/${clientId}/invite`, data);

export const acceptInvitation = (token: string) =>
  apiClient.get<AcceptResponse>('/invitations/accept', { params: { token } });

export const listTeamMembers = (clientId: string) =>
  apiClient.get<TeamListResponse>(`/clients/${clientId}/team`);

export const removeTeamMember = (clientId: string, userId: string) =>
  apiClient.delete(`/clients/${clientId}/team/${userId}`);
