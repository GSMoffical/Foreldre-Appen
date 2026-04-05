import { describe, it, expect } from 'vitest'
import { getISOWeek, getISOWeekYear } from '../isoWeek'

describe('getISOWeek', () => {
  it('matches known ISO weeks', () => {
    expect(getISOWeek(new Date(2024, 2, 18))).toBe(12)
    expect(getISOWeek(new Date(2025, 0, 1))).toBe(1)
    expect(getISOWeek(new Date(2024, 11, 30))).toBe(1)
  })
})

describe('getISOWeekYear', () => {
  it('uses ISO week year at year boundary', () => {
    expect(getISOWeekYear(new Date(2024, 11, 30))).toBe(2025)
  })
})
