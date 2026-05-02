import { describe, expect, it } from 'vitest'
import { suggestTaskIntentFromTitleAndNotes } from '../taskIntent'

describe('suggestTaskIntentFromTitleAndNotes', () => {
  it('klassifiserer typiske pliktoppgaver', () => {
    expect(suggestTaskIntentFromTitleAndNotes('Svar i Spond innen mandag', '')).toBe('must_do')
    expect(suggestTaskIntentFromTitleAndNotes('Gi beskjed om medisiner', '')).toBe('must_do')
    expect(suggestTaskIntentFromTitleAndNotes('Betal egenandel', '')).toBe('must_do')
  })

  it('klassifiserer typiske frivillige forespørsler', () => {
    expect(suggestTaskIntentFromTitleAndNotes('Kan noen hjelpe med frukt', '')).toBe('can_help')
    expect(suggestTaskIntentFromTitleAndNotes('Det trengs to voksne til kiosk', '')).toBe('can_help')
    expect(
      suggestTaskIntentFromTitleAndNotes('Gi beskjed hvis du kan hjelpe med samlingspunkt', '')
    ).toBe('can_help')
    expect(suggestTaskIntentFromTitleAndNotes('Noen som kan kjøre', '')).toBe('can_help')
  })

  it('skiller gi beskjed om (plikt) fra hvis du kan (frivillig)', () => {
    expect(suggestTaskIntentFromTitleAndNotes('Gi beskjed om allergier', '')).toBe('must_do')
    expect(suggestTaskIntentFromTitleAndNotes('Gi beskjed hvis du kan stille', '')).toBe('can_help')
  })

  it('klassifiserer betinget «gi beskjed dersom …» som valgfritt', () => {
    expect(suggestTaskIntentFromTitleAndNotes('Gi beskjed dersom barnet ikke kommer på trening', '')).toBe('can_help')
  })
})
