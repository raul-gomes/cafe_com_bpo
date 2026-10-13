/**
 * Periods of the task filters (Hoje, Semana, Mês, Ano, manual range).
 *
 * Pure functions of a reference date, so the calendar rules are tested with
 * pinned dates instead of the wall clock. Weeks start on Monday and end on
 * Sunday; every bound is a whole local day.
 */

export interface Period {
  start: Date;
  end: Date;
}

export type FilterMode = 'all' | 'today' | 'week' | 'month' | 'year' | 'overdue';

/** Far end used by an open-ended manual range ("from this date on"). */
const FAR_FUTURE = new Date(9999, 11, 31, 23, 59, 59, 999);
/** Far start used by a range with only an end date ("up to this date"). */
const FAR_PAST = new Date(1970, 0, 1, 0, 0, 0, 0);

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/**
 * Monday-to-Sunday week that contains the date.
 *
 * Sunday belongs to the week that ends on it (AUD-016): the old formula
 * `date - getDay() + 1` treated Sunday (0) as the eve of the next Monday.
 *
 * @param today Reference date.
 * @returns The week bounds.
 */
export function weekBounds(today: Date): Period {
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: startOfDay(monday), end: endOfDay(sunday) };
}

/**
 * Period of a quick filter.
 *
 * @param mode Filter button.
 * @param today Reference date.
 * @returns The period, or `null` for "all" and "overdue" (no period).
 */
export function periodForMode(mode: FilterMode, today: Date): Period | null {
  if (mode === 'today') return { start: startOfDay(today), end: endOfDay(today) };
  if (mode === 'week') return weekBounds(today);
  if (mode === 'month') {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }
  if (mode === 'year') {
    return {
      start: new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0),
      end: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }
  return null;
}

/** Parses a `yyyy-mm-dd` input value as a local date (never UTC). */
const parseLocalDate = (value: string): Date => {
  const [year, month, dayOfMonth] = value.split('-').map(Number);
  return new Date(year, month - 1, dayOfMonth);
};

/**
 * Period picked with the two date inputs (AUD-015).
 *
 * @param from First day (`yyyy-mm-dd`), or empty.
 * @param to Last day (`yyyy-mm-dd`), or empty.
 * @returns The period and, when the range is invalid, the message to show.
 */
export function manualRange(from: string, to: string): { period: Period | null; error: string | null } {
  if (!from && !to) return { period: null, error: null };
  const start = from ? startOfDay(parseLocalDate(from)) : FAR_PAST;
  const end = to ? endOfDay(parseLocalDate(to)) : FAR_FUTURE;
  if (end < start) return { period: null, error: 'A data final é anterior à inicial.' };
  return { period: { start, end }, error: null };
}
