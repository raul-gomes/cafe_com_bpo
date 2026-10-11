import { apiClient } from './client';

export type OrigemContato = 'livre' | 'prospecto' | 'cliente';

export interface ContactResponse {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empresa: string | null;
  origem: OrigemContato;
  /** False quando a empresa não tem representante nomeado: a linha traz o
   *  telefone/e-mail do próprio cadastro e não é editável aqui. */
  tem_pessoa: boolean;
}

export interface ContactPayload {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  empresa?: string | null;
}

export interface ListContactsParams {
  q?: string;
  origem?: OrigemContato;
}

export async function listContacts(
  params: ListContactsParams = {}
): Promise<ContactResponse[]> {
  const { data } = await apiClient.get('/contacts/', { params });
  return data;
}

export async function createContact(
  payload: ContactPayload
): Promise<ContactResponse> {
  const { data } = await apiClient.post('/contacts/', payload);
  return data;
}

export async function updateContact(
  contactId: string,
  payload: Partial<ContactPayload>
): Promise<ContactResponse> {
  const { data } = await apiClient.patch(`/contacts/${contactId}`, payload);
  return data;
}

export async function deleteContact(contactId: string): Promise<void> {
  await apiClient.delete(`/contacts/${contactId}`);
}
