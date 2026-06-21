import { describe, it, expect } from 'vitest'
import { dedupeTankestromNotes } from '../tankestromNoteDedupe'

describe('dedupeTankestromNotes', () => {
  it('removes exact duplicates', () => {
    const input = [
      'Oppmøte kl. 17:45 på fredagen.',
      'Oppmøte kl. 17:45 på fredagen.',
      'Første kamp kl. 18:40.',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result).toEqual([
      'Oppmøte kl. 17:45 på fredagen.',
      'Første kamp kl. 18:40.',
    ])
  })

  it('removes same sentence with/without trailing punctuation', () => {
    const input = [
      'Oppmøte kl. 17:45 på fredagen.',
      'Oppmøte kl. 17:45 på fredagen',
      'Oppmøte kl. 17:45 på fredagen!',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Oppmøte kl. 17:45 på fredagen.')
  })

  it('removes near-duplicate sluttspill/foreløpig notes', () => {
    const input = [
      'Eventuell A-sluttspillkamp hvis laget går videre',
      'Eventuell sluttspillkamp hvis laget går videre.',
      'Kamp kan bli søndag formiddag eller tidlig ettermiddag',
      'Endelig sluttspilltid kommer i appen når arrangøren publiserer oppsettet',
      'Endelig sluttspilltid kommer i appen når arrangøren publiserer oppsettet.',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result.length).toBeLessThanOrEqual(3)
    expect(result.filter((n) => n.includes('sluttspillkamp'))).toHaveLength(1)
    expect(result.filter((n) => n.includes('Endelig sluttspilltid'))).toHaveLength(1)
  })

  it('does NOT merge lines with different concrete times', () => {
    const input = [
      'Oppmøte kl. 08:35 på lørdag',
      'Oppmøte kl. 14:25 på lørdag',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result).toHaveLength(2)
  })

  it('does NOT merge genuinely different practical messages', () => {
    const input = [
      'Ta med drikkeflaske og matpakke',
      'Husk ekstra klær til turneringen',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result).toHaveLength(2)
  })

  it('preserves order (first occurrence wins)', () => {
    const input = [
      'Melding A',
      'Melding B',
      'Melding A.',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result).toEqual(['Melding A', 'Melding B'])
  })

  it('handles empty/whitespace-only lines', () => {
    const input = ['', '  ', 'Viktig info', '']
    const result = dedupeTankestromNotes(input)
    expect(result).toEqual(['Viktig info'])
  })

  it('handles casing differences', () => {
    const input = [
      'program for søndag avhenger av plassering',
      'Program for søndag avhenger av plassering.',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result).toHaveLength(1)
  })

  it('handles Norwegian diacritics consistently', () => {
    const input = [
      'Oppmøte på gressbanen',
      'Oppmote pa gressbanen',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result).toHaveLength(1)
  })

  it('handles substring dedup (shorter is subset of longer)', () => {
    const input = [
      'Sluttspillkamp søndag',
      'Eventuell sluttspillkamp søndag formiddag eller tidlig ettermiddag',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result).toHaveLength(1)
  })

  it('dedupes the Vårcup søndag repetitions', () => {
    const input = [
      'Eventuell A-sluttspillkamp hvis laget går videre',
      'Kamp kan bli søndag formiddag eller tidlig ettermiddag',
      'Endelig sluttspilltid kommer i appen når arrangøren publiserer oppsettet',
      'Egen melding kommer når det er klart og laget går videre',
      'Eventuell sluttspillkamp hvis laget går videre.',
      'Kamp kan bli søndag formiddag eller tidlig ettermiddag.',
      'Endelig sluttspilltid kommer når arrangøren publiserer oppsettet.',
      'Egen melding kommer når det er klart.',
    ]
    const result = dedupeTankestromNotes(input)
    const uniqueTopics = new Set(result.map((n) => n.toLowerCase().slice(0, 20)))
    expect(uniqueTopics.size).toBe(result.length)
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it('handles lines with different dates', () => {
    const input = [
      'Kamp 12. juni kl. 18:40',
      'Kamp 13. juni kl. 09:20',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result).toHaveLength(2)
  })

  it('fjerner generell NB-boilerplate når konkret conditional-notat finnes, men beholder konkret info', () => {
    const input = [
      'Betinget opplegg — avhengig av resultat eller tid som ikke er endelig.',
      'Eventuell A-sluttspillkamp hvis laget går videre.',
      'Kamp kan bli søndag formiddag eller tidlig ettermiddag.',
      'Endelig sluttspilltid kommer i appen når arrangøren publiserer oppsettet.',
      'Egen melding kommer når det er klart om laget går videre.',
      'NB: Usikkert eller betinget opplegg (f.eks. avhengig av resultat eller tid som ikke er endelig). Ikke behandle som fast avtale.',
    ]
    const result = dedupeTankestromNotes(input)

    // Den generelle boilerplate-NB er borte (to nesten like usikkerhetsadvarsler unngås).
    expect(result.some((n) => /ikke behandle som fast avtale/i.test(n))).toBe(false)
    expect(result.some((n) => /^NB:/i.test(n))).toBe(false)

    // Konkrete opplysninger beholdes.
    expect(result.some((n) => /A-sluttspillkamp/i.test(n))).toBe(true)
    expect(result.some((n) => /formiddag eller tidlig ettermiddag/i.test(n))).toBe(true)
    expect(result.some((n) => /arrangøren publiserer oppsettet/i.test(n))).toBe(true)
    expect(result.some((n) => /Egen melding kommer/i.test(n))).toBe(true)

    // Én tydelig usikkerhetsmarkering beholdes (det konkrete betinget-notatet).
    expect(result.some((n) => /Betinget opplegg/i.test(n))).toBe(true)
  })

  it('fjerner også en frittstående «ikke behandle som fast avtale»-disclaimer når konkret info finnes', () => {
    const input = [
      'Betinget opplegg — avhengig av resultat.',
      'Ikke behandle som fast avtale.',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result.some((n) => /fast avtale/i.test(n))).toBe(false)
    expect(result.some((n) => /Betinget opplegg/i.test(n))).toBe(true)
  })

  it('beholder en enslig generell usikkerhets-NB når ingen konkret conditional-notat finnes', () => {
    const input = [
      'Husk drikkeflaske og matpakke.',
      'NB: Usikkert eller betinget opplegg. Ikke behandle som fast avtale.',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result.some((n) => /ikke behandle som fast avtale/i.test(n))).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('beholder distinkte konkrete notater selv om begge handler om usikkerhet', () => {
    const input = [
      'Eventuell A-sluttspillkamp hvis laget går videre.',
      'Kamp kan bli søndag formiddag eller tidlig ettermiddag.',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result).toHaveLength(2)
  })

  it('fjerner ikke et NB-notat som har et konkret klokkeslett', () => {
    const input = [
      'Betinget opplegg — avhengig av resultat.',
      'NB: Mulig ekstra kamp 17:30 hvis laget går videre.',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result.some((n) => /17:30/.test(n))).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('rører ikke et vanlig NB/Merk-notat uten usikkerhets-innhold', () => {
    const input = [
      'Betinget opplegg — avhengig av resultat.',
      'Merk: ta med leggskinn til alle.',
    ]
    const result = dedupeTankestromNotes(input)
    expect(result.some((n) => /leggskinn/i.test(n))).toBe(true)
    expect(result).toHaveLength(2)
  })
})
