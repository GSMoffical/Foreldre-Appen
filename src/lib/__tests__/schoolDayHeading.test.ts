import { describe, expect, it } from 'vitest'
import { deriveSchoolDayHeading, isSchoolDayEvent } from '../schoolDayHeading'
import type { EventMetadata } from '../../types'

function meta(obj: Record<string, unknown>): EventMetadata {
  return obj as EventMetadata
}

describe('isSchoolDayEvent', () => {
  it('true når schoolContext er satt', () => {
    expect(isSchoolDayEvent(meta({ schoolContext: { subject: 'Norsk' } }))).toBe(true)
  })
  it('false uten schoolContext', () => {
    expect(isSchoolDayEvent(meta({}))).toBe(false)
    expect(isSchoolDayEvent(undefined)).toBe(false)
  })
})

describe('deriveSchoolDayHeading', () => {
  it('overrideKind → norsk etikett', () => {
    expect(deriveSchoolDayHeading(meta({ schoolDayOverride: { overrideKind: 'exam_day' } }))).toBe(
      'Eksamen',
    )
    expect(deriveSchoolDayHeading(meta({ schoolDayOverride: { overrideKind: 'free_day' } }))).toBe('Fri')
    expect(deriveSchoolDayHeading(meta({ schoolDayOverride: { overrideKind: 'trip_day' } }))).toBe(
      'Tur / utflukt',
    )
  })

  it('ukjent overrideKind → faller videre (ingen highlight → undefined)', () => {
    expect(
      deriveSchoolDayHeading(meta({ schoolDayOverride: { overrideKind: 'noe_rart' } })),
    ).toBeUndefined()
  })

  it('ingen override, men kort highlight-label → bruker den', () => {
    expect(deriveSchoolDayHeading(meta({ tankestromHighlights: [{ time: '09:00', label: 'Norsk' }] }))).toBe(
      'Norsk',
    )
  })

  it('lang prosa-note (ingen override/highlight) → undefined (avkapper ALDRI)', () => {
    expect(
      deriveSchoolDayHeading(
        meta({
          tankestromNotes: [
            'Muntlig eller muntlig-praktisk eksamen for elever som er trukket ut til muntlig',
          ],
        }),
      ),
    ).toBeUndefined()
  })

  it('lang highlight-label (> 32 tegn) → ikke brukt som overskrift', () => {
    expect(
      deriveSchoolDayHeading(
        meta({
          tankestromHighlights: [
            { time: '09:00', label: 'Skriftlig eksamen i auditoriet for alle klasser hele dagen' },
          ],
        }),
      ),
    ).toBeUndefined()
  })

  it('tom/undefined → undefined', () => {
    expect(deriveSchoolDayHeading(meta({}))).toBeUndefined()
    expect(deriveSchoolDayHeading(undefined)).toBeUndefined()
  })
})
