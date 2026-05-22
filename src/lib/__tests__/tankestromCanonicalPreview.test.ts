import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { EmbeddedScheduleSegment } from '../../types'
import { buildEmbeddedChildCanonicalPreviewForReview } from '../../features/tankestrom/useTankestromImport'

const VAACUP_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../fixtures/tankestrom/vaacup_original.txt'),
  'utf8'
)

describe('tankestromCanonicalPreview', () => {
  it('timeLabel og highlights kommer fra samme normaliserte pipeline (lørdag uten 17:45)', () => {
    const segment: EmbeddedScheduleSegment = {
      date: '2026-06-13',
      title: 'Vårcupen – lørdag',
      start: '08:35',
      notes: VAACUP_SOURCE,
      tankestromHighlights: [
        { time: '08:35', label: 'Oppmøte før første kamp', type: 'meeting' },
        { time: '09:20', label: 'Første kamp', type: 'match' },
        { time: '14:25', label: 'Oppmøte før andre kamp', type: 'meeting' },
        { time: '15:10', label: 'Andre kamp', type: 'match' },
        { time: '17:45', label: 'Oppmøte', type: 'meeting' },
      ],
    }
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      segment,
      'Vårcupen 2026',
      'Vårcupen – lørdag',
      'parent-1__child-1',
      { originalImportText: VAACUP_SOURCE }
    )
    expect(preview.timeLabel).toBe('08:35')
    expect(preview.normalized.highlights.map((h) => h.time)).not.toContain('17:45')
    expect(preview.normalized.highlights.map((h) => `${h.time} ${h.label}`)).toEqual([
      '08:35 Oppmøte før første kamp',
      '09:20 Første kamp',
      '14:25 Oppmøte før andre kamp',
      '15:10 Andre kamp',
    ])
  })

  it('rå segment.start på 17:45 overstyrer ikke timeLabel når normaliserte highlights starter 08:35', () => {
    const segment: EmbeddedScheduleSegment = {
      date: '2026-06-13',
      title: 'Vårcupen – lørdag',
      start: '17:45',
      tankestromHighlights: [
        { time: '08:35', label: 'Oppmøte før første kamp', type: 'meeting' },
        { time: '09:20', label: 'Første kamp', type: 'match' },
        { time: '14:25', label: 'Oppmøte før andre kamp', type: 'meeting' },
        { time: '15:10', label: 'Andre kamp', type: 'match' },
      ],
    }
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      segment,
      'Vårcupen 2026',
      'Vårcupen – lørdag',
      'parent-1__child-2',
      { originalImportText: VAACUP_SOURCE }
    )
    expect(preview.timeLabel).toBe('08:35')
  })
})
