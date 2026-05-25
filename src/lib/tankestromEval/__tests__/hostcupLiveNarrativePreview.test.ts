import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  extractDaySectionForScheduleValidation,
  sourceMentionsTimeAsTentativeWindow,
} from '../../tankestromScheduleDetails'
import {
  runHostcupLiveNarrativePreviewCase,
  writeHostcupLiveNarrativeDebugActual,
} from '../hostcupLiveNarrativePreviewHarness'

const FIXTURE_TEXT = readFileSync(
  join(process.cwd(), 'fixtures/tankestrom/hostcup_duration_inference_rich.txt'),
  'utf8'
)

function day(r: ReturnType<typeof runHostcupLiveNarrativePreviewCase>, date: string) {
  const d = r.days.find((x) => x.date === date)
  if (!d) throw new Error(`missing day ${date}`)
  return d
}

let lastDebugPath: string | undefined

afterEach(() => {
  if (lastDebugPath) {
    // eslint-disable-next-line no-console
    console.info(`[hostcup live narrative] debug: ${lastDebugPath}`)
    lastDebugPath = undefined
  }
})

function assertLivePreview(
  r: ReturnType<typeof runHostcupLiveNarrativePreviewCase>,
  assertFn: () => void
): void {
  try {
    assertFn()
  } catch (e) {
    lastDebugPath = writeHostcupLiveNarrativeDebugActual(r, {
      filename: 'hostcup_duration_inference_rich.actual.json',
    })
    throw e
  }
}

describe('hostcup live narrative — dagseksjon fra prosa', () => {
  it('plukker fredag/lørdag/søndag fra «Fredag spiller»-avsnitt', () => {
    const fri = extractDaySectionForScheduleValidation(FIXTURE_TEXT, '2026-09-18')
    expect(fri).toContain('17:30')
    expect(fri).not.toMatch(/\b10:00\b.*\b12:00\b/)

    const lor = extractDaySectionForScheduleValidation(FIXTURE_TEXT, '2026-09-19')
    expect(lor).toContain('09:15')
    expect(lor).toContain('14:40')

    const son = extractDaySectionForScheduleValidation(FIXTURE_TEXT, '2026-09-20')
    expect(son).toContain('mellom kl. 10:00 og 12:00')
    expect(sourceMentionsTimeAsTentativeWindow('10:00', son)).toBe(true)
    expect(sourceMentionsTimeAsTentativeWindow('12:00', son)).toBe(true)
  })
})

describe('hostcup live narrative — import-preview golden', () => {
  it('fredag: 16:40/17:30, ingen 10:00/12:00/foreløpig', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    assertLivePreview(r, () => {
      const fri = day(r, '2026-09-18')
      expect(fri.selected).toBe(true)
      expect(fri.canonicalDisplayTime).toBe('16:40')
      expect(fri.canonicalHighlights).toEqual(['16:40 Oppmøte', '17:30 Første kamp'])
      expect(fri.canonicalHighlights.some((h) => /10:00|12:00|foreløpig/i.test(h))).toBe(false)
      expect(fri.validationBlockers).not.toContain('missing_end_time')
    })
  })

  it('lørdag: 08:30–14:40, ingen søndagslekkasje', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    assertLivePreview(r, () => {
      const lor = day(r, '2026-09-19')
      expect(lor.selected).toBe(true)
      expect(lor.canonicalDisplayTime).toBe('08:30')
      expect(lor.canonicalHighlights).toEqual([
        '08:30 Oppmøte før første kamp',
        '09:15 Første kamp',
        '13:55 Oppmøte før andre kamp',
        '14:40 Andre kamp',
      ])
      expect(lor.canonicalHighlights.some((h) => /10:00|12:00|foreløpig/i.test(h))).toBe(false)
    })
  })

  it('søndag: foreløpig, ikke selected, tidsvindu uten concrete highlight', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    assertLivePreview(r, () => {
      const son = day(r, '2026-09-20')
      expect(son.selected).toBe(false)
      expect(son.isPreliminaryDay).toBe(true)
      expect(son.isImportSelectable).toBe(false)
      expect(son.canonicalDisplayTime).toBeNull()
      expect(son.timeLabel).toBe('–')
      expect(son.canonicalHighlights).toEqual([])
      expect(son.timeWindowSummaries.some((w) => w.includes('10:00') && w.includes('12:00'))).toBe(
        true
      )
    })
  })

  it('import: 2 hendelser + Spond 21:00 som task', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    assertLivePreview(r, () => {
      expect(r.importButtonSummary).toBe('1 arrangement / 2 hendelser')
      expect(r.embeddedChildSelectedCount).toBe(2)
      expect(r.taskDueTime).toBe('21:00')
      for (const d of r.days) {
        expect(d.canonicalHighlights.some((h) => h.startsWith('21:00'))).toBe(false)
      }
    })
  })
})

