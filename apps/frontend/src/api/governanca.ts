import { apiClient } from './client';

export interface DealProposal {
  id: string;
  client_name?: string | null;
  number?: number | null;
  final_price?: number | null;
  created_at?: string;
}

export interface DealContract {
  id: string;
  number?: number | null;
  status: string;
  finalized_at?: string | null;
  created_at?: string;
}

export interface TimelineEvent {
  type: 'created' | 'sent' | 'approved' | 'rejected' | 'changes' | 'pending';
  label: string;
  date?: string | null;
  mock?: boolean;
}

export type DealStatus = 'conquistado' | 'em_negociacao' | 'perdido';

export interface Deal {
  id: string;
  name: string;
  cnpj?: string | null;
  segment?: string | null;
  color?: string | null;
  city?: string | null;
  state?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
  representante_nome?: string | null;
  representante_cargo?: string | null;
  representante_email?: string | null;
  representante_telefone?: string | null;
  representante_cpf?: string | null;
  status: DealStatus;
  reference_date: string;
  client_id?: string | null;
  proposal?: DealProposal | null;
  contract?: DealContract | null;
  timeline: TimelineEvent[];
}

export interface GovernancaResponse {
  months: string[];
  deals: Deal[];
}

export const getGovernanca = async () => {
  const response = await apiClient.get<GovernancaResponse>('/governanca/deals');
  return response.data;
};