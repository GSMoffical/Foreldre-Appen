import { describe, expect, it } from 'vitest'
import {
  buildTankestromScheduleDescriptionFallback,
  normalizeTankestromScheduleDetails,
  readTankestromScheduleDetailsFromMetadata,
  semanticBringKey,
} from '../tankestromScheduleDetails'
import type { EventMetadata } from '../../types'

describe('tankestromScheduleDetails', () => {
  it('leser highlights/notater fra metadata og dedupliserer notatlinjer mot highlights', () => {
    const metadata: EventMetadata = {
      tankestromHighlights: [{ time: '18:40', label: 'Første kamp', type: 'match' }],
      tankestromNotes: ['Oppmøte 45 minutter før hver kamp', 'Første kamp kl. 18:40'],
    }
    const out = readTankestromScheduleDetailsFromMetadata(metadata, ['Cup'])
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

  it('defensiv opprydding: rotete Høstcupen-lignende metadata (flat blob, duplikater, vindu, fragmenter)', () => {
    const blob = `Høydepunkter:
- 09:15 Første kamp
- 09:15 Ta gjerne med ekstra stor bag eller kjølebag.

Husk: matpakke

Notater:
- husk å spise`

    const metadata: EventMetadata = {
      tankestromHighlights: [
        { time: '09:15', label: 'Første kamp', type: 'match' },
        { time: '09:15', label: 'Ta gjerne med ekstra stor bag eller kjølebag.', type: 'other' },
        { time: '10:00', label: 'sluttspill: første kamp mellom', type: 'other' },
        { time: '10:00', label: 'og', type: 'other' },
        { time: '12:00', label: 'og', type: 'other' },
        { time: '12:00', label: 'Ved B-sluttspill møtes vi igjen', type: 'other' },
      ],
      tankestromNotes: [
        blob,
        '- overtrekksklær',
        '- spist litt',
        'Oppmøte klokken 08:00 ved hallen.',
      ],
      bringItems: ['ekstra t-skjorte', 'Gjerne ekstra t-skjorte'],
    }
    const out = readTankestromScheduleDetailsFromMetadata(metadata, ['Høstcupen – søndag'])

    expect(out.notes.some((n) => /høydepunkter\s*:/i.test(n))).toBe(false)
    expect(out.highlights.some((h) => h.label.toLowerCase().includes('kjølebag'))).toBe(false)
    expect(out.highlights.map((h) => h.label)).toContain('Første kamp')
    expect(out.timeWindowSummaries.length).toBeGreaterThanOrEqual(1)
    expect(out.timeWindowSummaries[0]?.timeRange).toBe('10:00–12:00')
    expect(out.timeWindowSummaries[0]?.label).toMatch(/sluttspill|B-sluttspill/i)

    expect(out.bringItems).toContain('ekstra t-skjorte')
    expect(out.bringItems.filter((b) => semanticBringKey(b) === semanticBringKey('ekstra t-skjorte'))).toHaveLength(
      1
    )
    expect(out.notes.some((n) => /overtrekk/i.test(n))).toBe(false)
    expect(out.bringItems.some((b) => semanticBringKey(b).includes('overtrekk'))).toBe(true)

    expect(out.notes).toContain('Oppmøte klokken 08:00 ved hallen.')
    expect(out.notes.some((n) => /spist litt/i.test(n))).toBe(false)
  })
})
