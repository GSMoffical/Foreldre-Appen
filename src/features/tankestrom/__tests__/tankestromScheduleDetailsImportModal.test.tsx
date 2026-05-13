// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TankestromScheduleDetails } from '../../../components/TankestromScheduleDetails'
import { parseEmbeddedScheduleFromMetadata } from '../../../lib/embeddedSchedule'
import { normalizeTankestromScheduleDetails } from '../../../lib/tankestromScheduleDetails'
import { normalizeEmbeddedScheduleParentDisplayTitle } from '../../../lib/tankestromCupEmbeddedScheduleMerge'
import type { EmbeddedScheduleSegment } from '../../../types'
import { buildEmbeddedChildStructuredScheduleDetailsForReview } from '../useTankestromImport'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HOSTCUP_TEXT_PATH = join(__dirname, '../../../../e2e/fixtures/hostcup-original.txt')
const HOSTCUP_ANALYZE_JSON_PATH = join(__dirname, '../../../../e2e/fixtures/hostcup-analyze-response.json')

describe('TankestromScheduleDetails + import-modal (E2E-relevant)', () => {
  afterEach(() => {
    cleanup()
  })

  it('dobbel `normalizeTankestromScheduleDetails` ødelegger ikke lenger «Oppmøte før første kamp» (Høstcupen)', () => {
    const hostcupText = readFileSync(HOSTCUP_TEXT_PATH, 'utf8')
    const analyze = JSON.parse(readFileSync(HOSTCUP_ANALYZE_JSON_PATH, 'utf8')) as {
      items: Array<{ event: { title: string; metadata: { embeddedSchedule?: EmbeddedScheduleSegment[] } } }>
    }
    const parentRaw = analyze.items[0]!.event.title
    const parentCard = normalizeEmbeddedScheduleParentDisplayTitle(parentRaw.trim()).title
    const segs = parseEmbeddedScheduleFromMetadata(analyze.items[0]!.event.metadata)
    const sat = segs.find((s) => s.date === '2026-09-19')
    expect(sat).toBeTruthy()

    const structured = buildEmbeddedChildStructuredScheduleDetailsForReview(
      sat!,
      parentCard,
      'Høstcupen – lørdag',
      'e2e__child-sat',
      { originalImportText: hostcupText }
    )
    const h0820a = structured.highlights.find((h) => h.time === '08:20')
    expect(h0820a?.label).toMatch(/før\s+første\s+kamp/i)

    const secondPass = normalizeTankestromScheduleDetails({
      highlights: structured.highlights,
      notes: structured.notes,
      bringItems: structured.bringItems,
      titleContext: ['Høstcupen – lørdag', parentRaw.trim()],
      precomputedTimeWindowSummaries: structured.timeWindowSummaries,
    })
    const h0820b = secondPass.highlights.find((h) => h.time === '08:20')
    expect(h0820b?.label).toBe(h0820a?.label)
  })

  it('useNormalizedInput: modal-preview viser fulle møte-labels (samme som E2E forventer)', () => {
    const hostcupText = readFileSync(HOSTCUP_TEXT_PATH, 'utf8')
    const analyze = JSON.parse(readFileSync(HOSTCUP_ANALYZE_JSON_PATH, 'utf8')) as {
      items: Array<{ event: { title: string; metadata: { embeddedSchedule?: EmbeddedScheduleSegment[] } } }>
    }
    const parentRaw = analyze.items[0]!.event.title
    const parentCard = normalizeEmbeddedScheduleParentDisplayTitle(parentRaw.trim()).title
    const sat = parseEmbeddedScheduleFromMetadata(analyze.items[0]!.event.metadata).find((s) => s.date === '2026-09-19')!

    const structured = buildEmbeddedChildStructuredScheduleDetailsForReview(
      sat,
      parentCard,
      'Høstcupen – lørdag',
      'e2e__child-sat',
      { originalImportText: hostcupText }
    )

    render(
      <TankestromScheduleDetails
        useNormalizedInput
        highlights={structured.highlights}
        notes={structured.notes}
        bringItems={structured.bringItems}
        titleContext={['Høstcupen – lørdag', parentRaw.trim()]}
        compact
        precomputedTimeWindowSummaries={structured.timeWindowSummaries}
        highlightsTestId="tankestrom-schedule-highlights-2026-09-19"
      />
    )

    const block = screen.getByTestId('tankestrom-schedule-highlights-2026-09-19')
    expect(block.textContent).toMatch(/08:20/)
    expect(block.textContent).toMatch(/Oppmøte før første kamp/i)
    expect(block.textContent).toMatch(/13:55/)
    expect(block.textContent).toMatch(/Oppmøte før andre kamp/i)
  })
})
