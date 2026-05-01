import { describe, expect, it } from 'vitest'
import { tryExtractHeldagsproveHovedmalSidemalTitle } from '../schoolWeekOverlayReplaceTitle'

describe('tryExtractHeldagsproveHovedmalSidemalTitle', () => {
  it('plukker ut hovedmål og sidemål fra korpus', () => {
    expect(tryExtractHeldagsproveHovedmalSidemalTitle(['Heldagsprøve i hovedmål'])).toBe('Heldagsprøve i hovedmål')
    expect(tryExtractHeldagsproveHovedmalSidemalTitle(['annet', 'Heldagsprøve i sidemål.'])).toBe(
      'Heldagsprøve i sidemål'
    )
    expect(tryExtractHeldagsproveHovedmalSidemalTitle(['Heldags prøve i hovedmål'])).toBe('Heldagsprøve i hovedmål')
  })

  it('returnerer undefined når mønsteret mangler', () => {
    expect(tryExtractHeldagsproveHovedmalSidemalTitle(['Heldagsprøve i matematikk'])).toBeUndefined()
  })
})
