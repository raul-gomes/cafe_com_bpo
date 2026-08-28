import { apiClient } from './client';

export interface ClientData {
  id: string;
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  color?: string;
  description?: string;
  segment?: string;
  created_at?: string;
  updated_at?: string;
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
  const response = await apiClient.post('/auth/me/avatar', formData);
  return response.data;
};

export const uploadCompanyLogo = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/auth/me/company-logo', formData);
  return response.data;
};

export const updateProfile = async (data: Record<string, unknown>) => {
  const response = await apiClient.patch('/auth/me', data);
  return response.data;
};

export interface CreateUserAdminData {
  email: string;
  password: string;
  name?: string;
  company?: string;
  role: 'user' | 'admin';
}

export const adminCreateUser = async (data: CreateUserAdminData) => {
  const response = await apiClient.post('/auth/admin/users', data);
  return response.data;
};
