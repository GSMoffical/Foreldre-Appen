import { describe, expect, it } from 'vitest'
import {
  buildCalendarUpdateDiff,
  calendarUpdateDiffIsEmpty,
} from '../tankestromCalendarUpdateDiff'

describe('buildCalendarUpdateDiff', () => {
  it('viser changed når starttid er ulik', () => {
    const diff = buildCalendarUpdateDiff({
      existingEvent: { title: 'Vårcuppen', date: '2026-04-12', start: '09:00', end: '10:00' },
      proposalEvent: { title: 'Vårcuppen', date: '2026-04-12', start: '08:00', end: '10:00' },
    })
    expect(diff.changed).toEqual([{ label: 'Start', oldValue: '09:00', newValue: '08:00' }])
    expect(diff.added).toEqual([])
    expect(diff.kept).toEqual([])
  })

  it('viser changed for dato med lesbar norsk visning', () => {
    const diff = buildCalendarUpdateDiff({
      existingEvent: { title: 'Vårcuppen', date: '2026-04-12' },
      proposalEvent: { title: 'Vårcuppen', date: '2026-04-13' },
    })
    expect(diff.changed).toEqual([{ label: 'Dato', oldValue: '12. april', newValue: '13. april' }])
  })

  it('viser added når nytt forslag har sted som mangler i eksisterende', () => {
    const diff = buildCalendarUpdateDiff({
      existingEvent: { title: 'Vårcuppen', date: '2026-04-12' },
      proposalEvent: { title: 'Vårcuppen', date: '2026-04-12', location: 'Lørenskoghallen' },
    })
    expect(diff.added).toEqual([{ label: 'Sted', value: 'Lørenskoghallen' }])
  })

  it('viser kept når gammel info finnes og ny info mangler (sletter aldri)', () => {
    const diff = buildCalendarUpdateDiff({
      existingEvent: { title: 'Vårcuppen', date: '2026-04-12', location: 'Lørenskoghallen' },
      proposalEvent: { title: 'Vårcuppen', date: '2026-04-12' },
    })
    expect(diff.kept).toEqual([{ label: 'Sted', value: 'Lørenskoghallen' }])
    expect(diff.changed).toEqual([])
    expect(diff.added).toEqual([])
  })

  it('utelater like verdier (kompakt)', () => {
    const diff = buildCalendarUpdateDiff({
      existingEvent: { title: 'Vårcuppen', date: '2026-04-12', start: '09:00', location: 'Hall A' },
      proposalEvent: { title: 'Vårcuppen', date: '2026-04-12', start: '09:00', location: 'Hall A' },
    })
    expect(calendarUpdateDiffIsEmpty(diff)).toBe(true)
  })

  it('legger nye notater til som added når gammel mangler notater', () => {
    const diff = buildCalendarUpdateDiff({
      existingEvent: { title: 'Vårcuppen', date: '2026-04-12' },
      proposalEvent: { title: 'Vårcuppen', date: '2026-04-12', notes: 'Husk rød drakt' },
    })
    expect(diff.added).toEqual([{ label: 'Notat', value: 'Husk rød drakt' }])
  })

  it('behandler ulike notater konservativt (usikkert, beholder gammel)', () => {
    const diff = buildCalendarUpdateDiff({
      existingEvent: { title: 'Vårcuppen', date: '2026-04-12', notes: 'Gammel beskjed' },
      proposalEvent: { title: 'Vårcuppen', date: '2026-04-12', notes: 'Ny beskjed' },
    })
    expect(diff.changed).toEqual([])
    expect(diff.uncertain).toHaveLength(1)
    expect(diff.uncertain[0]!.label).toBe('Notat')
    expect(diff.uncertain[0]!.oldValue).toBe('Gammel beskjed')
    expect(diff.uncertain[0]!.newValue).toBe('Ny beskjed')
  })

  it('beholder gamle notater når nytt forslag mangler notater', () => {
    const diff = buildCalendarUpdateDiff({
      existingEvent: { title: 'Vårcuppen', date: '2026-04-12', notes: 'Viktig beskjed' },
      proposalEvent: { title: 'Vårcuppen', date: '2026-04-12' },
    })
    expect(diff.kept).toContainEqual({ label: 'Notat', value: 'Viktig beskjed' })
    expect(diff.uncertain).toEqual([])
  })

  it('flagger tittel som changed kun når den er tydelig forskjellig', () => {
    const similar = buildCalendarUpdateDiff({
      existingEvent: { title: 'Vårcuppen', date: '2026-04-12' },
      proposalEvent: { title: 'Vårcuppen 2026', date: '2026-04-12' },
    })
    expect(similar.changed.find((c) => c.label === 'Tittel')).toBeUndefined()

    const clearlyDifferent = buildCalendarUpdateDiff({
      existingEvent: { title: 'Vårcuppen', date: '2026-04-12' },
      proposalEvent: { title: 'Tannlegetime', date: '2026-04-12' },
    })
    expect(clearlyDifferent.changed).toContainEqual({
      label: 'Tittel',
      oldValue: 'Vårcuppen',
      newValue: 'Tannlegetime',
    })
  })
})
