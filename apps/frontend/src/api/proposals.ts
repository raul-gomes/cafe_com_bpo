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

export interface PublicProposalProvider {
  name?: string | null;
  email?: string | null;
  company_nome_fantasia?: string | null;
  company_razao_social?: string | null;
  company_logo_url?: string | null;
  avatar_url?: string | null;
  company_color_code?: string | null;
  company_color_secondary?: string | null;
  company_commercial_phone?: string | null;
  whatsapp?: string | null;
}

export interface PublicProposal {
  client_name: string;
  number?: number | null;
  input_payload: any;
  result_payload: any;
  created_at: string;
  expires_at: string | null;
  client_decision: ClientDecision | null;
  client_observation: string | null;
  client_decided_at: string | null;
  provider?: PublicProposalProvider | null;
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