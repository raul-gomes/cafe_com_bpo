import { describe, it, expect } from 'vitest';

// Re-implement helpers here to test in isolation (mirrors PricingCalculatorLayout and OrcamentoDetalhadoPage)
const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const safeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v: number) =>
  safeNum(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const formatPrice = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(value));

const formatNumber = (value: unknown, decimals = 2): string => {
  return safeNumber(value).toFixed(decimals);
};

describe('safeNum / safeNumber helper', () => {
  it('returns 0 for NaN', () => {
    expect(safeNum(NaN)).toBe(0);
    expect(safeNumber(NaN)).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(safeNum(null)).toBe(0);
    expect(safeNumber(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(safeNum(undefined)).toBe(0);
    expect(safeNumber(undefined)).toBe(0);
  });

  it('returns 0 for Infinity and -Infinity', () => {
    expect(safeNum(Infinity)).toBe(0);
    expect(safeNum(-Infinity)).toBe(0);
    expect(safeNumber(Infinity)).toBe(0);
    expect(safeNumber(-Infinity)).toBe(0);
  });

  it('returns the number for valid finite values', () => {
    expect(safeNum(42)).toBe(42);
    expect(safeNum(0)).toBe(0);
    expect(safeNum(-10)).toBe(-10);
    expect(safeNum(3.14)).toBe(3.14);
    expect(safeNumber(42)).toBe(42);
  });

  it('handles numeric strings', () => {
    expect(safeNum('42')).toBe(42);
    expect(safeNum('3.14')).toBe(3.14);
    expect(safeNum('')).toBe(0);
    expect(safeNum('abc')).toBe(0);
  });
});

describe('formatPrice', () => {
  it('returns R$ 0,00 for NaN', () => {
    expect(formatPrice(NaN)).toBe('R$\xa00,00');
  });

  it('returns R$ 0,00 for null/undefined-like values', () => {
    expect(formatPrice(Number(null))).toBe('R$\xa00,00');
  });

  it('formats valid prices correctly', () => {
    expect(formatPrice(1234.56)).toBe('R$\xa01.234,56');
    expect(formatPrice(0)).toBe('R$\xa00,00');
  });
});

describe('formatNumber', () => {
  it('returns 0.00 for NaN', () => {
    expect(formatNumber(NaN)).toBe('0.00');
  });

  it('returns 0.00 for undefined', () => {
    expect(formatNumber(undefined)).toBe('0.00');
  });

  it('formats with correct decimal places', () => {
    expect(formatNumber(3.14159, 2)).toBe('3.14');
    expect(formatNumber(3.14159, 0)).toBe('3');
  });

  it('handles arithmetic that produces NaN', () => {
    const result = 0 / 0; // NaN
    expect(formatNumber(result)).toBe('0.00');
  });

  it('handles Infinity in arithmetic', () => {
    const result = Infinity;
    expect(formatNumber(result)).toBe('0.00');
  });
});

describe('fmt (PricingCalculatorLayout)', () => {
  it('returns R$ 0,00 for NaN', () => {
    expect(fmt(NaN)).toBe('R$\xa00,00');
  });

  it('returns R$ 0,00 for Infinity', () => {
    expect(fmt(Infinity)).toBe('R$\xa00,00');
    expect(fmt(-Infinity)).toBe('R$\xa00,00');
  });

  it('formats valid values', () => {
    expect(fmt(1000)).toBe('R$\xa01.000,00');
  });
});

describe('arithmetic safety', () => {
  it('safeNum prevents NaN propagation in multiplication', () => {
    const a = safeNum(undefined);
    const b = safeNum(10);
    expect(a * b).toBe(0);
  });

  it('safeNum prevents NaN in division', () => {
    const a = safeNum(NaN);
    const b = safeNum(5);
    expect(a / b).toBe(0);
  });

  it('simulates real-world pricing calculation', () => {
    const finalPrice = safeNum(NaN);
    const totalHours = safeNum(undefined) * safeNum(160);
    const costPerHour = totalHours > 0 ? safeNum(5000) / totalHours : 0;

    expect(finalPrice).toBe(0);
    expect(totalHours).toBe(0);
    expect(costPerHour).toBe(0);
  });
});
