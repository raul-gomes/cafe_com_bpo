import { describe, it, expect } from 'vitest';
import {
  parseDeadlineDate,
  todayDate,
  daysOverdue,
  isDeadlineOverdue,
} from '../src/lib/deadline';

describe('deadline helpers', () => {
  it('parseDeadlineDate extrai a data de calendário ignorando hora/fuso', () => {
    const d = parseDeadlineDate('2026-08-24T18:00:00Z');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(24);
    expect(d.getHours()).toBe(0);
  });

  it('prazo de HOJE (mesmo instante já passado) não é atrasado', () => {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}T03:00:00Z`;
    expect(isDeadlineOverdue(iso)).toBe(false);
    expect(daysOverdue(iso)).toBe(0);
  });

  it('prazo de ontem está atrasado exatamente 1 dia', () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const iso = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(
      y.getDate(),
    ).padStart(2, '0')}T18:00:00Z`;
    expect(isDeadlineOverdue(iso)).toBe(true);
    expect(daysOverdue(iso)).toBe(1);
  });

  it('prazo futuro retorna dias restantes positivos', () => {
    const f = new Date();
    f.setDate(f.getDate() + 2);
    const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(
      f.getDate(),
    ).padStart(2, '0')}T18:00:00Z`;
    expect(daysOverdue(iso)).toBe(-2);
    expect(isDeadlineOverdue(iso)).toBe(false);
  });

  it('sem prazo: nunca atrasado e 0 dias', () => {
    expect(isDeadlineOverdue(undefined)).toBe(false);
    expect(isDeadlineOverdue(null)).toBe(false);
    expect(daysOverdue(undefined)).toBe(0);
  });

  it('todayDate zera componentes de hora', () => {
    const t = todayDate();
    expect([t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()]).toEqual([
      0, 0, 0, 0,
    ]);
  });
});
