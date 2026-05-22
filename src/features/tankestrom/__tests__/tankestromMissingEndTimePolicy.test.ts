import { describe, expect, it } from 'vitest'
import type { TankestromEventDraft } from '../types'
import {
  collectTankestromEventExportValidationIssues,
  draftHasStartWithoutKnownEnd,
  validateTankestromDraft,
} from '../useTankestromImport'
import { formatTankestromMissingEndReviewHint } from '../../../lib/tankestromInlineValidationLabel'

const base: TankestromEventDraft = {
  title: 'Vårcupen – fredag',
  date: '2026-06-12',
  start: '17:45',
  end: '',
  personId: 'p1',
  location: '',
  notes: '',
  includeRecurrence: false,
  dropoffBy: '',
  pickupBy: '',
  isManualCalendarEntry: true,
}

describe('Tankestrom missing end-time policy', () => {
  const validPersonIds = new Set(['p1'])

  it('draftHasStartWithoutKnownEnd når start finnes uten slutt', () => {
    expect(draftHasStartWithoutKnownEnd(base)).toBe(true)
  })

  it('validering blokkerer ikke import når bare slutt mangler', () => {
    expect(validateTankestromDraft(base, validPersonIds)).toBeNull()
    const issues = collectTankestromEventExportValidationIssues('p1', undefined, base, validPersonIds)
    expect(issues.some((i) => i.code === 'missing_end_time')).toBe(false)
  })

  it('date-only uten start/slutt er ikke start-without-end', () => {
    const d = { ...base, start: '', end: '' }
    expect(draftHasStartWithoutKnownEnd(d)).toBe(false)
    expect(validateTankestromDraft(d, validPersonIds)).toBeNull()
  })

  it('fly med start uten slutt følger fly-policy (ikke generell hint)', () => {
    const d = { ...base, travelImportType: 'flight' as const }
    expect(draftHasStartWithoutKnownEnd(d)).toBe(false)
    expect(validateTankestromDraft(d, validPersonIds)).toBeNull()
  })

  it('review-hint er informativ uten Rediger-blokker', () => {
    expect(formatTankestromMissingEndReviewHint('fredag')).toContain('estimert ved import')
    expect(formatTankestromMissingEndReviewHint('fredag')).not.toContain('Rediger')
  })
})
