import { apiClient } from './client';
import { type BetaSignup, type BetaSignupInput, betaSignupListSchema } from '../schemas/beta';

export type { BetaSignup, BetaSignupInput };
export type { BetaProfile, BetaClientRange } from '../schemas/beta';

/**
 * Public Beta signup (landing page). The answer never reveals whether the
 * e-mail was already registered.
 *
 * @param input Form data.
 * @returns The neutral acknowledgement.
 */
export async function createBetaSignup(input: BetaSignupInput): Promise<{ message: string }> {
  const { data } = await apiClient.post('/beta/signups', input);
  return data;
}

/**
 * Signups for the admin page, newest first (403 for non-admins).
 *
 * @returns The validated list.
 */
export async function listBetaSignups(): Promise<BetaSignup[]> {
  const { data } = await apiClient.get('/beta/signups');
  return betaSignupListSchema.parse(data);
}
