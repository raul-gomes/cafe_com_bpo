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
  client_id: string | null;
  prospect_id: string | null;
  updated_at: string | null;
}

export interface ContactPayload {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  empresa?: string | null;
}

/** Campos da pessoa — o nome da empresa pertence ao cadastro da empresa e não
 *  é enviado aqui (evita duas fontes para o mesmo dado). */
export interface SourceContactPayload {
  nome: string;
  telefone?: string | null;
  email?: string | null;
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

/** Corrige o contato no cadastro de origem (fonte única de verdade).
 *
 * Vale para as duas origens: o prospecto em aberto e o cliente — o
 * representante do cliente é o do prospecto que o originou, então a edição vai
 * pelo `prospect_id`. */
export async function updateSourceContact(
  prospectId: string,
  payload: SourceContactPayload
): Promise<ContactResponse> {
  const { data } = await apiClient.patch(`/contacts/prospects/${prospectId}`, payload);
  return data;
}

export async function deleteContact(contactId: string): Promise<void> {
  await apiClient.delete(`/contacts/${contactId}`);
}
