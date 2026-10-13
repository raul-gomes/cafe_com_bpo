/**
 * Pricing study: the numbers behind the free PDF of the public calculator.
 *
 * From one filled calculator it derives the operation figures (cost per hour,
 * capacity), the floor price (no profit), a grid of scenarios (margin × payment
 * term) and how much of the team's month one client like this takes.
 */
import type { PricingFormData } from '../schemas/pricing';
import { calculatePricing } from './pricingEngine';

/** Margins shown in the scenarios grid. */
export const STUDY_MARGINS = [0.3, 0.4, 0.5, 0.6] as const;

/** Payment terms and their discounts (same as the calculator). */
export const STUDY_TERMS = [
  { label: 'Mensal', discount: 0 },
  { label: 'Trimestral', discount: 0.05 },
  { label: 'Anual', discount: 0.1 },
] as const;

export interface StudyService {
  name: string;
  minutesPerMonth: number;
  cost: number;
}

export interface StudyScenario {
  margin: number;
  /** Price per term, in the order of STUDY_TERMS. */
  prices: number[];
  /** Whether this is the margin chosen in the calculator. */
  chosen: boolean;
}

export interface PricingStudy {
  costPerHour: number;
  capacityHours: number;
  services: StudyService[];
  totalMinutes: number;
  totalCost: number;
  /** Price that only pays costs and taxes: below it, every month loses money. */
  floorPrice: number;
  chosenPrice: number;
  chosenMargin: number;
  chosenTerm: string;
  scenarios: StudyScenario[];
  /** Share of the team's monthly hours one client like this takes (0–1). */
  capacityShare: number;
  /** How many clients like this fit in the team's month. */
  clientsThatFit: number;
  /** Profit per hour worked for this client, at the chosen scenario. */
  profitPerHour: number;
}

/**
 * Builds the study of a filled calculator.
 *
 * @param form Calculator values.
 * @returns The study, or `null` when the operation is incomplete (no people,
 *   no hours or no active service).
 */
export function buildPricingStudy(form: PricingFormData): PricingStudy | null {
  const chosen = calculatePricing(form.operation, form.services, form.desired_profit_margin, form.term_discount);
  const floor = calculatePricing(form.operation, form.services, 0, 0);
  if (!chosen || !floor) return null;

  const active = form.services.filter(service => service.active);
  if (active.length === 0) return null;

  const services: StudyService[] = active.map((service, index) => ({
    name: service.name,
    minutesPerMonth: service.type === 'time' ? (service.minutes_per_execution || 0) * (service.monthly_quantity || 1) : 0,
    cost: chosen.breakdown.service_costs[index]?.cost ?? 0,
  }));
  const totalMinutes = services.reduce((sum, service) => sum + service.minutesPerMonth, 0);
  const capacityHours = form.operation.people_count * form.operation.hours_per_month;
  const capacityShare = capacityHours > 0 ? totalMinutes / 60 / capacityHours : 0;

  const scenarios = STUDY_MARGINS.map(margin => ({
    margin,
    prices: STUDY_TERMS.map(term => calculatePricing(form.operation, form.services, margin, term.discount)?.final_price ?? 0),
    chosen: Math.abs(margin - form.desired_profit_margin) < 0.001,
  }));

  const term = STUDY_TERMS.find(t => Math.abs(t.discount - form.term_discount) < 0.001);
  const hoursForClient = totalMinutes / 60;

  return {
    costPerHour: chosen.breakdown.cost_per_hour,
    capacityHours,
    services,
    totalMinutes,
    totalCost: chosen.breakdown.total_service_cost,
    floorPrice: floor.final_price,
    chosenPrice: chosen.final_price,
    chosenMargin: form.desired_profit_margin,
    chosenTerm: term?.label ?? 'Mensal',
    scenarios,
    capacityShare,
    clientsThatFit: capacityShare > 0 ? Math.floor(1 / capacityShare) : 0,
    profitPerHour: hoursForClient > 0 ? chosen.breakdown.profit_amount / hoursForClient : 0,
  };
}
