import { describe, expect, it } from 'vitest'
import {
  classifyTimeIntentInSourceText,
  correctMislabeledHighlightsAgainstSourceText,
  normalizeTankestromScheduleDetails,
  readTankestromScheduleDetailsFromMetadata,
} from '../tankestromScheduleDetails'
import {
  assertVaacupOriginalInvariants,
  dayKeyFromDateForVaacup,
  formatVaacupInvariantViolations,
  type VaacupNormalizedDay,
} from '../tankestromVaacupInvariants'
import type { EventMetadata, EmbeddedScheduleSegment } from '../../types'
import { parseEmbeddedScheduleFromMetadata } from '../embeddedSchedule'

/** Kanonisk Vårcupen-kilde (samme som e2e/fixtures/vaacup-original.txt). */
const VAACUP_SOURCE = `Vårcupen 2026 – G12 (eksempeltekst for E2E)

Fredag 12. juni
- Oppmøte kl. 17:45 ved kunstgressbanen.
- Første kamp starter 18:40.

Lørdag 13. juni
- Oppmøte før første kamp kl. 08:35.
- Første kamp 09:20.
- Oppmøte før andre kamp 14:25.
- Andre kamp 15:10.

Søndag 14. juni
- Spilleplan er foreløpig og avhenger av hvordan det går fredag og lørdag.`

function buildCanonicalVaacupMetadata(): EventMetadata {
  return {
    isArrangementParent: true,
    embeddedSchedule: [
      {
        date: '2026-06-12',
        title: 'Fredag',
        start: '17:45',
        end: '19:00',
        notes: 'Oppmøte kl. 17:45 ved kunstgressbanen. Første kamp starter 18:40.',
        tankestromHighlights: [
          { time: '17:45', label: 'Oppmøte', type: 'meeting' },
          { time: '18:40', label: 'Første kamp', type: 'match' },
        ],
      },
      {
        date: '2026-06-13',
        title: 'Lørdag',
        start: '08:35',
        end: '16:00',
        notes:
          'Oppmøte før første kamp kl. 08:35. Første kamp 09:20. Oppmøte før andre kamp 14:25. Andre kamp 15:10.',
        tankestromHighlights: [
          { time: '08:35', label: 'Oppmøte før første kamp', type: 'meeting' },
          { time: '09:20', label: 'Første kamp', type: 'match' },
          { time: '14:25', label: 'Oppmøte før andre kamp', type: 'meeting' },
          { time: '15:10', label: 'Andre kamp', type: 'match' },
        ],
      },
      {
        date: '2026-06-14',
        title: 'Søndag',
        isConditional: true,
        notes: 'Program for søndag avhenger av plassering etter lørdagens kamper.',
        tankestromHighlights: [],
      },
    ],
  } as unknown as EventMetadata
}

function normalizeAllDays(metadata: EventMetadata): VaacupNormalizedDay[] {
  const segments = parseEmbeddedScheduleFromMetadata(metadata)
  const days: VaacupNormalizedDay[] = []
  for (const seg of segments) {
    const dayKey = dayKeyFromDateForVaacup(seg.date)
    if (!dayKey) continue
    const segMetadata: EventMetadata = {
      tankestromHighlights: seg.tankestromHighlights,
      tankestromNotes: seg.tankestromNotes,
      bringItems: seg.bringItems,
      packingItems: seg.packingItems,
      timeWindowCandidates: seg.timeWindowCandidates,
    }
    const normalized = readTankestromScheduleDetailsFromMetadata(segMetadata, [seg.title], {
      fallbackStartTime: seg.start,
      sourceTextForValidation: seg.notes,
      isConditionalSegment: seg.isConditional === true,
    })
    days.push({
      date: seg.date,
      dayKey,
      highlights: normalized.highlights,
      notes: normalized.notes,
      start: seg.start,
      end: seg.end,
      isConditional: seg.isConditional,
    })
  }
  return days
}

