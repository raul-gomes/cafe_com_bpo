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

const FAR_FUTURE = new Date(9999, 11, 31, 23, 59, 59, 999);
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

export function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function queryDatesForMode(
  mode: FilterMode,
  today: Date,
  dateFrom?: string,
  dateTo?: string
): { start_date?: string; end_date?: string } {
  if (dateFrom || dateTo) {
    return {
      start_date: dateFrom && dateFrom.trim() !== '' ? dateFrom : undefined,
      end_date: dateTo && dateTo.trim() !== '' ? dateTo : undefined,
    };
  }
  if (mode === 'today') {
    return { start_date: formatISODate(today), end_date: undefined };
  }
  if (mode === 'week') {
    const monday = new Date(weekBounds(today).start);
    const friday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);
    let end = friday;
    if (endOfDay(end) < endOfDay(today)) {
      end = today;
    }
    return {
      start_date: formatISODate(today),
      end_date: formatISODate(end),
    };
  }
  if (mode === 'month') {
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      start_date: formatISODate(today),
      end_date: formatISODate(monthEnd),
    };
  }
  if (mode === 'year') {
    const yearEnd = new Date(today.getFullYear(), 11, 31);
    return {
      start_date: formatISODate(today),
      end_date: formatISODate(yearEnd),
    };
  }
  if (mode === 'overdue') {
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    return {
      start_date: undefined,
      end_date: formatISODate(yesterday),
    };
  }
  return { start_date: undefined, end_date: undefined };
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
