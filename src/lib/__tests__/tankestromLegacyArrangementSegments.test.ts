import { describe, expect, it } from 'vitest'
import type { PortalEventProposal, PortalProposalItem } from '../../features/tankestrom/types'
import { foldLegacyArrangementChildSegments } from '../tankestromLegacyArrangementSegments'

function ev(
  proposalId: string,
  title: string,
  date: string,
  start: string,
  end: string,
  metadata?: Record<string, unknown>
): PortalEventProposal {
  return {
    proposalId,
    kind: 'event',
    sourceId: 'src',
    originalSourceType: 'uploaded_file',
    confidence: 0.9,
    event: {
      date,
      personId: '',
      title,
      start,
      end,
      metadata,
    },
  }
}

describe('foldLegacyArrangementChildSegments', () => {
  it('folds legacy child items under parent and removes child cards', () => {
    const parent = ev('p1', 'Vårcupen 2026', '2026-06-12', '00:00', '23:59', {
      isArrangementParent: true,
      arrangementStableKey: 'cup-1',
      arrangementBlockGroupId: 'grp-1',
    })
    const fri = ev('c1', 'Fredag 12. juni', '2026-06-12', '17:45', '19:00', {
      isArrangementChild: true,
      parentArrangementStableKey: 'cup-1',
      arrangementBlockGroupId: 'grp-1',
    })
    const lor = ev('c2', 'Lørdag 13. juni', '2026-06-13', '10:00', '11:30', {
      isArrangementChild: true,
      parentArrangementStableKey: 'cup-1',
      arrangementBlockGroupId: 'grp-1',
    })
    const son = ev('c3', 'Søndag 14. juni', '2026-06-14', '09:30', '11:00', {
      isArrangementChild: true,
      parentArrangementStableKey: 'cup-1',
      arrangementBlockGroupId: 'grp-1',
    })

    const out = foldLegacyArrangementChildSegments([parent, fri, lor, son] as PortalProposalItem[])
    expect(out).toHaveLength(1)
    expect(out[0]?.proposalId).toBe('p1')
    const patched = out[0] as PortalEventProposal
    const sched = Array.isArray(patched.event.metadata?.embeddedSchedule)
      ? patched.event.metadata?.embeddedSchedule
      : []
    expect(sched).toHaveLength(3)
    expect(sched.map((s: any) => s.date)).toEqual(['2026-06-12', '2026-06-13', '2026-06-14'])
    expect(patched.event.metadata?.arrangementBlockGroupId).toBe('grp-1')
  })

  it('keeps parent and uses embeddedSchedule fallback when no child items exist', () => {
    const parent = ev('p1', 'Vårcupen 2026', '2026-06-12', '00:00', '23:59', {
      isArrangementParent: true,
      embeddedSchedule: [
        { date: '2026-06-12', title: 'Fredag', start: '17:45' },
        { date: '2026-06-13', title: 'Lørdag', start: '10:00' },
        { date: '2026-06-14', title: 'Søndag', start: '09:30' },
      ],
    })
    const out = foldLegacyArrangementChildSegments([parent] as PortalProposalItem[])
    expect(out).toHaveLength(1)
    const patched = out[0] as PortalEventProposal
    expect((patched.event.metadata?.embeddedSchedule as any[])?.length).toBe(3)
  })
})