describe('classifyTimeIntentInSourceText', () => {
  it('gjenkjenner oppmøte når linja begynner med Oppmøte', () => {
    const source = '- Oppmøte før første kamp kl. 08:35.\n- Første kamp 09:20.'
    expect(classifyTimeIntentInSourceText('08:35', source)).toBe('oppmote')
    expect(classifyTimeIntentInSourceText('09:20', source)).toBe('kamp')
  })

  it('returnerer unknown for tid uten kilde', () => {
    expect(classifyTimeIntentInSourceText('17:45', '')).toBe('unknown')
    expect(classifyTimeIntentInSourceText('17:45', 'Ingenting relevant her.')).toBe('unknown')
  })

  it('gjenkjenner kamp når linja starter med Første/Andre kamp', () => {
    expect(classifyTimeIntentInSourceText('15:10', '- Andre kamp 15:10.')).toBe('kamp')
    expect(classifyTimeIntentInSourceText('18:40', 'Første kamp starter 18:40.')).toBe('kamp')
  })
})

describe('correctMislabeledHighlightsAgainstSourceText', () => {
  it('omdøper Oppmøte→Første kamp når kilden er tydelig', () => {
    const out = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '09:20', label: 'Oppmøte', type: 'meeting' }],
      '- Første kamp 09:20.'
    )
    expect(out.highlights).toEqual([{ time: '09:20', label: 'Første kamp', type: 'match' }])
    expect(out.relabeled).toHaveLength(1)
  })

  it('dropper Oppmøte på foreløpig dag når tiden ikke er eksplisitt i kilden', () => {
    const out = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '17:45', label: 'Oppmøte', type: 'meeting' }],
      'Program for søndag avhenger av plassering etter lørdagens kamper.',
      { isConditionalSegment: true }
    )
    expect(out.highlights).toEqual([])
    expect(out.dropped).toHaveLength(1)
    expect(out.dropped[0]!.reason).toBe('tentative_segment_without_explicit_time')
  })

  it('beholder Oppmøte på vanlig dag uten oppmøte-ord i kilde (konservativ default)', () => {
    const out = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '08:20', label: 'Oppmøte før første kamp', type: 'meeting' }],
      'Laget spiser felles lunsj mellom kampene. Foreldre hjelper med rydding etter siste kamp.'
    )
    expect(out.highlights).toEqual([
      { time: '08:20', label: 'Oppmøte før første kamp', type: 'meeting' },
    ])
    expect(out.dropped).toEqual([])
  })

  it('lar Oppmøte stå når kilden støtter det', () => {
    const out = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '17:45', label: 'Oppmøte', type: 'meeting' }],
      '- Oppmøte kl. 17:45 ved kunstgressbanen.'
    )
    expect(out.highlights).toEqual([{ time: '17:45', label: 'Oppmøte', type: 'meeting' }])
  })

  it('presiserer kamp-ordinal når kilden sier Andre kamp', () => {
    const out = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '15:10', label: 'Første kamp', type: 'match' }],
      '- Andre kamp 15:10.'
    )
    expect(out.highlights).toEqual([{ time: '15:10', label: 'Andre kamp', type: 'match' }])
  })

  it('lar kilde-fri input stå urørt', () => {
    const out = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '17:45', label: 'Oppmøte', type: 'meeting' }],
      ''
    )
    expect(out.highlights).toEqual([{ time: '17:45', label: 'Oppmøte', type: 'meeting' }])
    expect(out.dropped).toEqual([])
  })
})

describe('Vårcupen-invariants på kanonisk fixture', () => {
  it('passerer alle invariants når input er korrekt LLM-output', () => {
    const days = normalizeAllDays(buildCanonicalVaacupMetadata())
    const violations = assertVaacupOriginalInvariants(days)
    expect(formatVaacupInvariantViolations(violations)).toBe('OK')
  })
})

