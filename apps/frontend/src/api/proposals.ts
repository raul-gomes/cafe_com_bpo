import { apiClient } from './client';

export type ClientDecision = 'approved' | 'changes' | 'rejected';

export const CLIENT_DECISION_LABELS: Record<ClientDecision, string> = {
  approved: 'Aprovado',
  changes: 'Com alterações',
  rejected: 'Reprovado',
};

export interface ShareLinkResponse {
  url: string;
  expires_at: string;
}

export interface PublicProposal {
  client_name: string;
  input_payload: any;
  result_payload: any;
  created_at: string;
  expires_at: string | null;
  client_decision: ClientDecision | null;
  client_observation: string | null;
  client_decided_at: string | null;
}

export const generateShareLink = async (proposalId: string): Promise<ShareLinkResponse> => {
  const { data } = await apiClient.post<ShareLinkResponse>(`/proposals/${proposalId}/share-link`);
  return data;
};

export const getPublicProposal = async (hash: string): Promise<PublicProposal> => {
  const { data } = await apiClient.get<PublicProposal>(`/proposals/public/${hash}`);
  return data;
};

export const submitClientDecision = async (
  hash: string,
  decision: ClientDecision,
  observation: string | null,
): Promise<PublicProposal> => {
  const { data } = await apiClient.post<PublicProposal>(
    `/proposals/public/${hash}/decision`,
    { decision, observation },
  );
  return data;
};