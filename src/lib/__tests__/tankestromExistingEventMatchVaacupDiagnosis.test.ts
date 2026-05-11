/**
 * Diagnose for «Vårcupen-oppfølgingsimport viser ikke samsvar»:
 * disse testene kartlegger datakilden og matcher-gates (tom anchored liste,
 * stableKey parent vs dag-rad, person nøytral).
 *
 * Etter fix: test 2 forventer treff når dag-rad har annen stableKey men er cluster-rad
 * og tittel/dato ellers stemmer — se `stableKeyMismatchAllowedForClusterDayRow` i trace.
 */
import { describe, expect, it } from 'vitest'
import type { Event } from '../../types'
import type { PortalEventProposal } from '../../features/tankestrom/types'
import { findConservativeExistingEventMatch } from '../tankestromExistingEventMatch'

/** Typisk programforelder: tre datoer i embeddedSchedule (distinctScheduleDates >= 2). */
function vaacupParentProposal(opts: {
  importStableKey?: string
  importPersonId?: string
}): PortalEventProposal {
  const { importStableKey = 'import-parent-stable-key-2026', importPersonId = '' } = opts
  return {
    proposalId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    kind: 'event',
    sourceId: 'src',
    originalSourceType: 'text',
    confidence: 0.9,
    event: {
      date: '2026-06-12',
      personId: importPersonId,
      title: 'Vårcupen 2026 på Ekeberg · 12.–14. juni 2026',
      start: '00:00',
      end: '23:59',
      notes: '',
      location: '',
      metadata: {
        endDate: '2026-06-14',
        isAllDay: true,
        multiDayAllDay: true,
        arrangementStableKey: importStableKey,
        embeddedSchedule: [
          { date: '2026-06-12', title: 'Fredag' },
          { date: '2026-06-13', title: 'Lørdag' },
          { date: '2026-06-14', title: 'Søndag' },
        ],
      },
    },
  }
}

const existingFridayClusterRow: Event = {
  id: 'evt-existing-friday',
  personId: 'child-1',
  title: 'Vårcupen – fredag',
  start: '17:45',
  end: '20:00',
  notes: 'Eksisterende kalenderinfo',
  metadata: {
    arrangementStableKey: 'embed-export-child-stable-key-friday',
  },
}

describe('Diagnose: Vårcup-lignende oppfølgingsimport vs eksisterende dag-rad', () => {
  it('1. Tom anchoredExisting → ingen kandidat (UI: ingen match hvis kalender ikke lastet inn)', () => {
    const proposal = vaacupParentProposal({})
    const r = findConservativeExistingEventMatch(
      proposal,
      proposal.event.title,
      '2026-06-12',
      '2026-06-14',
      '',
      []
    )
    expect(r.rejected).toBe(true)
    expect(r.candidate).toBeNull()
    expect(r.rejectReason).toBe('no_candidate')
    expect(r.importMatchTrace?.anchoredInputCount).toBe(0)
  })

  it('2. Ulik arrangementStableKey på import vs dag-rad → heuristikk får kjøre; treff + trace når tittel/dato ellers stemmer', () => {
    const proposal = vaacupParentProposal({ importStableKey: 'import-parent-stable-key-2026' })
    const r = findConservativeExistingEventMatch(
      proposal,
      proposal.event.title,
      '2026-06-12',
      '2026-06-14',
      '',
      [{ event: existingFridayClusterRow, anchorDate: '2026-06-12' }]
    )
    expect(r.rejected).toBe(false)
    expect(r.candidate?.event.id).toBe(existingFridayClusterRow.id)
    expect(r.importMatchTrace?.stableKeyMismatchAllowedForClusterDayRow).toBe(true)
    expect(r.importMatchTrace?.diagnosticRowCount).toBeGreaterThan(0)
  })

  it('3. Kontroll: samme oppsett uten stableKey på eksisterende → treff (ikke personId som stopper)', () => {
    const proposal = vaacupParentProposal({ importStableKey: 'import-parent-stable-key-2026' })
    const existingNoKey: Event = { ...existingFridayClusterRow, metadata: {} }
    const r = findConservativeExistingEventMatch(
      proposal,
      proposal.event.title,
      '2026-06-12',
      '2026-06-14',
      '',
      [{ event: existingNoKey, anchorDate: '2026-06-12' }]
    )
    expect(r.rejected).toBe(false)
    expect(r.candidate?.event.id).toBe(existingNoKey.id)
    expect(r.defaultAction).toBe('update')
  })

  it('4. Kontroll: import uten arrangementStableKey, eksisterende med gammel dag-nøkkel → treff (nøkkelkonflikt unngås)', () => {
    // Tom streng → readArrangementStableKey gir undefined (samme som manglende nøkkel).
    const proposal = vaacupParentProposal({ importStableKey: '' })
    const r = findConservativeExistingEventMatch(
      proposal,
      proposal.event.title,
      '2026-06-12',
      '2026-06-14',
      '',
      [{ event: existingFridayClusterRow, anchorDate: '2026-06-12' }]
    )
    expect(r.rejected).toBe(false)
    expect(r.candidate?.event.id).toBe(existingFridayClusterRow.id)
  })

  it('5. Manglende personId på import er ikke i seg selv en avvisning når eksisterende har person', () => {
    const proposal = vaacupParentProposal({ importStableKey: 'x', importPersonId: '' })
    const existingNoKey: Event = { ...existingFridayClusterRow, metadata: {} }
    const r = findConservativeExistingEventMatch(
      proposal,
      proposal.event.title,
      '2026-06-12',
      '2026-06-14',
      '',
      [{ event: existingNoKey, anchorDate: '2026-06-12' }]
    )
    expect(r.rejected).toBe(false)
    expect(r.candidate?.event.personId).toBe('child-1')
  })
})