describe('Høstcup-lignende fixture (notes som array, ingen rå segment.notes-streng)', () => {
  it('beholder lørdag Oppmøte-highlights selv om praktiske notater ikke nevner oppmøte', () => {
    const segMetadata: EventMetadata = {
      tankestromHighlights: [
        { time: '08:20', label: 'Oppmøte før første kamp', type: 'meeting' },
        { time: '09:00', label: 'Første kamp', type: 'match' },
        { time: '13:55', label: 'Oppmøte før andre kamp', type: 'meeting' },
        { time: '14:40', label: 'Andre kamp', type: 'match' },
      ],
      tankestromNotes: [
        'Laget spiser felles lunsj mellom kampene.',
        'Foreldre hjelper med rydding etter siste kamp.',
      ],
    }
    const normalized = readTankestromScheduleDetailsFromMetadata(segMetadata, ['Høstcupen – lørdag'], {
      fallbackStartTime: '08:20',
      sourceTextForValidation: undefined,
      isConditionalSegment: false,
    })
    const labels = normalized.highlights.map((h) => `${h.time} ${h.label}`)
    expect(labels).toEqual([
      '08:20 Oppmøte før første kamp',
      '09:00 Første kamp',
      '13:55 Oppmøte før andre kamp',
      '14:40 Andre kamp',
    ])
  })

  it('beholder fredag 17:30 Oppmøte og 18:15 Første kamp uten å rote til labels', () => {
    const segMetadata: EventMetadata = {
      tankestromHighlights: [
        { time: '17:30', label: 'Oppmøte', type: 'meeting' },
        { time: '18:15', label: 'Første kamp', type: 'match' },
      ],
      tankestromNotes: [
        'Sjekk værmelding og kle dere etter været.',
        'Foreldre hjelper med rydding etter siste kamp.',
      ],
    }
    const normalized = readTankestromScheduleDetailsFromMetadata(segMetadata, ['Høstcupen – fredag'], {
      fallbackStartTime: '17:30',
      sourceTextForValidation: undefined,
      isConditionalSegment: false,
    })
    expect(normalized.highlights).toEqual([
      { time: '17:30', label: 'Oppmøte', type: 'meeting' },
      { time: '18:15', label: 'Første kamp', type: 'match' },
    ])
  })
})

describe('policy: ikke generer Oppmøte fra fallbackStartTime alene', () => {
  it('synthesizer ikke Oppmøte på 18:40 selv om notater inneholder ordet «oppmøte»', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: [],
      notes: ['Oppmøte for foreldre rundt banen.'],
      titleContext: ['Vårcupen – fredag'],
      fallbackStartTime: '18:40',
    })
    const labels = out.highlights.map((h) => h.label.toLowerCase())
    expect(labels.some((l) => l.includes('oppmøte') || l.includes('oppmote'))).toBe(false)
  })

  it('beholder kamp-fallback når notater nevner kamp', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: [],
      notes: ['Første kamp i hallen.'],
      titleContext: ['Vårcupen – fredag'],
      fallbackStartTime: '18:40',
    })
    expect(out.highlights).toHaveLength(1)
    expect(out.highlights[0]!.time).toBe('18:40')
    expect(out.highlights[0]!.type).toBe('match')
  })

  it('synthesizer Oppmøte via anker+offset (uendret pre-eksisterende oppførsel)', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: [],
      notes: ['Møt 50 minutter før kampstart 17:30.'],
      titleContext: ['Høstcupen – fredag'],
      fallbackStartTime: '17:30',
    })
    expect(out.highlights).toEqual([{ time: '16:40', label: 'Oppmøte', type: 'meeting' }])
  })
})

