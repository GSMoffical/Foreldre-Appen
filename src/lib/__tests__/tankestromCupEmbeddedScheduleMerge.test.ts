import { describe, expect, it } from 'vitest'
import type { PortalEventProposal, PortalProposalItem, PortalTaskProposal } from '../../features/tankestrom/types'
import {
  applyCupWeekendEmbeddedScheduleMerge,
  embeddedScheduleChildCalendarExportTitle,
  embeddedScheduleChildReviewDisplayTitle,
  embeddedScheduleParentReviewDisplayTitle,
  normalizeEmbeddedScheduleParentDisplayTitle,
} from '../tankestromCupEmbeddedScheduleMerge'

function ev(
  id: string,
  date: string,
  title: string,
  start: string,
  end: string,
  personId = 'child-1'
): PortalEventProposal {
  return {
    proposalId: id,
    kind: 'event',
    sourceId: 'src',
    originalSourceType: 'text',
    confidence: 0.9,
    event: { date, personId, title, start, end, notes: '' },
  }
}

function task(id: string, date: string, title: string): PortalTaskProposal {
  return {
    proposalId: id,
    kind: 'task',
    sourceId: 'src',
    originalSourceType: 'text',
    confidence: 0.85,
    task: { date, title, notes: '', childPersonId: 'child-1', assignedToPersonId: '', dueTime: '' },
  }
}

describe('normalizeEmbeddedScheduleParentDisplayTitle', () => {
  it('fjerner «informasjon for helgen» og ukedag fra parent-tittel', () => {
    const { title, wasDayLikeTitle } = normalizeEmbeddedScheduleParentDisplayTitle(
      'Vårcupen 2026 – informasjon for helgen – fredag'
    )
    expect(wasDayLikeTitle).toBe(true)
    expect(title.toLowerCase()).toContain('vårcupen')
    expect(title).not.toMatch(/fredag/i)
    expect(title.toLowerCase()).not.toContain('informasjon for helgen')
  })

  it('fjerner flerdagers datointervall-påsats fra parent-tittel (container)', () => {
    const { title, wasDayLikeTitle } = normalizeEmbeddedScheduleParentDisplayTitle(
      'Vårcupen 2026 – fredag 12. juni 2026 – søndag 14. juni 2026'
    )
    expect(wasDayLikeTitle).toBe(true)
    expect(title.trim()).toBe('Vårcupen 2026')
    expect(title).not.toMatch(/juni|søndag|fredag/i)
  })

  it('fjerner «samlet info for helgen» og datointervall fra parent (kalenderkjerne)', () => {
    const { title, wasDayLikeTitle } = normalizeEmbeddedScheduleParentDisplayTitle(
      'Vårcupen 2026 – samlet info for helgen – 12.–14. juni 2026'
    )
    expect(wasDayLikeTitle).toBe(true)
    expect(title.trim()).toBe('Vårcupen 2026')
    expect(title.toLowerCase()).not.toContain('samlet')
  })

  it('fjerner review-suffiks « · …» før dag-påsats (unngår hybrid «…– fredag · Fredag og lørdag»)', () => {
    const { title, wasDayLikeTitle } = normalizeEmbeddedScheduleParentDisplayTitle(
      'Vårcupen – fredag · Fredag og lørdag'
    )
    expect(wasDayLikeTitle).toBe(true)
    expect(title.toLowerCase()).toContain('vårcupen')
    expect(title.toLowerCase()).not.toContain('fredag')
    expect(title).not.toMatch(/·/)
  })

  it('review parent: valgfri kort datolinje ved flere dager', () => {
    const line = embeddedScheduleParentReviewDisplayTitle('Vårcupen 2026', '2026-06-12', '2026-06-14')
    expect(line.startsWith('Vårcupen 2026 ·')).toBe(true)
    expect(line).toMatch(/juni/i)
  })

  it('child review/eksport: kort tittel med ukedag, uten «samlet info»', () => {
    const review = embeddedScheduleChildReviewDisplayTitle(
      'Vårcupen 2026',
      'Vårcupen 2026 – samlet info for helgen',
      '2026-06-12'
    )
    expect(review.toLowerCase()).toContain('fredag')
    expect(review.toLowerCase()).not.toContain('samlet info')
    const cal = embeddedScheduleChildCalendarExportTitle(
      { date: '2026-06-12', title: 'Vårcupen 2026 – samlet info for helgen' },
      'Vårcupen 2026 – samlet info for helgen'
    )
    expect(cal.toLowerCase()).not.toContain('samlet info')
    expect(cal.toLowerCase()).toContain('fredag')
  })

  it('child eksport: fjerner dato/status i segmenttittel defensivt', () => {
    const cal = embeddedScheduleChildCalendarExportTitle(
      {
        date: '2026-06-14',
        start: '09:20',
        end: '10:40',
        title: 'Vårcupen 2026 – søndag · Søndag 14. juni 2026 (usikker / betinget)',
      },
      'Vårcupen 2026'
    )
    expect(cal).toBe('Vårcupen 2026 – søndag')
    expect(cal.toLowerCase()).not.toContain('usikker')
    expect(cal.toLowerCase()).not.toContain('betinget')
    expect(cal.toLowerCase()).not.toContain('juni')
  })
})

