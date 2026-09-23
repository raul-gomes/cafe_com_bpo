import { apiClient } from './client';

export interface ContractSection {
  title: string;
  content: string;
}

export interface ContractData {
  id: string;
  prospect_id: string | null;
  proposal_id: string | null;
  client_name: string;
  sections: ContractSection[];
  status: 'draft' | 'finalized';
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractTemplateData {
  id: string;
  sections: ContractSection[];
  updated_at: string;
}

export interface ContractPreviewData {
  sections: ContractSection[];
}

export interface ContractFinalizeResponse {
  contract_id: string;
  client_id: string | null;
}

export interface ContractGeneratePayload {
  prospect_id: string;
  proposal_id?: string | null;
}

export const getContractTemplate = async () => {
  const response = await apiClient.get('/contracts/templates');
  return response.data as ContractTemplateData;
};

export const updateContractTemplate = async (sections: ContractSection[]) => {
  const response = await apiClient.put('/contracts/templates', { sections });
  return response.data as ContractTemplateData;
};

export const generateContract = async (payload: ContractGeneratePayload) => {
  const response = await apiClient.post('/contracts/generate', payload);
  return response.data as ContractData;
};

export const getContracts = async () => {
  const response = await apiClient.get('/contracts/');
  return response.data as ContractData[];
};

export const getContract = async (id: string) => {
  const response = await apiClient.get(`/contracts/${id}`);
  return response.data as ContractData;
};

export const previewContract = async (id: string) => {
  const response = await apiClient.get(`/contracts/${id}/preview`);
  return response.data as ContractPreviewData;
};

export const updateContract = async (id: string, sections: ContractSection[]) => {
  const response = await apiClient.patch(`/contracts/${id}`, { sections });
  return response.data as ContractData;
};

export const finalizeContract = async (id: string) => {
  const response = await apiClient.post(`/contracts/${id}/finalize`);
  return response.data as ContractFinalizeResponse;
};

export const deleteContract = async (id: string) => {
  const response = await apiClient.delete(`/contracts/${id}`);
  return response.data;
};