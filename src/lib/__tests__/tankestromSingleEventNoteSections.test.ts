import { describe, expect, it } from 'vitest'
import { parseSingleEventNoteSections } from '../tankestromSingleEventNoteSections'

describe('parseSingleEventNoteSections', () => {
  it('trekker ut møtested og gruppekode, og stripper «Viktig for hele perioden»-wrapper', () => {
    const out = parseSingleEventNoteSections([
      'Viktig for hele perioden: Møtested: kiosken nedenfor parkeringsplassen på Sognsvann; NYT-TK-2STC',
    ])
    expect(out.meetingPlace).toBe('kiosken nedenfor parkeringsplassen på Sognsvann')
    expect(out.appliesTo).toEqual(['NYT-TK-2STC'])
    // Wrapper-frasen og koden ligger ikke igjen som rå notat.
    expect(out.notes).toEqual([])
    expect(out.practical).toEqual([])
  })

  it('ruter øvrig wrapper-innhold til praktisk info', () => {
    const out = parseSingleEventNoteSections([
      'Viktig for hele perioden: Møtested: ved porten; Ta med regntøy og niste',
    ])
    expect(out.meetingPlace).toBe('ved porten')
    expect(out.practical).toEqual(['Ta med regntøy og niste'])
    expect(out.notes).toEqual([])
  })

  it('trekker ut møtested også uten wrapper', () => {
    const out = parseSingleEventNoteSections(['Møtested: hovedinngangen'])
    expect(out.meetingPlace).toBe('hovedinngangen')
    expect(out.notes).toEqual([])
  })

  it('lar vanlig fritekst stå som notat (ingen falske møtested/kode-treff)', () => {
    const out = parseSingleEventNoteSections(['Ta med drikke. Vi møtes ved bommen.'])
    expect(out.meetingPlace).toBeUndefined()
    expect(out.appliesTo).toEqual([])
    expect(out.practical).toEqual([])
    expect(out.notes).toEqual(['Ta med drikke. Vi møtes ved bommen.'])
  })

  it('splitter ikke på komma (adresse med komma bevares)', () => {
    const out = parseSingleEventNoteSections(['Møtested: Storgata 1, 0001 Oslo'])
    expect(out.meetingPlace).toBe('Storgata 1, 0001 Oslo')
  })

  it('håndterer tomme/whitespace-notater', () => {
    const out = parseSingleEventNoteSections(['', '   ', 'Viktig for hele perioden:   '])
    expect(out).toEqual({ practical: [], appliesTo: [], notes: [] })
  })
})
