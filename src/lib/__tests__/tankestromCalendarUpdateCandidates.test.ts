import { describe, expect, it } from 'vitest'
import {
  findCalendarUpdateCandidates,
  type ExistingCalendarItem,
} from '../tankestromCalendarUpdateCandidates'

const varcuppen: ExistingCalendarItem = {
  id: 'e-cup',
  title: 'Vårcuppen',
  date: '2026-04-12',
  endDate: '2026-04-13',
  personId: 'c1',
  location: 'Ekeberg',
}

describe('findCalendarUpdateCandidates', () => {
  it('finner eksisterende hendelse med lik tittel og dato', () => {
    const out = findCalendarUpdateCandidates(
      { title: 'Vårcuppen', date: '2026-04-12' },
      [varcuppen]
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.id).toBe('e-cup')
    expect(out[0]!.signals).toEqual(['tittel', 'dato'])
    expect(out[0]!.explanation).toBe('Matchet på tittel og dato')
    expect(out[0]!.dateLabel).toBe('12.–13. april')
    expect(out[0]!.confidence).toBe('high')
  })

  it('returnerer ingen kandidat ved lav match (ulik tittel og fjern dato)', () => {
    const out = findCalendarUpdateCandidates(
      { title: 'Tannlegetime', date: '2026-11-03' },
      [varcuppen]
    )
    expect(out).toEqual([])
  })

  it('rangerer bedre kandidat høyere', () => {
    const weak: ExistingCalendarItem = { id: 'e-weak', title: 'Vårcuppen', date: '2026-08-01' }
    const out = findCalendarUpdateCandidates(
      { title: 'Vårcuppen', date: '2026-04-12', personId: 'c1' },
      [weak, varcuppen]
    )
    expect(out.map((c) => c.id)).toEqual(['e-cup', 'e-weak'])
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score)
  })

  it('samme person øker score', () => {
    const base = { title: 'Vårcuppen', date: '2026-04-12' }
    const withoutPerson = findCalendarUpdateCandidates(base, [{ ...varcuppen, location: undefined }])
    const withPerson = findCalendarUpdateCandidates(
      { ...base, personId: 'c1' },
      [{ ...varcuppen, location: undefined }]
    )
    expect(withPerson[0]!.score).toBeGreaterThan(withoutPerson[0]!.score)
    expect(withPerson[0]!.signals).toContain('person')
  })

  it('samme sted øker score når feltet finnes', () => {
    const base = { title: 'Vårcuppen', date: '2026-04-12' }
    const withoutLoc = findCalendarUpdateCandidates(base, [{ ...varcuppen, personId: undefined }])
    const withLoc = findCalendarUpdateCandidates(
      { ...base, location: 'Ekeberg' },
      [{ ...varcuppen, personId: undefined }]
    )
    expect(withLoc[0]!.score).toBeGreaterThan(withoutLoc[0]!.score)
    expect(withLoc[0]!.signals).toContain('sted')
  })

  it('felles stabil nøkkel gir sterk kandidat selv uten tittel-likhet', () => {
    const out = findCalendarUpdateCandidates(
      { title: 'Oppdatert program', date: '2026-04-12', stableKey: 'arr-123' },
      [{ id: 'e-cup', title: 'Vårcuppen', date: '2026-04-12', stableKey: 'arr-123' }]
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.signals).toContain('tidligere import')
    expect(out[0]!.confidence).toBe('high')
  })

  it('returnerer maksimalt 3 kandidater', () => {
    const many: ExistingCalendarItem[] = Array.from({ length: 6 }, (_, i) => ({
      id: `e${i}`,
      title: 'Vårcuppen',
      date: '2026-04-12',
    }))
    expect(findCalendarUpdateCandidates({ title: 'Vårcuppen', date: '2026-04-12' }, many)).toHaveLength(3)
  })
})
