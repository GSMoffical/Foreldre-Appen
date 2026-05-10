/**
 * Karakteriseringstester for dagens merge-/oppdateringsoppførsel ved Tankestrøm-import.
 *
 * Disse testene dokumenterer hvordan eksisterende kalenderhendelser oppdateres,
 * uten å foreslå produktendring. De er ment som en sikring mot stille regresjon
 * når Vårcup-/oppfølgings-flyten endres senere.
 *
 * Det finnes to ulike merge-paths i import-persist:
 * 1. `buildTankestromIdempotentEventUpdate` — brukes når `persistCreateEvent`
 *    oppdager fingerprint-duplikat i ankrene (idempotent reimport).
 *    Denne er konservativ: notes merges via `mergeNotesPreferNonEmpty`,
 *    og metadata får shallow-merge `{...existing, ...incoming}`.
 *
 * 2. Eksplisitt user-chosen update i `approveSelected` (review-banner).
 *    Bygger ny `metadata` fra `{...baseMeta, ...nye felter}` og
 *    sender `notes/start/end/personId` direkte fra import-draft via `editEvent`.
 *    Dvs. for denne pathen erstattes notes/tid med import sin verdi
 *    (ingen append, ingen non-empty fallback). Eksisterende metadata-felter
 *    beholdes så lenge de ikke har samme nøkkel som noe i ny metadata.
 */
import { describe, expect, it } from 'vitest'
import {
  buildTankestromIdempotentEventUpdate,
  mergeNotesPreferNonEmpty,
  tankestromPersistFingerprint,
} from '../tankestromCalendarPersistDup'
import type { Event } from '../../types'

describe('mergeNotesPreferNonEmpty (idempotent path)', () => {
  it('beholder eksisterende når import er tom', () => {
    expect(mergeNotesPreferNonEmpty('Eksisterende info', '')).toBe('Eksisterende info')
    expect(mergeNotesPreferNonEmpty('Eksisterende info', undefined)).toBe('Eksisterende info')
  })

  it('bruker import når eksisterende er tom', () => {
    expect(mergeNotesPreferNonEmpty('', 'Ny info')).toBe('Ny info')
  })

  it('beholder lengste når én er substring av den andre', () => {
    expect(mergeNotesPreferNonEmpty('A', 'A og mer')).toBe('A og mer')
    expect(mergeNotesPreferNonEmpty('A og mer', 'A')).toBe('A og mer')
  })

  it('legger sammen med tom linje når begge er reelt forskjellige', () => {
    const out = mergeNotesPreferNonEmpty('Gammelt', 'Helt annet nytt')
    expect(out).toBe('Gammelt\n\nHelt annet nytt')
  })
})

describe('buildTankestromIdempotentEventUpdate (idempotent path)', () => {
  it('shallow-merger metadata og foretrekker non-empty notes', () => {
    const existing: Event = {
      id: 'evt-1',
      personId: 'child-1',
      title: 'Vårcupen',
      start: '17:45',
      end: '18:45',
      notes: 'Husk drakt.',
      location: 'Bekkestua',
      metadata: {
        sourceId: 'ai',
        arrangementCoreTitle: 'Vårcupen',
        bringItems: ['drakt'],
      },
    }
    const updates = buildTankestromIdempotentEventUpdate(existing, {
      personId: 'child-1',
      title: 'Vårcupen – fredag',
      start: '17:45',
      end: '18:45',
      notes: 'Møt 30 min før kampstart.',
      location: 'Bekkestua',
      reminderMinutes: 60,
      metadata: {
        arrangementStableKey: 'cup|vaarcupen|child-1|2026',
        bringItems: ['drakt', 'leggskytter'],
        integration: { proposalId: 'p-1' },
      },
    })
    expect(updates.title).toBe('Vårcupen – fredag')
    expect(updates.start).toBe('17:45')
    expect(updates.end).toBe('18:45')
    expect(updates.location).toBe('Bekkestua')
    expect(updates.reminderMinutes).toBe(60)

    // Notes: non-empty fallback / append (ikke substring)
    expect(typeof updates.notes).toBe('string')
    expect(updates.notes!).toContain('Husk drakt.')
    expect(updates.notes!).toContain('Møt 30 min før kampstart.')

    // Metadata: shallow merge
    const md = updates.metadata as Record<string, unknown>
    expect(md.sourceId).toBe('ai') // bevart fra eksisterende
    expect(md.arrangementCoreTitle).toBe('Vårcupen')
    // Felles nøkler: nye verdier overskriver gamle
    expect(md.bringItems).toEqual(['drakt', 'leggskytter'])
    // Nye nøkler: lagt til
    expect(md.arrangementStableKey).toBe('cup|vaarcupen|child-1|2026')
    expect(md.integration).toEqual({ proposalId: 'p-1' })
  })

  it('overskriver et nestet metadata-felt fullstendig (shallow, ikke deep)', () => {
    const existing: Event = {
      id: 'evt-2',
      personId: 'p',
      title: 't',
      start: '09:00',
      end: '10:00',
      metadata: {
        transport: { dropoffBy: 'far', pickupBy: 'mor' },
      },
    }
    const updates = buildTankestromIdempotentEventUpdate(existing, {
      personId: 'p',
      title: 't',
      start: '09:00',
      end: '10:00',
      metadata: {
        transport: { pickupBy: 'farmor' },
      },
    })
    const md = updates.metadata as { transport: Record<string, unknown> }
    // Karakteriserer dagens oppførsel: transport som helhet erstattes — `dropoffBy` forsvinner.
    expect(md.transport).toEqual({ pickupBy: 'farmor' })
    expect((md.transport as Record<string, unknown>).dropoffBy).toBeUndefined()
  })
})

describe('tankestromPersistFingerprint (idempotent path)', () => {
  it('skiller embedded child-rader på (stableKey, childIdx, date)', () => {
    const fpA = tankestromPersistFingerprint({
      date: '2026-06-12',
      start: '17:45',
      end: '18:45',
      title: 'Vårcupen – fredag',
      personId: 'child-1',
      metadata: {
        parentArrangementStableKey: 'cup|vaarcupen|child-1|2026',
        detachedEmbeddedOrigIndex: 0,
      },
    })
    const fpB = tankestromPersistFingerprint({
      date: '2026-06-13',
      start: '09:00',
      end: '10:00',
      title: 'Vårcupen – lørdag',
      personId: 'child-1',
      metadata: {
        parentArrangementStableKey: 'cup|vaarcupen|child-1|2026',
        detachedEmbeddedOrigIndex: 1,
      },
    })
    expect(fpA).not.toBe(fpB)
  })
})
