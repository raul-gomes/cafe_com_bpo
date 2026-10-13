import { describe, it, expect } from 'vitest';
import { buildPricingStudy } from '../src/lib/pricingStudy';
import { toExcelCsv } from '../src/lib/spreadsheet';
import type { PricingFormData } from '../src/schemas/pricing';

const form = (overrides: Partial<PricingFormData> = {}): PricingFormData => ({
  operation: { total_cost: 9600, people_count: 1, hours_per_month: 160, tax_rate: 6, commission_rate: 0 },
  services: [
    { active: true, name: 'Contas a pagar', type: 'time', minutes_per_execution: 15, monthly_quantity: 40, fixed_value: 0 },
    { active: false, name: 'Desligado', type: 'time', minutes_per_execution: 60, monthly_quantity: 10, fixed_value: 0 },
  ],
  desired_profit_margin: 0.5,
  term_discount: 0,
  ...overrides,
});

describe('pricing study (free PDF of the calculator)', () => {
  it('derives the operation figures and the capacity one client takes', () => {
    const study = buildPricingStudy(form())!;
    expect(study.costPerHour).toBeCloseTo(60);
    expect(study.totalMinutes).toBe(600); // only the active service
    expect(study.capacityShare).toBeCloseTo(600 / 60 / 160);
    expect(study.clientsThatFit).toBe(16);
  });

  it('floor price has no profit and is below every scenario', () => {
    const study = buildPricingStudy(form())!;
    // 10 h × R$ 60 = R$ 600 of cost, taxes of 6% by dividing.
    expect(study.floorPrice).toBeCloseTo(600 / 0.94);
    for (const scenario of study.scenarios) {
      for (const price of scenario.prices) expect(price).toBeGreaterThan(study.floorPrice);
    }
  });

  it('marks the chosen margin and discounts longer terms', () => {
    const study = buildPricingStudy(form())!;
    const chosen = study.scenarios.filter(s => s.chosen);
    expect(chosen.map(s => s.margin)).toEqual([0.5]);
    const [monthly, quarterly, yearly] = chosen[0].prices;
    expect(quarterly).toBeCloseTo(monthly * 0.95);
    expect(yearly).toBeCloseTo(monthly * 0.9);
  });

  it('returns null when the operation is incomplete', () => {
    expect(buildPricingStudy(form({ services: [] }))).toBeNull();
    expect(buildPricingStudy(form({ operation: { ...form().operation, hours_per_month: 0 } }))).toBeNull();
  });
});

describe('spreadsheet export (opens in Excel)', () => {
  it('uses a BOM, semicolons and quotes cells that need it', () => {
    const csv = toExcelCsv(['Nome', 'Obs'], [['Ana; Lima', 'disse "oi"'], ['Bruno', null]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')).toEqual(['Nome;Obs', '"Ana; Lima";"disse ""oi"""', 'Bruno;']);
  });

  it('neutralises formulas typed into a form', () => {
    expect(toExcelCsv(['x'], [['=HYPERLINK("http://mal")']]).slice(1).split('\r\n')[1]).toBe(`"'=HYPERLINK(""http://mal"")"`);
  });
});
