import { describe, expect, it } from 'vitest'
import { stripRedundantHighlightsForReviewDisplay } from '../tankestromReviewNotesDisplay'

describe('stripRedundantHighlightsForReviewDisplay', () => {
  it('lar unike høydepunkter stå', () => {
    const raw =
      'Høydepunkter:\nHusk drikkeflaske.\n\nNotater:\nOppmøte ved hall 2.'
    const { text, suppressed } = stripRedundantHighlightsForReviewDisplay(raw)
    expect(suppressed).toBe(false)
    expect(text).toContain('Høydepunkter')
    expect(text).toContain('drikkeflaske')
  })

  it('fjerner høydepunkter som gjentar notater', () => {
    const raw =
      'Høydepunkter:\nKamp kl. 18:00\n\nNotater:\nKamp kl. 18:00. Husk nøkkelkort.'
    const { text, suppressed } = stripRedundantHighlightsForReviewDisplay(raw)
    expect(suppressed).toBe('duplicate')
    expect(text).not.toMatch(/høydepunkter/i)
    expect(text).toContain('Notater')
    expect(text).toContain('nøkkelkort')
  })

  it('fjerner svake/tomme høydepunkter', () => {
    const raw = 'Høydepunkter:\n•\n\nNotater:\nEkte innhold her.'
    const { text, suppressed } = stripRedundantHighlightsForReviewDisplay(raw)
    expect(suppressed).toBe('weak')
    expect(text).not.toMatch(/høydepunkter/i)
    expect(text).toContain('Ekte innhold')
  })

  it('fjerner høydepunkter som bare gjentar tittel', () => {
    const raw = 'Høydepunkter:\nOppmøte klokken 17:45'
    const { text, suppressed } = stripRedundantHighlightsForReviewDisplay(raw, {
      compareAgainst: 'Oppmøte klokken 17:45',
    })
    expect(suppressed).toBe('duplicate')
    expect(text).toBeNull()
  })
})
