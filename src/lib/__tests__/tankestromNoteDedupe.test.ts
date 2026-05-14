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
})
