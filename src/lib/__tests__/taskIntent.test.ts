import { describe, expect, it } from 'vitest'
import { suggestTaskIntentFromTitleAndNotes } from '../taskIntent'

describe('suggestTaskIntentFromTitleAndNotes', () => {
  it('klassifiserer typiske pliktoppgaver', () => {
    expect(suggestTaskIntentFromTitleAndNotes('Svar i Spond innen mandag', '')).toBe('must_do')
    expect(suggestTaskIntentFromTitleAndNotes('Svar innen torsdag', '')).toBe('must_do')
    expect(suggestTaskIntentFromTitleAndNotes('Gi beskjed om medisiner', '')).toBe('must_do')
    expect(suggestTaskIntentFromTitleAndNotes('Betal egenandel', '')).toBe('must_do')
    expect(suggestTaskIntentFromTitleAndNotes('Betaling senest 1. juni', '')).toBe('must_do')
  })

  it('klassifiserer typiske frivillige forespørsler', () => {
    expect(suggestTaskIntentFromTitleAndNotes('Kan noen hjelpe med frukt', '')).toBe('can_help')
    expect(suggestTaskIntentFromTitleAndNotes('To voksne trengs til frukt', '')).toBe('can_help')
    expect(suggestTaskIntentFromTitleAndNotes('Foreldre trengs til kjøring', '')).toBe('can_help')
    expect(suggestTaskIntentFromTitleAndNotes('Ta ansvar for frukt fredag', '')).toBe('can_help')
    expect(suggestTaskIntentFromTitleAndNotes('Om dere har anledning – hjelp på samlingspunkt', '')).toBe(
      'can_help'
    )
    expect(suggestTaskIntentFromTitleAndNotes('Hjelpe med samlingspunkt lørdag', '')).toBe('can_help')
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

  it('klassifiserer fravær for barn som plikt (ikke valgfritt)', () => {
    expect(suggestTaskIntentFromTitleAndNotes('Gi beskjed dersom barnet ikke kommer på trening', '')).toBe(
      'must_do'
    )
    expect(suggestTaskIntentFromTitleAndNotes('Meld fra dersom barnet ikke kan komme', '')).toBe('must_do')
  })
})
