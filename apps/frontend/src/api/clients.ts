import { apiClient } from './client';

export interface ClientData {
  id: string;
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
}

export const getClients = async () => {
  const response = await apiClient.get('/clients/');
  return response.data as ClientData[];
};

export const createClient = async (data: Omit<ClientData, 'id'>) => {
  const response = await apiClient.post('/clients/', data);
  return response.data as ClientData;
};

export const updateClient = async (id: string, data: Partial<ClientData>) => {
  const response = await apiClient.put(`/clients/${id}`, data);
  return response.data as ClientData;
};

export const deleteClient = async (id: string) => {
  const response = await apiClient.delete(`/clients/${id}`);
  return response.data;
};

export const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/auth/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};
