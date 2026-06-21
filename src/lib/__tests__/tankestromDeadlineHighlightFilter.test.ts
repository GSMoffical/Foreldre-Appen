import { describe, it, expect } from 'vitest'
import {
  highlightLabelIsDeadlineLike,
  normalizeTankestromScheduleDetails,
} from '../tankestromScheduleDetails'

describe('highlightLabelIsDeadlineLike', () => {
  it('flagger frist-/svarfrist-aktige labels (generelt, ikke cup-spesifikt)', () => {
    for (const label of [
      'Svar i Spond senest',
      'Svar innen fredag',
      'Påmeldingsfrist',
      'Frist',
      'Gi beskjed',
      'Meld fra til trener',
      'Meld deg på',
      'Deadline',
    ]) {
      expect(highlightLabelIsDeadlineLike(label)).toBe(true)
    }
  })

  it('flagger IKKE ekte program-/oppmøte-/kamp-labels', () => {
    for (const label of [
      'Oppmøte',
      'Oppmøte før første kamp',
      'Første kamp',
      'Andre kamp',
      'Det er meldt ustabilt vær',
    ]) {
      expect(highlightLabelIsDeadlineLike(label)).toBe(false)
    }
  })
})

describe('normalizeTankestromScheduleDetails — svarfrist holdes ute av program-highlights', () => {
  it('fjerner svarfrist-klokkeslett, men beholder oppmøte og kamp', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: [
        { time: '17:30', label: 'Oppmøte', type: 'meeting' },
        { time: '18:40', label: 'Første kamp', type: 'match' },
        { time: '20:00', label: 'Svar i Spond senest', type: 'deadline' },
      ],
      notes: [],
      bringItems: [],
    })
    const times = out.highlights.map((h) => h.time)
    expect(times).toContain('17:30')
    expect(times).toContain('18:40')
    expect(times).not.toContain('20:00')
    expect(out.highlights.some((h) => /spond|svar/i.test(h.label))).toBe(false)
  })

  it('beholder ekte oppmøte-/kamptid når ingen frist er involvert', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: [
        { time: '08:20', label: 'Oppmøte før første kamp', type: 'meeting' },
        { time: '09:00', label: 'Første kamp', type: 'match' },
      ],
      notes: [],
      bringItems: [],
    })
    const times = out.highlights.map((h) => h.time)
    expect(times).toContain('08:20')
    expect(times).toContain('09:00')
  })
})
