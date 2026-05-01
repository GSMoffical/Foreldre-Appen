import { describe, expect, it } from 'vitest'
import {
  addCalendarDaysOslo,
  formatCalendarPeriodContextLabel,
  formatDateKeyInTimeZone,
  getRecurrenceOccurrenceDatesOslo,
  todayKeyOslo,
  weekDateKeysMondayStartOslo,
} from '../osloCalendar'

describe('osloCalendar', () => {
  it('formats an instant as Oslo date key', () => {
    const instant = new Date('2026-03-23T23:30:00.000Z')
    expect(formatDateKeyInTimeZone(instant, 'Europe/Oslo')).toBe('2026-03-24')
  })

  it('returns today key in Oslo timezone', () => {
    const instant = new Date('2026-01-10T22:30:00.000Z')
    expect(todayKeyOslo(instant)).toBe('2026-01-10')
  })

  it('adds calendar days by Oslo day boundaries', () => {
    expect(addCalendarDaysOslo('2026-03-29', 1)).toBe('2026-03-30')
    expect(addCalendarDaysOslo('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('builds monday-first week keys', () => {
    expect(weekDateKeysMondayStartOslo('2026-03-26')).toEqual([
      '2026-03-23',
      '2026-03-24',
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
    ])
  })

  it('builds recurrence occurrence dates with interval', () => {
    expect(getRecurrenceOccurrenceDatesOslo('2026-03-23', '2026-04-06', 7)).toEqual([
      '2026-03-23',
      '2026-03-30',
      '2026-04-06',
    ])
  })

  it('formats period context label (month, year, ISO week)', () => {
    expect(formatCalendarPeriodContextLabel('2026-05-01')).toBe('Mai 2026 · Uke 18')
  })
})
