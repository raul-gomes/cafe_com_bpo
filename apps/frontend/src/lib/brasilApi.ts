// Cliente da Brasil API (https://brasilapi.com.br/api) — consultas públicas
// de CNPJ e CEP. Quando o dado não é encontrado (404) ou a chamada falha,
// os callbacks retornam null para a UI deixar os campos em branco.

export interface BrasilApiCnpj {
  razao_social: string;
  nome_fantasia?: string | null;
  cnae_fiscal_descricao?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  email?: string | null;
  ddd_telefone_1?: string | null;
}

export interface BrasilApiCep {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
}

const BRASIL_API_BASE = 'https://brasilapi.com.br/api';

const onlyDigits = (v: string): string => v.replace(/\D/g, '');

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export async function lookupCnpj(cnpj: string): Promise<BrasilApiCnpj | null> {
  const cleaned = onlyDigits(cnpj);
  if (cleaned.length !== 14) return null;
  return getJson<BrasilApiCnpj>(`${BRASIL_API_BASE}/cnpj/v1/${cleaned}`);
}

export async function lookupCep(cep: string): Promise<BrasilApiCep | null> {
  const cleaned = onlyDigits(cep);
  if (cleaned.length !== 8) return null;
  return getJson<BrasilApiCep>(`${BRASIL_API_BASE}/cep/v1/${cleaned}`);
}