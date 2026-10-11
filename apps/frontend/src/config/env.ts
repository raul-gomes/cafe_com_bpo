/**
 * Configurações centralizadas do frontend.
 * Variáveis VITE_* são embutidas no bundle no momento do build
 * (ver src/vite-env.d.ts para a tipagem).
 */

/** Chave PIX do "Colabore" (pública por natureza: é para receber contribuições). */
export const PIX_KEY = import.meta.env.VITE_PIX_KEY || 'ajude@cafecombpo.com';

/** Recebedor e cidade do QR Code PIX (BR Code). O banco mostra ao pagador o titular real da chave. */
export const PIX_MERCHANT_NAME = import.meta.env.VITE_PIX_MERCHANT_NAME || 'CAFE COM BPO';
export const PIX_MERCHANT_CITY = import.meta.env.VITE_PIX_MERCHANT_CITY || 'SAO PAULO';
