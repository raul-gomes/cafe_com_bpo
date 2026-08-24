/**
 * Configurações centralizadas do frontend.
 * Variáveis VITE_* são embutidas no bundle no momento do build
 * (ver src/vite-env.d.ts para a tipagem).
 */

/** Chave PIX exibida nos modais de doação ("Nos ajude"). */
export const PIX_KEY = import.meta.env.VITE_PIX_KEY ?? 'cafe@cafecombpo.com.br';
