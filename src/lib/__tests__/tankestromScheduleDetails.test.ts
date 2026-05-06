import { describe, expect, it } from 'vitest'
import {
  buildTankestromScheduleDescriptionFallback,
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
})
