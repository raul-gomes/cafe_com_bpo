import { apiClient } from './client';
import {
  prospectConvertResponseSchema,
  prospectSchema,
  type ProspectData,
  type ProspectWrite,
  type ProspectConvertResponse,
} from '../schemas/prospects';

export type { ProspectData, ProspectWrite, ProspectConvertResponse };

export const getProspects = async () => {
  const response = await apiClient.get('/prospects/');
  return response.data.map((row: unknown) => prospectSchema.parse(row));
};

export const createProspect = async (data: ProspectWrite) => {
  const response = await apiClient.post('/prospects/', data);
  return prospectSchema.parse(response.data);
};

export const updateProspect = async (id: string, data: Partial<ProspectData>) => {
  const response = await apiClient.put(`/prospects/${id}`, data);
  return prospectSchema.parse(response.data);
};

export const deleteProspect = async (id: string) => {
  const response = await apiClient.delete(`/prospects/${id}`);
  return response.data;
};

export const convertProspect = async (id: string) => {
  const response = await apiClient.post(`/prospects/${id}/convert`);
  return prospectConvertResponseSchema.parse(response.data) as ProspectConvertResponse;
};

export const reproveProspect = async (id: string) => {
  const response = await apiClient.post(`/prospects/${id}/reprove`);
  return prospectSchema.parse(response.data);
};

export const unreproveProspect = async (id: string) => {
  const response = await apiClient.post(`/prospects/${id}/unreprove`);
  return prospectSchema.parse(response.data);
};
