import { describe, expect, it } from 'vitest'
import { runHostcupLiveNarrativePreviewCase } from '../hostcupLiveNarrativePreviewHarness'
import {
  persistedRowsVisibleInCalendar,
  simulateHostcupEmbeddedChildPersist,
} from '../hostcupLiveNarrativePersistHarness'

describe('hostcup live narrative — full persist path', () => {
  it('eksporterer fredag/lørdag med canonical tider, ikke søndag', () => {
    const preview = runHostcupLiveNarrativePreviewCase()
    expect(preview.importButtonSummary).toBe('1 arrangement / 2 hendelser')
    expect(preview.embeddedChildSelectedCount).toBe(2)

    const persist = simulateHostcupEmbeddedChildPersist()
    expect(persist.wouldBypassParentUpdateOnly).toBe(true)
    expect(persist.segmentsExported).toBe(2)
    expect(persist.validationFailures).toEqual([])
    expect(persist.persisted).toHaveLength(2)

    const fri = persist.persisted.find((r) => r.date === '2026-09-18')
    const lor = persist.persisted.find((r) => r.date === '2026-09-19')
    const son = persist.persisted.find((r) => r.date === '2026-09-20')

    expect(fri).toMatchObject({ start: '16:40', end: '18:45' })
    expect(lor).toMatchObject({ start: '08:30', end: '15:55' })
    expect(son).toBeUndefined()

    expect(persist.selectedIds.filter((id) => id.startsWith('ts-emb:'))).toHaveLength(2)
  })

  it('persisterte rader er synlige i kalenderfilter (timed, person)', () => {
    const persist = simulateHostcupEmbeddedChildPersist()
    const visible = persistedRowsVisibleInCalendar(persist.persisted, 'person-a')
    expect(visible).toHaveLength(2)
  })

  it('frontend fallback fixture: estimert slutt uten API-end', () => {
    const persist = simulateHostcupEmbeddedChildPersist({
      analyzeJson: 'hostcup_duration_inference_rich_no_api_end.analyze.json',
    })
    expect(persist.persisted).toHaveLength(2)
    expect(persist.persisted.find((r) => r.date === '2026-09-19')?.end).toBe('15:55')
    expect(persist.validationFailures.some((f) => f.codes.includes('missing_end_time'))).toBe(false)
  })
})
