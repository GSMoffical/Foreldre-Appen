import { describe, expect, it } from 'vitest'
import {
  friendlyDiffLines,
  friendlyDiffIsEmpty,
  groupUpdateCandidates,
} from '../tankestromUpdatePreview'
import type { CalendarUpdateCandidate } from '../tankestromCalendarUpdateCandidates'
import type { CalendarUpdateDiff } from '../tankestromCalendarUpdateDiff'

function cand(partial: Partial<CalendarUpdateCandidate>): CalendarUpdateCandidate {
  return {
    id: 'e',
    title: 'Vårcupen 2026',
    score: 0.85,
    confidence: 'high',
    signals: ['tittel', 'dato'],
    explanation: 'Matchet på tittel og dato',
    ...partial,
  }
}

describe('groupUpdateCandidates', () => {
  it('samler kandidater med samme arrangementStableKey i ÉN gruppe', () => {
    const groups = groupUpdateCandidates([
      cand({ id: 'fri', stableKey: 'arr-1', date: '2026-06-12', dateLabel: '12. juni' }),
      cand({ id: 'lor', stableKey: 'arr-1', date: '2026-06-13', dateLabel: '13. juni' }),
      cand({ id: 'son', stableKey: 'arr-1', date: '2026-06-14', dateLabel: '14. juni' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.title).toBe('Vårcupen 2026')
    expect(groups[0]!.candidates.map((c) => c.id)).toEqual(['fri', 'lor', 'son'])
    expect(groups[0]!.dateRangeLabel).toBe('12.–14. juni')
  })

  it('grupperer på coreTitle når stableKey mangler, og sorterer på dato', () => {
    const groups = groupUpdateCandidates([
      cand({ id: 'b', coreTitle: 'Vårcupen 2026', date: '2026-06-13' }),
      cand({ id: 'a', coreTitle: 'Vårcupen 2026', date: '2026-06-12' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.candidates.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('holder ulike arrangementer adskilt', () => {
    const groups = groupUpdateCandidates([
      cand({ id: 'x', stableKey: 'arr-1', title: 'Vårcupen 2026' }),
      cand({ id: 'y', stableKey: 'arr-2', title: 'Sommerturnering' }),
    ])
    expect(groups).toHaveLength(2)
  })
})

describe('friendlyDiffLines', () => {
  const diff: CalendarUpdateDiff = {
    changed: [
      { label: 'Dato', oldValue: '13. juni', newValue: '12. juni' },
      { label: 'Start', oldValue: '09:00', newValue: '08:00' },
    ],
    added: [{ label: 'Sted', value: 'Lørenskoghallen' }],
    kept: [{ label: 'Notat', value: 'Husk rød drakt' }],
    uncertain: [],
  }

  it('utelater cross-day «Dato»-endring fra ny/endret-linjene', () => {
    const fd = friendlyDiffLines(diff)
    expect(fd.changes.find((c) => c.text.includes('Dato'))).toBeUndefined()
    // Starttid-endring beholdes (eksisterende = gammel, endret = ny).
    expect(fd.existing).toContain('Starttid: 09:00')
    expect(fd.changes).toContainEqual({ kind: 'Endret', text: 'Starttid: 08:00' })
  })

  it('viser lagt-til-felt som «Ny» og beholdt info under eksisterende', () => {
    const fd = friendlyDiffLines(diff)
    expect(fd.changes).toContainEqual({ kind: 'Ny', text: 'Sted: Lørenskoghallen' })
    expect(fd.existing).toContain('Notat: Husk rød drakt')
  })

  it('tar med usikkerhetsnote for ulike notater', () => {
    const fd = friendlyDiffLines({
      changed: [],
      added: [],
      kept: [],
      uncertain: [{ label: 'Notat', reason: 'Nytt forslag har andre notater — gammel tekst beholdes.' }],
    })
    expect(fd.note).toBe('Nytt forslag har andre notater — gammel tekst beholdes.')
    expect(friendlyDiffIsEmpty(fd)).toBe(false)
  })

  it('er tom når diffen kun har en «Dato»-endring (cross-day)', () => {
    const fd = friendlyDiffLines({
      changed: [{ label: 'Dato', oldValue: '13. juni', newValue: '12. juni' }],
      added: [],
      kept: [],
      uncertain: [],
    })
    expect(friendlyDiffIsEmpty(fd)).toBe(true)
  })
})
