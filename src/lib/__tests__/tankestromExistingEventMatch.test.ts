import { describe, expect, it } from 'vitest'
import type { Event } from '../../types'
import type { PortalEventProposal } from '../../features/tankestrom/types'
import { findConservativeExistingEventMatch } from '../tankestromExistingEventMatch'

function baseProposal(overrides: Partial<PortalEventProposal['event']> = {}): PortalEventProposal {
  return {
    proposalId: '11111111-1111-4111-8111-111111111111',
    kind: 'event',
    sourceId: 'src',
    originalSourceType: 'text',
    confidence: 0.9,
    event: {
      date: '2026-06-01',
      personId: 'child-1',
      title: 'Håndballcup',
      start: '00:00',
      end: '23:59',
      notes: '',
      location: 'Haugenhallen',
      metadata: { endDate: '2026-06-02', isAllDay: true },
      ...overrides,
    },
  }
}

describe('findConservativeExistingEventMatch', () => {
  it('returnerer kandidat når tittel, dato, person og sted stemmer godt nok (container + multi-day)', () => {
    const proposal = baseProposal()
    const existing: Event = {
      id: 'evt-existing',
      personId: 'child-1',
      title: 'Håndballcup helg',
      start: '00:00',
      end: '23:59',
      notes: 'Gammel',
      location: 'Haugenhallen',
      metadata: {
        isAllDay: true,
        endDate: '2026-06-02',
        embeddedSchedule: [{ date: '2026-06-01', title: 'Åpning' }],
      },
    }
    const r = findConservativeExistingEventMatch(
      proposal,
      proposal.event.title,
      '2026-06-01',
      '2026-06-02',
      'child-1',
      [{ event: existing, anchorDate: '2026-06-01' }]
    )
    expect(r.rejected).toBe(false)
    expect(r.candidate?.event.id).toBe('evt-existing')
    expect(r.score).toBeGreaterThanOrEqual(78)
  })

  it('avviser ved for svak tittel selv med overlapp', () => {
    const proposal = baseProposal({ title: 'Totalt annet arrangement', location: 'Haugenhallen' })
    const existing: Event = {
      id: 'evt-existing',
      personId: 'child-1',
      title: 'Håndballcup helg',
      start: '00:00',
      end: '23:59',
      location: 'Haugenhallen',
      metadata: { isAllDay: true, endDate: '2026-06-02' },
    }
    const r = findConservativeExistingEventMatch(
      proposal,
      proposal.event.title,
      '2026-06-01',
      '2026-06-02',
      'child-1',
      [{ event: existing, anchorDate: '2026-06-01' }]
    )
    expect(r.rejected).toBe(true)
    expect(r.candidate).toBeNull()
  })

  it('avviser import som ikke er container-lik (ingen flerdagers/endDate-skille, ikke programforelder)', () => {
    const proposal: PortalEventProposal = {
      proposalId: '11111111-1111-4111-8111-111111111111',
      kind: 'event',
      sourceId: 'src',
      originalSourceType: 'text',
      confidence: 0.9,
      event: {
        date: '2026-06-01',
        personId: 'child-1',
        title: 'Håndballcup',
        start: '10:00',
        end: '11:00',
        notes: '',
        location: 'Haugenhallen',
        metadata: {},
      },
    }
    const existing: Event = {
      id: 'evt-existing',
      personId: 'child-1',
      title: 'Håndballcup',
      start: '00:00',
      end: '23:59',
      metadata: { isAllDay: true, endDate: '2026-06-02' },
    }
    const r = findConservativeExistingEventMatch(
      proposal,
      proposal.event.title,
      '2026-06-01',
      '2026-06-01',
      'child-1',
      [{ event: existing, anchorDate: '2026-06-01' }]
    )
    expect(r.rejectReason).toBe('import_not_container')
  })
})
