import { z } from 'zod';

/**
 * Contract of the Beta signups (`POST/GET /beta/signups`).
 *
 * `.strict()` because Zod drops unknown keys: without it, a field the backend
 * started sending again would slip in silently and the parse would be
 * decorative (same rule as `schemas/plans.ts`).
 */

export const betaProfileSchema = z.enum(['starting', 'growing', 'accounting_office', 'other']);
export const betaClientRangeSchema = z.enum(['0', '1-5', '6-15', '16-30', '30+']);

export type BetaProfile = z.infer<typeof betaProfileSchema>;
export type BetaClientRange = z.infer<typeof betaClientRangeSchema>;

/** Payload of the landing page form. */
export interface BetaSignupInput {
  name: string;
  email: string;
  whatsapp?: string;
  profile: BetaProfile;
  client_range: BetaClientRange;
  challenge?: string;
  source?: string;
  lgpd_consent: boolean;
  /** Honeypot against bots: stays empty for people. */
  website?: string;
}

/** One signup as the admin "Inscrições Beta" page renders it. */
export const betaSignupSchema = z
  .object({
    name: z.string(),
    email: z.string(),
    whatsapp: z.string().nullable(),
    profile: z.string(),
    client_range: z.string(),
    challenge: z.string().nullable(),
    signed_up_at: z.string(),
  })
  .strict();

export const betaSignupListSchema = z.array(betaSignupSchema);

export type BetaSignup = z.infer<typeof betaSignupSchema>;
