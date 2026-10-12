/**
 * Central frontend settings.
 * VITE_* variables are embedded in the bundle at build time
 * (see src/vite-env.d.ts for the typing).
 */

/** PIX key of "Colabore" (public by nature: it is meant to receive contributions). */
export const PIX_KEY = import.meta.env.VITE_PIX_KEY || 'ajude@cafecombpo.com';

/** Receiver name and city of the PIX QR Code (BR Code). The bank shows the payer the real key holder. */
export const PIX_MERCHANT_NAME = import.meta.env.VITE_PIX_MERCHANT_NAME || 'CAFE COM BPO';
export const PIX_MERCHANT_CITY = import.meta.env.VITE_PIX_MERCHANT_CITY || 'SAO PAULO';
