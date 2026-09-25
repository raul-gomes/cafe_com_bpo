import { apiClient } from './client';

export interface ProspectData {
  id: string;
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  color?: string;
  description?: string;
  segment?: string;
  representante_nome?: string;
  representante_email?: string;
  representante_cpf?: string;
  representante_telefone?: string;
  representante_cargo?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  converted_client_id?: string | null;
  converted_at?: string | null;
  reproved_at?: string | null;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

export interface ProspectConvertResponse {
  prospect_id: string;
  client_id: string;
}

export const getProspects = async () => {
  const response = await apiClient.get('/prospects/');
  return response.data as ProspectData[];
};

export const createProspect = async (data: Omit<ProspectData, 'id'>) => {
  const response = await apiClient.post('/prospects/', data);
  return response.data as ProspectData;
};

export const updateProspect = async (id: string, data: Partial<ProspectData>) => {
  const response = await apiClient.put(`/prospects/${id}`, data);
  return response.data as ProspectData;
};

export const deleteProspect = async (id: string) => {
  const response = await apiClient.delete(`/prospects/${id}`);
  return response.data;
};

export const convertProspect = async (id: string) => {
  const response = await apiClient.post(`/prospects/${id}/convert`);
  return response.data as ProspectConvertResponse;
};

export const reproveProspect = async (id: string) => {
  const response = await apiClient.post(`/prospects/${id}/reprove`);
  return response.data as ProspectData;
};

export const unreproveProspect = async (id: string) => {
  const response = await apiClient.post(`/prospects/${id}/unreprove`);
  return response.data as ProspectData;
};