describe('Vårcupen-invariants på muterte (intermittente) LLM-output', () => {
  it('relabler 09:20 Oppmøte → Første kamp når segment.notes har Første kamp 09:20', () => {
    const metadata: EventMetadata = {
      isArrangementParent: true,
      embeddedSchedule: [
        {
          date: '2026-06-13',
          title: 'Lørdag',
          start: '08:35',
          notes:
            'Oppmøte før første kamp kl. 08:35. Første kamp 09:20. Oppmøte før andre kamp 14:25. Andre kamp 15:10.',
          tankestromHighlights: [
            { time: '08:35', label: 'Oppmøte før første kamp', type: 'meeting' },
            { time: '09:20', label: 'Oppmøte', type: 'meeting' },
            { time: '14:25', label: 'Oppmøte', type: 'meeting' },
            { time: '15:10', label: 'Første kamp', type: 'match' },
          ],
        },
      ] as unknown as EventMetadata['embeddedSchedule'],
    }
    const days = normalizeAllDays(metadata)
    const lordag = days.find((d) => d.dayKey === 'lordag')!
    const h0920 = lordag.highlights.find((h) => h.time === '09:20')!
    expect(h0920.label.toLowerCase()).toContain('kamp')
    expect(h0920.label.toLowerCase()).not.toContain('oppmøte')
    const h1510 = lordag.highlights.find((h) => h.time === '15:10')!
    expect(h1510.label.toLowerCase()).toContain('andre')
    const violations = assertVaacupOriginalInvariants(days)
    const codes = violations.map((v) => v.code)
    expect(codes).not.toContain('lordag_0920_labeled_oppmote')
    expect(codes).not.toContain('lordag_1510_labeled_first_kamp')
  })

  it('dropper syntetisk Oppmøte 17:45 på søndag når kilden ikke har konkret tid', () => {
    const metadata: EventMetadata = {
      isArrangementParent: true,
      embeddedSchedule: [
        {
          date: '2026-06-14',
          title: 'Søndag',
          start: '17:45',
          isConditional: true,
          notes: 'Program for søndag avhenger av plassering etter lørdagens kamper.',
          tankestromHighlights: [{ time: '17:45', label: 'Oppmøte', type: 'meeting' }],
        },
      ] as unknown as EventMetadata['embeddedSchedule'],
    }
    const days = normalizeAllDays(metadata)
    const sondag = days.find((d) => d.dayKey === 'sondag')!
    expect(sondag.highlights).toEqual([])
    const violations = assertVaacupOriginalInvariants(days)
    expect(violations.some((v) => v.code === 'sondag_synthetic_oppmote_present')).toBe(false)
    expect(violations.some((v) => v.code === 'sondag_time_leakage_from_fredag')).toBe(false)
  })

  it('synthesizer ikke Oppmøte på 18:40 fredag når highlights er tomme og notater nevner Oppmøte+kamp', () => {
    const metadata: EventMetadata = {
      isArrangementParent: true,
      embeddedSchedule: [
        {
          date: '2026-06-12',
          title: 'Fredag',
          start: '18:40',
          notes: 'Oppmøte kl. 17:45. Første kamp starter 18:40.',
          tankestromHighlights: [],
        },
      ] as unknown as EventMetadata['embeddedSchedule'],
    }
    const days = normalizeAllDays(metadata)
    const fredag = days.find((d) => d.dayKey === 'fredag')!
    const h1840 = fredag.highlights.find((h) => h.time === '18:40')
    if (h1840) {
      expect(h1840.label.toLowerCase()).not.toContain('oppmøte')
    }
    const violations = assertVaacupOriginalInvariants(days)
    expect(violations.some((v) => v.code === 'fredag_1840_labeled_oppmote')).toBe(false)
  })
})

describe('Negativ test: kamp-tid må ikke renderes som Oppmøte', () => {
  it('avviser kunstig Oppmøte-label på kamptid 09:20 lørdag', () => {
    const seg: EmbeddedScheduleSegment = {
      date: '2026-06-13',
      title: 'Lørdag',
      start: '08:35',
      notes: 'Første kamp 09:20.',
      tankestromHighlights: [{ time: '09:20', label: 'Oppmøte', type: 'meeting' }],
    }
    const segMetadata: EventMetadata = {
      tankestromHighlights: seg.tankestromHighlights,
    }
    const normalized = readTankestromScheduleDetailsFromMetadata(segMetadata, [seg.title], {
      fallbackStartTime: seg.start,
      sourceTextForValidation: seg.notes,
      isConditionalSegment: seg.isConditional === true,
    })
    const h = normalized.highlights.find((x) => x.time === '09:20')!
    expect(h.label.toLowerCase()).toContain('kamp')
    expect(h.label.toLowerCase()).not.toContain('oppmøte')
  })
})

describe('Negativ test: oppmøtetid må ikke lekke fra fredag til søndag', () => {
  it('søndag uten konkret kildeevidens får ikke 17:45 Oppmøte', () => {
    const seg: EmbeddedScheduleSegment = {
      date: '2026-06-14',
      title: 'Søndag',
      start: '17:45',
      isConditional: true,
      notes: 'Spilleplan for søndag er foreløpig.',
      tankestromHighlights: [{ time: '17:45', label: 'Oppmøte', type: 'meeting' }],
    }
    const segMetadata: EventMetadata = {
      tankestromHighlights: seg.tankestromHighlights,
    }
    const normalized = readTankestromScheduleDetailsFromMetadata(segMetadata, [seg.title], {
      fallbackStartTime: seg.start,
      sourceTextForValidation: seg.notes,
      isConditionalSegment: seg.isConditional === true,
    })
    expect(normalized.highlights).toEqual([])
  })
})

export { VAACUP_SOURCE, buildCanonicalVaacupMetadata, normalizeAllDays }