describe('applyCupWeekendEmbeddedScheduleMerge', () => {
  it('slår sammen tre helge-eventer med cup-signal til ett parent med embeddedSchedule', () => {
    const items: PortalProposalItem[] = [
      ev('e1', '2026-06-12', 'Vårcupen 2026 — oppmøte', '17:45', '18:15'),
      ev('e2', '2026-06-12', 'Kamp', '18:40', '20:00'),
      ev('e3', '2026-06-13', 'Kamp', '09:20', '10:30'),
      task('t1', '2026-06-10', 'Svar i Spond senest mandag'),
    ]
    const out = applyCupWeekendEmbeddedScheduleMerge(items, { sourceText: 'Velkommen til cup' })
    const events = out.filter((i): i is PortalEventProposal => i.kind === 'event')
    const tasksOut = out.filter((i): i is PortalTaskProposal => i.kind === 'task')
    expect(events).toHaveLength(1)
    expect(tasksOut).toHaveLength(1)
    const parent = events[0]!
    expect(parent.event.title).toContain('Vårcupen')
    expect(parent.event.metadata?.isAllDay).toBe(true)
    expect(parent.event.metadata?.endDate).toBe('2026-06-13')
    const sched = parent.event.metadata?.embeddedSchedule as { length: number } | undefined
    expect(sched?.length).toBe(3)
  })

  it('gjør ingenting uten cup/turnering-signal', () => {
    const items: PortalProposalItem[] = [
      ev('e1', '2026-06-12', 'Trening', '17:45', '18:15'),
      ev('e2', '2026-06-13', 'Trening', '09:20', '10:30'),
      ev('e3', '2026-06-14', 'Trening', '10:00', '11:00'),
    ]
    const out = applyCupWeekendEmbeddedScheduleMerge(items)
    expect(out.filter((i) => i.kind === 'event')).toHaveLength(3)
  })

  it('gjør ingenting for ukedag-eventer (ikke fre–søn)', () => {
    const items: PortalProposalItem[] = [
      ev('e1', '2026-06-10', 'Cup møte', '17:00', '18:00'),
      ev('e2', '2026-06-11', 'Cup kamp', '17:00', '18:00'),
      ev('e3', '2026-06-12', 'Cup kamp', '17:00', '18:00'),
    ]
    const out = applyCupWeekendEmbeddedScheduleMerge(items, { sourceText: 'turnering' })
    expect(out.filter((i) => i.kind === 'event')).toHaveLength(3)
  })

  it('markerer betinget segment fra tekst', () => {
    const items: PortalProposalItem[] = [
      ev('e1', '2026-06-12', 'Vårcup', '10:00', '11:00'),
      ev('e2', '2026-06-13', 'Kamp', '09:00', '10:00'),
      ev('e3', '2026-06-14', 'Eventuell sluttspillkamp', '11:00', '12:00'),
    ]
    const out = applyCupWeekendEmbeddedScheduleMerge(items)
    const parent = out.find((i): i is PortalEventProposal => i.kind === 'event')!
    const sched = parent.event.metadata?.embeddedSchedule as Array<{ isConditional?: boolean; title: string }>
    expect(sched.some((s) => s.isConditional)).toBe(true)
  })
})
