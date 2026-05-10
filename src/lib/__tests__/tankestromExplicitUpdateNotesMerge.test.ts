/**
 * Eksplisitt «Oppdater eksisterende»-flyt i Tankestrøm-review:
 *   eksisterende notater på kalenderhendelsen skal bevares når Tankestrøm-import
 *   tilfører nye oppfølgings-detaljer. Helperen brukes i `approveSelected`-update-grenen
 *   i useTankestromImport.ts.
 *
 * Denne testfilen låser kontrakten for helperen — produksjonskoden kaller den med
 *   buildTankestromExplicitUpdateEventNotes(existingEvent.notes, buildPersistNotes(draft, metadata))
 */
import { describe, expect, it } from 'vitest'
import {
  buildTankestromExplicitUpdateEventNotes,
  mergeNotesPreferNonEmpty,
} from '../tankestromCalendarPersistDup'

describe('buildTankestromExplicitUpdateEventNotes', () => {
  it('bevarer eksisterende manuelle notater når import tilfører nye detaljer', () => {
    const existing = 'Manuell beskjed fra forelder: barn må hentes 15:30.'
    const incoming = 'Oppmøte 30 min før kampstart. Husk drakt.'
    const merged = buildTankestromExplicitUpdateEventNotes(existing, incoming)
    expect(merged).toBe(`${existing}\n\n${incoming}`)
    expect(merged).toContain(existing)
    expect(merged).toContain(incoming)
  })

  it('tom ny notes overskriver ikke eksisterende notes', () => {
    const existing = 'Viktig: ekstra utstyr i bilen.'
    expect(buildTankestromExplicitUpdateEventNotes(existing, '')).toBe(existing)
    expect(buildTankestromExplicitUpdateEventNotes(existing, undefined)).toBe(existing)
    expect(buildTankestromExplicitUpdateEventNotes(existing, '   ')).toBe(existing)
  })

  it('tom eksisterende notes får nye import-notes', () => {
    const incoming = 'Tidspunkt oppdatert: nytt program lagt inn.'
    expect(buildTankestromExplicitUpdateEventNotes('', incoming)).toBe(incoming)
    expect(buildTankestromExplicitUpdateEventNotes(undefined, incoming)).toBe(incoming)
  })

  it('begge tomme gir undefined', () => {
    expect(buildTankestromExplicitUpdateEventNotes('', '')).toBeUndefined()
    expect(buildTankestromExplicitUpdateEventNotes(undefined, undefined)).toBeUndefined()
    expect(buildTankestromExplicitUpdateEventNotes('   ', '\n')).toBeUndefined()
  })

  it('ingen dobbel tekst når incoming er substring av existing', () => {
    const existing = 'Husk drakt og leggskinn. Møt ved hovedinngang 17:30.'
    const incoming = 'Husk drakt'
    const merged = buildTankestromExplicitUpdateEventNotes(existing, incoming)
    expect(merged).toBe(existing)
  })

  it('ingen dobbel tekst når existing er substring av incoming (mer komplett vinner)', () => {
    const existing = 'Møt ved hovedinngang'
    const incoming = 'Møt ved hovedinngang kl. 17:30. Husk drakt.'
    const merged = buildTankestromExplicitUpdateEventNotes(existing, incoming)
    expect(merged).toBe(incoming)
  })

  it('append bruker tom linje som synlig skille mellom gammel og ny info', () => {
    const merged = buildTankestromExplicitUpdateEventNotes('Linje A', 'Linje B')
    expect(merged).toBe('Linje A\n\nLinje B')
  })

  it('flerlinjer eksisterende notes bevares ord-for-ord når import legger til mer', () => {
    const existing = ['Hentes 15:30', 'Husk hodelykt', 'Foreldre kjører til Hovet'].join('\n')
    const incoming = 'Oppdatert kampstart 18:40. Møt 30 min før.'
    const merged = buildTankestromExplicitUpdateEventNotes(existing, incoming) ?? ''
    expect(merged).toContain('Hentes 15:30')
    expect(merged).toContain('Husk hodelykt')
    expect(merged).toContain('Foreldre kjører til Hovet')
    expect(merged).toContain('Oppdatert kampstart 18:40.')
  })

  it('følger samme regel som mergeNotesPreferNonEmpty (idempotent-stien)', () => {
    const samples: Array<[string | undefined, string | undefined]> = [
      ['A', 'B'],
      ['A', ''],
      ['', 'B'],
      [undefined, undefined],
      ['A og mer', 'A'],
      ['A', 'A og mer'],
      ['Lang manuell notat', 'Lang manuell notat'],
    ]
    for (const [a, b] of samples) {
      expect(buildTankestromExplicitUpdateEventNotes(a, b)).toBe(mergeNotesPreferNonEmpty(a, b))
    }
  })
})
