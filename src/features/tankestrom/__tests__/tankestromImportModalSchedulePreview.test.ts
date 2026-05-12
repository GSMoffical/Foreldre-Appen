import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { EmbeddedScheduleSegment } from '../../../types'
import { buildEmbeddedChildStructuredScheduleDetailsForReview } from '../useTankestromImport'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VAACUP_FIXTURE_PATH = join(__dirname, '../../../../fixtures/tankestrom/vaacup_original.txt')

function loadVaacupOriginalText(): string {
  return readFileSync(VAACUP_FIXTURE_PATH, 'utf8')
}

/**
 * Simulerer typisk live-LLM: `segment.notes` tom, feil labels på highlights — slik modal-preview
 * tidligere viste før den brukte `buildEmbeddedChildStructuredScheduleDetailsForReview`.
 */
function mislabeledVaacupSegments(): EmbeddedScheduleSegment[] {
  return [
    {
      date: '2026-06-12',
      title: 'Vårcupen – fredag',
      start: '17:45',
      tankestromHighlights: [
        { time: '17:45', label: 'Oppmøte', type: 'meeting' },
        { time: '18:40', label: 'Oppmøte', type: 'other' },
      ],
    },
    {
      date: '2026-06-13',
      title: 'Vårcupen – lørdag',
      start: '08:35',
      tankestromHighlights: [
        { time: '08:35', label: 'Oppmøte', type: 'meeting' },
        { time: '09:20', label: 'Oppmøte', type: 'meeting' },
        { time: '14:25', label: 'Oppmøte', type: 'meeting' },
        { time: '15:10', label: 'Første kamp', type: 'match' },
      ],
    },
    {
      date: '2026-06-14',
      title: 'Vårcupen – søndag',
      start: '17:45',
      isConditional: true,
      tankestromHighlights: [{ time: '17:45', label: 'Oppmøte', type: 'meeting' }],
    },
  ]
}

describe('Tankestrom import modal preview (samme vei som UI)', () => {
  it('korrigerer Vårcup-highlights mot full originaltekst som ved tekstanalyse', () => {
    const source = loadVaacupOriginalText()
    expect(source).toContain('Fredag 12. juni')
    const parentCard = 'Vårcupen 2026'
    const segments = mislabeledVaacupSegments()

    const fri = buildEmbeddedChildStructuredScheduleDetailsForReview(
      segments[0]!,
      parentCard,
      'Vårcupen – fredag',
      'parent-1__child-0',
      { originalImportText: source }
    )
    expect(fri.highlights.map((h) => `${h.time} ${h.label}`)).toEqual(['17:45 Oppmøte', '18:40 Første kamp'])

    const lor = buildEmbeddedChildStructuredScheduleDetailsForReview(
      segments[1]!,
      parentCard,
      'Vårcupen – lørdag',
      'parent-1__child-1',
      { originalImportText: source }
    )
    expect(lor.highlights.map((h) => `${h.time} ${h.label}`)).toEqual([
      '08:35 Oppmøte',
      '09:20 Første kamp',
      '14:25 Oppmøte',
      '15:10 Andre kamp',
    ])

    const son = buildEmbeddedChildStructuredScheduleDetailsForReview(
      segments[2]!,
      parentCard,
      'Vårcupen – søndag',
      'parent-1__child-2',
      { originalImportText: source }
    )
    expect(son.highlights.some((h) => h.time === '17:45')).toBe(false)
    expect(son.highlights.some((h) => h.time === '18:40')).toBe(false)
  })

  it('uten originaltekst forblir feil labels (dokumenterer behovet for snapshot)', () => {
    const parentCard = 'Vårcupen 2026'
    const seg = mislabeledVaacupSegments()[0]!
    const out = buildEmbeddedChildStructuredScheduleDetailsForReview(
      seg,
      parentCard,
      'Vårcupen – fredag',
      'parent-1__child-0',
      { originalImportText: undefined }
    )
    const h1840 = out.highlights.find((h) => h.time === '18:40')
    expect(h1840?.label).toBe('Oppmøte')
  })
})
