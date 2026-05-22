import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { EmbeddedScheduleSegment } from '../../types'
import { buildEmbeddedChildStructuredScheduleDetailsForReview } from '../../features/tankestrom/useTankestromImport'
import {
  buildPerDaySourceTextForValidation,
  normalizeTankestromScheduleDetails,
} from '../tankestromScheduleDetails'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VAACUP_SOURCE = readFileSync(
  join(__dirname, '../../../fixtures/tankestrom/vaacup_original.txt'),
  'utf8'
)

const LORDAG_CORRECT_HIGHLIGHTS = [
  { time: '08:35', label: 'Oppmøte før første kamp', type: 'meeting' as const },
  { time: '09:20', label: 'Første kamp', type: 'match' as const },
  { time: '14:25', label: 'Oppmøte før andre kamp', type: 'meeting' as const },
  { time: '15:10', label: 'Andre kamp', type: 'match' as const },
]

function lordagSegmentWithLeak(overrides?: Partial<EmbeddedScheduleSegment>): EmbeddedScheduleSegment {
  return {
    date: '2026-06-13',
    title: 'Vårcupen – lørdag',
    start: '08:35',
    tankestromHighlights: [
      ...LORDAG_CORRECT_HIGHLIGHTS,
      { time: '17:45', label: 'Oppmøte', type: 'meeting' },
    ],
    ...overrides,
  }
}

describe('cross-day fallback highlight (Vårcup lørdag)', () => {
  it('dropper 17:45 når segment har riktige highlights men feil fallbackStartTime og lekket highlight', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: [
        ...LORDAG_CORRECT_HIGHLIGHTS,
        { time: '17:45', label: 'Oppmøte', type: 'meeting' },
      ],
      notes: [],
      titleContext: ['Vårcupen – lørdag'],
      fallbackStartTime: '17:45',
      sourceTextForValidation: buildPerDaySourceTextForValidation({
        globalSourceText: VAACUP_SOURCE,
        date: '2026-06-13',
      }),
      isConditionalSegment: false,
    })
    const times = out.highlights.map((h) => h.time)
    expect(times).not.toContain('17:45')
    expect(times).toEqual(['08:35', '09:20', '14:25', '15:10'])
  })

  it('beholder fredag 17:45 Oppmøte', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: [
        { time: '17:45', label: 'Oppmøte', type: 'meeting' },
        { time: '18:40', label: 'Første kamp', type: 'match' },
      ],
      notes: [],
      titleContext: ['Vårcupen – fredag'],
      fallbackStartTime: '17:45',
      sourceTextForValidation: buildPerDaySourceTextForValidation({
        globalSourceText: VAACUP_SOURCE,
        date: '2026-06-12',
      }),
    })
    expect(out.highlights.map((h) => h.time)).toContain('17:45')
  })

  it('beholder lørdag 08:35', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: LORDAG_CORRECT_HIGHLIGHTS,
      notes: [],
      titleContext: ['Vårcupen – lørdag'],
      fallbackStartTime: '08:35',
      sourceTextForValidation: buildPerDaySourceTextForValidation({
        globalSourceText: VAACUP_SOURCE,
        date: '2026-06-13',
      }),
    })
    expect(out.highlights.map((h) => h.time)).toContain('08:35')
  })

  it('søndag foreløpig får ikke 17:45/18:40 fra fredag', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: [
        { time: '17:45', label: 'Oppmøte', type: 'meeting' },
        { time: '18:40', label: 'Første kamp', type: 'match' },
      ],
      notes: ['Program for søndag avhenger av plassering etter lørdagens kamper.'],
      titleContext: ['Vårcupen – søndag'],
      fallbackStartTime: '17:45',
      sourceTextForValidation: buildPerDaySourceTextForValidation({
        globalSourceText: VAACUP_SOURCE,
        date: '2026-06-14',
      }),
      isConditionalSegment: true,
    })
    expect(out.highlights.some((h) => h.time === '17:45' || h.time === '18:40')).toBe(false)
  })

  it('generisk «Oppmøte 45 minutter før hver kamp» alene lager ikke 17:45 på lørdag', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: LORDAG_CORRECT_HIGHLIGHTS,
      notes: ['Oppmøte 45 minutter før hver kamp.'],
      titleContext: ['Vårcupen – lørdag'],
      fallbackStartTime: '17:45',
      sourceTextForValidation: buildPerDaySourceTextForValidation({
        segmentSourceText: 'Oppmøte 45 minutter før hver kamp.',
        globalSourceText: VAACUP_SOURCE,
        date: '2026-06-13',
      }),
    })
    expect(out.highlights.map((h) => h.time)).not.toContain('17:45')
  })

  it('modal-preview (buildEmbeddedChildStructuredScheduleDetailsForReview) dropper lekket 17:45', () => {
    const seg = lordagSegmentWithLeak({
      notes: VAACUP_SOURCE,
    })
    const structured = buildEmbeddedChildStructuredScheduleDetailsForReview(
      seg,
      'Vårcupen 2026',
      'Vårcupen – lørdag',
      'parent-1__child-1',
      { originalImportText: VAACUP_SOURCE }
    )
    expect(structured.highlights.map((h) => h.time)).not.toContain('17:45')
    expect(structured.highlights.map((h) => `${h.time} ${h.label}`)).toEqual([
      '08:35 Oppmøte før første kamp',
      '09:20 Første kamp',
      '14:25 Oppmøte før andre kamp',
      '15:10 Andre kamp',
    ])
  })
})
