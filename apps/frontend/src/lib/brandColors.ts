/**
 * brandColors.ts
 *
 * Resolve as cores primária/secundária da identidade visual do usuário
 * (definidas no perfil) com fallback para a paleta padrão do modelo
 * whitelabel de proposta.
 */
import { User } from '../context/AuthContext';

export const DEFAULT_PRIMARY = '#0f172a';
export const DEFAULT_SECONDARY = '#0284c7';

export interface BrandColors {
  primary: string;
  secondary: string;
}

export function resolveBrandColors(provider?: User | null): BrandColors {
  return {
    primary: provider?.company_color_code || DEFAULT_PRIMARY,
    secondary: provider?.company_color_secondary || DEFAULT_SECONDARY,
  };
}

export interface ProviderTitleResolution {
  /** Nome a exibir no cabeçalho da proposta (pode ficar em branco). */
  title: string;
  /** True quando não há nome empresarial e o usuário deve decidir. */
  requiresChoice: boolean;
  /** Nome pessoal sugerido quando requiresChoice. */
  personalName?: string;
}

/**
 * Regra do título da proposta:
 * 1. nome fantasia → 2. razão social → 3. pergunta ao usuário
 *    (nome pessoal ou em branco).
 */
export function resolveProviderTitle(provider?: User | null): ProviderTitleResolution {
  const fantasia = provider?.company_nome_fantasia?.trim();
  if (fantasia) return { title: fantasia, requiresChoice: false };

  const razao = provider?.company_razao_social?.trim();
  if (razao) return { title: razao, requiresChoice: false };

  return { title: '', requiresChoice: !!provider?.name, personalName: provider?.name };
}
