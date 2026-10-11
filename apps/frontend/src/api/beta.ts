import { apiClient } from './client';

export type BetaPerfil = 'comecando' | 'crescendo' | 'escritorio_contabil' | 'outro';
export type BetaFaixaClientes = '0' | '1-5' | '6-15' | '16-30' | '30+';

export interface BetaSignupInput {
  nome: string;
  email: string;
  whatsapp?: string;
  perfil: BetaPerfil;
  faixa_clientes: BetaFaixaClientes;
  desafio?: string;
  origem?: string;
  consentimento_lgpd: boolean;
  /** Campo-armadilha contra robôs: fica vazio para pessoas. */
  website?: string;
}

/** Inscrição pública de Beta (página inicial). A resposta não revela se o e-mail já existia. */
export async function createBetaSignup(input: BetaSignupInput): Promise<{ message: string }> {
  const { data } = await apiClient.post('/beta/inscricoes', input);
  return data;
}
