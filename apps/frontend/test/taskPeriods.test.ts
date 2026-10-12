import { describe, it, expect } from 'vitest'
import { manualRange, periodForMode, weekBounds } from '../src/lib/taskPeriods'

const day = (iso: string) => new Date(`${iso}T12:00:00`)
const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('task periods (local calendar, week starts on Monday)', () => {
  // AUD-016: on Sunday the week is the one ending that day, not the next one.
  it.each([
    ['2026-10-11', '2026-10-05', '2026-10-11'], // Sunday
    ['2026-10-12', '2026-10-12', '2026-10-18'], // Monday
    ['2026-10-14', '2026-10-12', '2026-10-18'], // Wednesday
    ['2026-11-01', '2026-10-26', '2026-11-01'], // Sunday across months
    ['2027-01-03', '2026-12-28', '2027-01-03'], // Sunday across years
  ])('week of %s runs from %s to %s', (today, start, end) => {
    const { start: s, end: e } = weekBounds(day(today))
    expect([local(s), local(e)]).toEqual([start, end])
    expect([s.getHours(), e.getHours(), e.getMinutes()]).toEqual([0, 23, 59])
  })

  it('month and year cover whole calendar units', () => {
    const month = periodForMode('month', day('2026-02-14'))!
    const year = periodForMode('year', day('2026-02-14'))!
    expect([local(month.start), local(month.end)]).toEqual(['2026-02-01', '2026-02-28'])
    expect([local(year.start), local(year.end)]).toEqual(['2026-01-01', '2026-12-31'])
  })

  it('"all" and "overdue" have no period', () => {
    expect(periodForMode('all', day('2026-10-12'))).toBeNull()
    expect(periodForMode('overdue', day('2026-10-12'))).toBeNull()
  })

  // AUD-015: the manual range is a real period, validated.
  describe('manual range', () => {
    it('spans whole days from the first to the last date', () => {
      const range = manualRange('2026-10-01', '2026-10-15')
      expect(range.error).toBeNull()
      expect([local(range.period!.start), local(range.period!.end)]).toEqual(['2026-10-01', '2026-10-15'])
      expect(range.period!.end.getHours()).toBe(23)
    })

    it('one date alone is an open-ended range', () => {
      expect(local(manualRange('2026-10-01', '').period!.start)).toBe('2026-10-01')
      expect(manualRange('2026-10-01', '').period!.end.getFullYear()).toBeGreaterThan(9000)
      expect(local(manualRange('', '2026-10-15').period!.end)).toBe('2026-10-15')
    })

    it('an end before the start is refused with a message', () => {
      const range = manualRange('2026-10-15', '2026-10-01')
      expect(range.period).toBeNull()
      expect(range.error).toBe('A data final é anterior à inicial.')
    })

    it('no dates means no manual range', () => {
      expect(manualRange('', '')).toEqual({ period: null, error: null })
    })
  })
})
