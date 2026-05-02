import { describe, expect, it } from 'vitest'
import type { PortalProposalItem } from '../../features/tankestrom/types'
import { dedupeNearDuplicateCalendarProposals, semanticTitleCore } from '../tankestromImportDedupe'

describe('semanticTitleCore', () => {
  it('fjerner dato-prefiks og Notater:/Frister:', () => {
    const a = 'fredag 12. juni 2026 – Det trengs to voksne som kan hjelpe med kiosk'
    const b = 'fredag 12. juni 2026 – Notater: Det trengs to voksne som kan hjelpe med kiosk'
    expect(semanticTitleCore(a)).toBe(semanticTitleCore(b))
    expect(semanticTitleCore(b)).toContain('kiosk')
  })

  it('fjerner Frister: foran Spond-tekst', () => {
    const a = 'lørdag 13. juni 2026 – Svar i Spond senest mandag 8'
    const b = 'lørdag 13. juni 2026 – Frister: Svar i Spond senest mandag 8'
    expect(semanticTitleCore(a)).toBe(semanticTitleCore(b))
  })
})

describe('dedupeNearDuplicateCalendarProposals', () => {
  it('fjerner like hendelser med samme tittel uansett ukedag-prefiks', () => {
    const base = {
      proposalId: 'a1111111-1111-4111-8111-111111111111',
      kind: 'event' as const,
      sourceId: 'x',
      originalSourceType: 'text',
      confidence: 0.9,
      event: {
        date: '2026-05-15',
        personId: 'p1',
        title: 'fredag – Foreldre hjelp trengs til samlingspunkt og utstyr',
        start: '18:00',
        end: '19:00',
        notes: 'Fra: text\n\nTa med kopp',
      },
    }
    const dup: PortalProposalItem = {
      ...base,
      proposalId: 'b2222222-2222-4222-8222-222222222222',
      confidence: 0.8,
      event: {
        ...base.event,
        title: 'Foreldre hjelp trengs til samlingspunkt og utstyr',
        notes: 'Fra: text\n\nTa med kopp',
      },
    }
    const out = dedupeNearDuplicateCalendarProposals([base, dup])
    expect(out).toHaveLength(1)
    expect(out[0]!.proposalId).toBe(base.proposalId)
  })

  it('beholder to hendelser når starttid er forskjellig', () => {
    const a: PortalProposalItem = {
      proposalId: 'a1111111-1111-4111-8111-111111111111',
      kind: 'event',
      sourceId: 'x',
      originalSourceType: 'text',
      confidence: 0.9,
      event: {
        date: '2026-05-15',
        personId: 'p1',
        title: 'Cup',
        start: '10:00',
        end: '11:00',
      },
    }
    const b: PortalProposalItem = {
      ...a,
      proposalId: 'b2222222-2222-4222-8222-222222222222',
      event: { ...a.event, start: '14:00', end: '15:00' },
    }
    expect(dedupeNearDuplicateCalendarProposals([a, b])).toHaveLength(2)
  })

  it('fjerner semantiske duplikater samme dag (Notater: / lang dato i tittel)', () => {
    const base: PortalProposalItem = {
      proposalId: 'a1111111-1111-4111-8111-111111111111',
      kind: 'task',
      sourceId: 'x',
      originalSourceType: 'text',
      confidence: 0.92,
      task: {
        date: '2026-06-12',
        title: 'fredag 12. juni 2026 – Det trengs to voksne som kan hjelpe med kiosk',
        notes: '',
        childPersonId: 'c1',
        assignedToPersonId: '',
        dueTime: '',
      },
    }
    const dup: PortalProposalItem = {
      ...base,
      proposalId: 'b2222222-2222-4222-8222-222222222222',
      confidence: 0.88,
      task: {
        ...base.task,
        title: 'fredag 12. juni 2026 – Notater: Det trengs to voksne som kan hjelpe med kiosk',
      },
    }
    const out = dedupeNearDuplicateCalendarProposals([base, dup])
    expect(out).toHaveLength(1)
    expect(out[0]!.proposalId).toBe(base.proposalId)
  })

  it('fjerner semantiske duplikater samme dag (Frister: / Svar i Spond)', () => {
    const base: PortalProposalItem = {
      proposalId: 'a1111111-1111-4111-8111-111111111111',
      kind: 'task',
      sourceId: 'x',
      originalSourceType: 'text',
      confidence: 0.9,
      task: {
        date: '2026-06-13',
        title: 'lørdag 13. juni 2026 – Svar i Spond senest mandag 8',
        notes: '',
        childPersonId: 'c1',
        assignedToPersonId: '',
        dueTime: '',
      },
    }
    const dup: PortalProposalItem = {
      ...base,
      proposalId: 'b2222222-2222-4222-8222-222222222222',
      task: {
        ...base.task,
        title: 'lørdag 13. juni 2026 – Frister: Svar i Spond senest mandag 8',
      },
    }
    const out = dedupeNearDuplicateCalendarProposals([base, dup])
    expect(out).toHaveLength(1)
  })

  it('slår sammen samme foreldreoppgave på fredag og lørdag (cup-helg)', () => {
    const t: PortalProposalItem = {
      proposalId: 'a1111111-1111-4111-8111-111111111111',
      kind: 'task',
      sourceId: 'x',
      originalSourceType: 'text',
      confidence: 0.9,
      task: {
        date: '2026-06-12',
        title: 'Gi beskjed hvis barnet bruker medisiner trenerne bør vite om',
        notes: '',
        childPersonId: 'c1',
        assignedToPersonId: '',
        dueTime: '',
      },
    }
    const t2: PortalProposalItem = {
      ...t,
      proposalId: 'b2222222-2222-4222-8222-222222222222',
      confidence: 0.85,
      task: { ...t.task, date: '2026-06-13' },
    }
    const out = dedupeNearDuplicateCalendarProposals([t, t2])
    expect(out).toHaveLength(1)
    if (out[0]!.kind === 'task') {
      expect(out[0].task.date).toBe('2026-06-12')
    }
  })

  it('beholder to oppgaver når én dag er torsdag (ikke cup-helg)', () => {
    const t: PortalProposalItem = {
      proposalId: 'a1111111-1111-4111-8111-111111111111',
      kind: 'task',
      sourceId: 'x',
      originalSourceType: 'text',
      confidence: 0.9,
      task: {
        date: '2026-06-11',
        title: 'Gi beskjed hvis barnet bruker medisiner trenerne bør vite om',
        notes: '',
        childPersonId: 'c1',
        assignedToPersonId: '',
        dueTime: '',
      },
    }
    const t2: PortalProposalItem = {
      ...t,
      proposalId: 'b2222222-2222-4222-8222-222222222222',
      task: { ...t.task, date: '2026-06-12' },
    }
    expect(dedupeNearDuplicateCalendarProposals([t, t2])).toHaveLength(2)
  })
})
