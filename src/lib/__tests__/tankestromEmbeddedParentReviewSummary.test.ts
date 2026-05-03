import { describe, expect, it } from 'vitest'
import { deriveEmbeddedParentReviewSummary } from '../tankestromEmbeddedParentReviewSummary'
import type { EmbeddedScheduleSegment } from '../../types'

describe('deriveEmbeddedParentReviewSummary', () => {
  it('bruker notater når de har substans utover tittel', () => {
    const r = deriveEmbeddedParentReviewSummary({
      notesForPreview:
        'Cuphelg med kamper fredag og lørdag. Mulig sluttspill søndag avhengig av resultat. Husk drikkeflaske.',
      parentTitleCompare: 'Vårcupen 2026',
      metadata: undefined,
      segments: undefined,
    })
    expect(r.text).toBeTruthy()
    expect(r.text!.toLowerCase()).toContain('cup')
    expect(r.derivedFromExistingNotes).toBe(true)
    expect(r.suppressedAsWeak).toBe(false)
  })

  it('viser ingenting når notater bare gjentar tittelen', () => {
    const r = deriveEmbeddedParentReviewSummary({
      notesForPreview: 'Vårcupen 2026',
      parentTitleCompare: 'Vårcupen 2026',
      metadata: undefined,
      segments: undefined,
    })
    expect(r.text).toBeNull()
    expect(r.suppressedAsWeak).toBe(true)
  })

  it('fall til program-heuristikk når notater mangler og segmenter signaliserer kamper', () => {
    const segments: EmbeddedScheduleSegment[] = [
      { date: '2026-06-12', title: 'Kamp lag A' },
      { date: '2026-06-13', title: 'Kamp lag B', isConditional: true },
    ]
    const r = deriveEmbeddedParentReviewSummary({
      notesForPreview: '',
      parentTitleCompare: 'Vårcupen 2026',
      metadata: undefined,
      segments,
    })
    expect(r.text).toBeTruthy()
    expect(r.text!.toLowerCase()).toMatch(/kamp|aktivitet/)
    expect(r.derivedFromExistingNotes).toBe(false)
  })
})
