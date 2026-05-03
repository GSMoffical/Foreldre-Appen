import { describe, expect, it } from 'vitest'
import {
  deriveSchoolWeekSpecialSummary,
  scoreSchoolWeekSpecialLine,
} from '../schoolWeekOverlayReviewSpecialSummary'

describe('scoreSchoolWeekSpecialLine', () => {
  it('gir høy score for tentamen og tur', () => {
    expect(scoreSchoolWeekSpecialLine('Tentamen i matematikk')).toBeGreaterThanOrEqual(8)
    expect(scoreSchoolWeekSpecialLine('Turdag til museet')).toBeGreaterThanOrEqual(8)
  })

  it('gir 0 for portalstøy', () => {
    expect(scoreSchoolWeekSpecialLine('Logg inn på Skolearena for å se fravær')).toBe(0)
  })
})

describe('deriveSchoolWeekSpecialSummary', () => {
  it('bygger kort tekst fra ukentlig sammendrag når signalet er tydelig', () => {
    const r = deriveSchoolWeekSpecialSummary({
      weeklyCondensedLines: ['Nasjonale prøver i lesing denne uka'],
      perDay: [],
    })
    expect(r.text).toBeTruthy()
    expect(r.rendered).toBe(true)
    expect(r.specialEventMatched).toBe(true)
    expect(r.suppressedAsWeak).toBe(false)
  })

  it('plukker signal fra dagsdetaljer når ukelinjene mangler', () => {
    const r = deriveSchoolWeekSpecialSummary({
      weeklyCondensedLines: [],
      perDay: [
        {
          summary: '',
          reason: '',
          sectionLines: ['Husk håndkle — svømming tirsdag'],
        },
      ],
    })
    expect(r.text).toBeTruthy()
    expect(r.text!.toLowerCase()).toContain('svøm')
    expect(r.specialEventMatched).toBe(true)
  })

  it('viser ingenting når innholdet bare er vanlig undervisning uten avvik', () => {
    const r = deriveSchoolWeekSpecialSummary({
      weeklyCondensedLines: ['Vanlig undervisning etter timeplanen'],
      perDay: [],
    })
    expect(r.text).toBeNull()
    expect(r.rendered).toBe(false)
    expect(r.suppressedAsWeak).toBe(true)
  })

  it('slår sammen to tydelige punkter med mellomromstegn', () => {
    const r = deriveSchoolWeekSpecialSummary({
      weeklyCondensedLines: ['Planleggingsdag fredag'],
      perDay: [
        {
          summary: 'Utflukt til naturhistorisk museum onsdag',
          reason: '',
          sectionLines: [],
        },
      ],
    })
    expect(r.text).toContain('·')
    expect(r.text!.toLowerCase()).toMatch(/planleggingsdag|utflukt/)
  })
})
