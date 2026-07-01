import { describe, expect, it } from 'vitest'
import type { SchoolLessonSlot } from '../../types'
import {
  normalizeSubjectKeyForMatch,
  overlaySubjectUpdatesUnmatchedByLessons,
  overlayUpdatesForLesson,
} from '../schoolWeekOverlayLessonMatch'

const naturfag: SchoolLessonSlot = { subjectKey: 'naturfag', start: '08:00', end: '09:00' }

describe('overlayUpdatesForLesson — subjectKey-normalisering (Fiks 2)', () => {
  it('matcher RÅ overlay-subjectKey «Naturfag» mot NORMALISERT lesson «naturfag» (var mismatch før)', () => {
    const matched = overlayUpdatesForLesson(naturfag, [{ subjectKey: 'Naturfag', sections: {} }])
    expect(matched).toHaveLength(1)
  })

  it('matcher fortsatt når begge allerede er normalisert (ingen regresjon)', () => {
    expect(overlayUpdatesForLesson(naturfag, [{ subjectKey: 'naturfag' }])).toHaveLength(1)
  })

  it('ulikt fag matcher IKKE (Spansk vs naturfag) → skal til fallback', () => {
    expect(overlayUpdatesForLesson(naturfag, [{ subjectKey: 'Spansk' }])).toHaveLength(0)
  })

  it('normaliseringen er symmetrisk (rå == normalisert)', () => {
    expect(normalizeSubjectKeyForMatch('Naturfag')).toBe(normalizeSubjectKeyForMatch('naturfag'))
  })
})

describe('overlaySubjectUpdatesUnmatchedByLessons (Fiks 2)', () => {
  it('umatchet fag havner i fallback-lista, matchet gjør ikke', () => {
    const unmatched = overlaySubjectUpdatesUnmatchedByLessons(
      [{ subjectKey: 'Naturfag' }, { subjectKey: 'Spansk' }],
      [naturfag]
    )
    // «Naturfag» matcher lesson «naturfag» → ute; «Spansk» matcher ingen → i fallback.
    expect(unmatched.map((u) => u.subjectKey)).toEqual(['Spansk'])
  })

  it('uten lessons havner alt i fallback', () => {
    const all = overlaySubjectUpdatesUnmatchedByLessons([{ subjectKey: 'Naturfag' }], [])
    expect(all).toHaveLength(1)
  })
})