describe('hostcup live narrative — draft/persist bruker canonical tider', () => {
  it('fredag: rå segment.start 10:00, draft/persist start 16:40 (aldri 10:00)', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    assertLivePreview(r, () => {
      const fri = day(r, '2026-09-18')
      expect(fri.rawSegmentStart).toBe('10:00')
      expect(fri.canonicalDisplayTime).toBe('16:40')
      expect(fri.editSeedStart).toBe('16:40')
      expect(fri.draftStart).toBe('16:40')
      expect(fri.draftStart).not.toBe('10:00')
      expect(fri.draftEnd).toBe('18:45')
      expect(fri.editSeedStart).toBe(fri.draftStart)
      expect(fri.endTimeProvenance).toBe('frontend_canonical_fallback')
      expect(fri.endTimeSource).toBe('frontend_canonical_fallback')
      expect(fri.draftInferredEndTime).toBe(true)
    })
  })

  it('lørdag: draft start 08:30, estimert slutt 15:55 (siste kamp 14:40 + 75 min)', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    assertLivePreview(r, () => {
      const lor = day(r, '2026-09-19')
      expect(lor.draftStart).toBe('08:30')
      expect(lor.draftStart).not.toBe('10:00')
      expect(lor.editSeedStart).toBe('08:30')
      expect(lor.draftEnd).toBe('15:55')
      expect(lor.endTimeProvenance).toBe('frontend_canonical_fallback')
      expect(lor.endTimeSource).toBe('frontend_canonical_fallback')
      expect(lor.draftInferredEndTime).toBe(true)
    })
  })

  it('søndag: ikke selected, ingen draftStart 12:00', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    assertLivePreview(r, () => {
      const son = day(r, '2026-09-20')
      expect(son.selected).toBe(false)
      expect(son.rawSegmentStart).toBe('12:00')
      expect(son.draftStart).toBe('')
      expect(son.draftStart).not.toBe('12:00')
    })
  })
})

describe('hostcup live narrative — Tankestrom API duration-felt', () => {
  it('fredag: API inferred end 18:45 (ikke lokal fallback)', () => {
    const r = runHostcupLiveNarrativePreviewCase({
      analyzeJson: 'hostcup_duration_inference_rich_api.analyze.json',
    })
    assertLivePreview(r, () => {
      const fri = day(r, '2026-09-18')
      expect(fri.draftStart).toBe('16:40')
      expect(fri.draftEnd).toBe('18:45')
      expect(fri.endTimeProvenance).toBe('api_inferred_end')
      expect(fri.endTimeSource).toBe('computed_from_duration_and_aftertime')
      expect(fri.draftInferredEndTime).toBe(true)
    })
  })

  it('lørdag: eksplisitt API end 16:00', () => {
    const r = runHostcupLiveNarrativePreviewCase({
      analyzeJson: 'hostcup_duration_inference_rich_api.analyze.json',
    })
    assertLivePreview(r, () => {
      const lor = day(r, '2026-09-19')
      expect(lor.draftStart).toBe('08:30')
      expect(lor.draftEnd).toBe('16:00')
      expect(lor.endTimeProvenance).toBe('source_confirmed_end')
      expect(lor.draftInferredEndTime).toBe(false)
    })
  })
})

describe('hostcup live narrative — frontend fallback uten pålitelig API-slutt', () => {
  it('importerer med estimert slutt når Tankestrom mangler end/buffer', () => {
    const r = runHostcupLiveNarrativePreviewCase({
      analyzeJson: 'hostcup_duration_inference_rich_no_api_end.analyze.json',
    })
    assertLivePreview(r, () => {
      const fri = day(r, '2026-09-18')
      const lor = day(r, '2026-09-19')
      const son = day(r, '2026-09-20')
      expect(fri.draftStart).toBe('16:40')
      expect(fri.draftEnd).toBe('18:45')
      expect(fri.endTimeProvenance).toBe('frontend_canonical_fallback')
      expect(lor.draftStart).toBe('08:30')
      expect(lor.draftEnd).toBe('15:55')
      expect(lor.endTimeProvenance).toBe('frontend_canonical_fallback')
      expect(son.draftStart).toBe('')
      expect(son.selected).toBe(false)
      expect(r.embeddedChildSelectedCount).toBe(2)
      for (const d of [fri, lor]) {
        expect(d.validationBlockers).not.toContain('missing_end_time')
      }
    })
  })
})
