import { describe, expect, it } from 'vitest'
import { computeSchoolImportContentDebug } from '../schoolImportDebug'

describe('computeSchoolImportContentDebug — personvern-invariant', () => {
  it('PRODUKSJON: flagget alene kan ALDRI aktivere innholdslogging', () => {
    expect(computeSchoolImportContentDebug({ PROD: true, VITE_DEBUG_SCHOOL_IMPORT: 'true' })).toBe(false)
    expect(computeSchoolImportContentDebug({ DEV: false, PROD: true, VITE_DEBUG_SCHOOL_IMPORT: 'true' })).toBe(false)
  })

  it('DEV: på (lokal diagnostikk beholdes), uavhengig av flagg', () => {
    expect(computeSchoolImportContentDebug({ DEV: true })).toBe(true)
    expect(computeSchoolImportContentDebug({ DEV: true, VITE_DEBUG_SCHOOL_IMPORT: 'true' })).toBe(true)
    expect(computeSchoolImportContentDebug({ DEV: true, PROD: false })).toBe(true)
  })

  it('non-prod (verken DEV eller PROD): kun eksplisitt opt-in', () => {
    expect(computeSchoolImportContentDebug({ VITE_DEBUG_SCHOOL_IMPORT: 'true' })).toBe(true)
    expect(computeSchoolImportContentDebug({})).toBe(false)
    expect(computeSchoolImportContentDebug({ VITE_DEBUG_SCHOOL_IMPORT: 'false' })).toBe(false)
    expect(computeSchoolImportContentDebug({ VITE_DEBUG_SCHOOL_IMPORT: '1' })).toBe(false)
  })
})
