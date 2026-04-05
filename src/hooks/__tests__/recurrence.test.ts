import { describe, it, expect } from 'vitest'
import { getRecurrenceOccurrenceDates } from '../useScheduleState'

describe('getRecurrenceOccurrenceDates', () => {
  it('returns weekly dates', () => {
    const dates = getRecurrenceOccurrenceDates('2024-03-04', '2024-03-25', 7)
    expect(dates).toEqual(['2024-03-04', '2024-03-11', '2024-03-18', '2024-03-25'])
  })

  it('returns daily dates', () => {
    const dates = getRecurrenceOccurrenceDates('2024-03-01', '2024-03-03', 1)
    expect(dates).toEqual(['2024-03-01', '2024-03-02', '2024-03-03'])
  })

  it('returns biweekly dates', () => {
    const dates = getRecurrenceOccurrenceDates('2024-03-01', '2024-03-29', 14)
    expect(dates).toEqual(['2024-03-01', '2024-03-15', '2024-03-29'])
  })

  it('returns single date when start equals end', () => {
    const dates = getRecurrenceOccurrenceDates('2024-03-01', '2024-03-01', 7)
    expect(dates).toEqual(['2024-03-01'])
  })

  it('returns empty when end is before start', () => {
    const dates = getRecurrenceOccurrenceDates('2024-03-10', '2024-03-01', 7)
    expect(dates).toEqual([])
  })

  it('handles month boundary', () => {
    const dates = getRecurrenceOccurrenceDates('2024-02-26', '2024-03-11', 7)
    expect(dates).toEqual(['2024-02-26', '2024-03-04', '2024-03-11'])
  })
})
