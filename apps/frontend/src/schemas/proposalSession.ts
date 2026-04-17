import { PricingFormData } from './pricing';
import { PricingResult } from '../lib/pricingEngine';

export const SESSION_KEY = 'cafe_bpo_proposal';

export interface ProposalSession {
  form: PricingFormData;
  pricing: PricingResult;
  clientName: string;
}

/** Utilitário para salvar a proposta no sessionStorage antes de navegar */
export function saveProposalSession(data: ProposalSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}
