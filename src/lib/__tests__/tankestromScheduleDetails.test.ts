import { describe, expect, it } from 'vitest'
import {
  buildTankestromScheduleDescriptionFallback,
  normalizeTankestromScheduleDetails,
  readTankestromScheduleDetailsFromMetadata,
} from '../tankestromScheduleDetails'
import type { EventMetadata } from '../../types'

describe('tankestromScheduleDetails', () => {
  it('leser highlights/notater fra metadata og dedupliserer notatlinjer mot highlights', () => {
    const metadata: EventMetadata = {
      tankestromHighlights: [{ time: '18:40', label: 'Første kamp', type: 'match' }],
      tankestromNotes: ['Oppmøte 45 minutter før hver kamp', 'Første kamp kl. 18:40'],
    }
    const out = readTankestromScheduleDetailsFromMetadata(metadata)
    expect(out.highlights).toHaveLength(1)
    expect(out.highlights[0]?.time).toBe('18:40')
    expect(out.notes).toEqual(['Oppmøte 45 minutter før hver kamp'])
    expect(out.bringItems).toEqual([])
  })

  it('bygger tekstfallback for ekstern kalenderbeskrivelse', () => {
    const txt = buildTankestromScheduleDescriptionFallback(
      [{ time: '18:40', label: 'Første kamp', type: 'match' }],
      ['Oppmøte 45 minutter før hver kamp']
    )
    expect(txt).toContain('Høydepunkter:')
    expect(txt).toContain('- 18:40 Første kamp')
    expect(txt).toContain('Notater:')
  })

  it('rydder fragmenterte notes, henter bringItems og deduper highlights', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: [
        { time: '17:30', label: 'Høstcupen – fredag', type: 'other' },
        { time: '14:40', label: 'i Bekkestua skolehall; Andre kamp', type: 'match' },
        { time: '14:40', label: 'Andre kamp', type: 'match' },
      ],
      notes: [
        'Dagens innhold',
        'Husk / ta med',
        'Gjerne ekstra t',
        'skjorte',
        'Barna blir værende samlet mellom kampene.',
      ],
      bringItems: ['matpakke', 'drikkeflaske'],
      titleContext: ['Høstcupen – fredag'],
    })
    expect(out.highlights.map((h) => `${h.time} ${h.label}`)).toEqual(['14:40 Andre kamp'])
    expect(out.bringItems).toEqual(['matpakke', 'drikkeflaske', 'ekstra t-skjorte'])
    expect(out.notes).toEqual(['Barna blir værende samlet mellom kampene.'])
    expect(out.removedFragments).toContain('Dagens innhold')
    expect(out.removedDuplicateHighlights).toBeGreaterThanOrEqual(1)
  })
})
