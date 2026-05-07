import { describe, expect, it } from 'vitest'
import type { PortalEventProposal, PortalProposalItem, PortalTaskProposal } from '../../features/tankestrom/types'
import type { EmbeddedScheduleSegment } from '../../types'
import {
  applyCupWeekendEmbeddedScheduleMerge,
  buildArrangementChildDisplayTitle,
  embeddedScheduleChildCalendarExportTitle,
  embeddedScheduleChildReviewDisplayTitle,
  embeddedScheduleChildTitleForReview,
  embeddedScheduleParentReviewDisplayTitle,
  getParentCoreTitle,
  normalizeArrangementChildTitle,
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
    expect(cal).toBe('Vårcupen – søndag')
    expect(cal.toLowerCase()).not.toContain('usikker')
    expect(cal.toLowerCase()).not.toContain('betinget')
    expect(cal.toLowerCase()).not.toContain('juni')
  })

  it('lager parent core title uten årstall for child-titler', () => {
    expect(getParentCoreTitle('Vårcupen 2026 – 12.–14. juni 2026')).toBe('Vårcupen')
    expect(getParentCoreTitle('Håndballcup 2026 – 4.–6. september')).toBe('Håndballcup')
  })

  it('normaliserer rotete child-title til kort ukedagstittel', () => {
    const out = normalizeArrangementChildTitle(
      'Vårcupen 2026 – 12 – søndag · Vårcupen 2026 – søndag (usikker / betinget...)',
      'Vårcupen 2026 – 12.–14. juni 2026',
      { date: '2026-06-14', title: 'x' }
    )
    expect(out).toBe('Vårcupen – søndag')
  })

  it('fjerner gjentatt «12» på tvers av helgedager (Tankestrøm-lekkasje)', () => {
    const parent = 'Vårcupen 2026 – 12.–14. juni 2026'
    const ctx = [
      'Vårcupen – 12 – fredag',
      'Vårcupen – 12 – lørdag',
      'Vårcupen – 12 – søndag',
    ].join('\n')
    expect(
      normalizeArrangementChildTitle('Vårcupen – 12 – fredag', parent, { date: '2026-06-12', title: '' }, ctx)
    ).toBe('Vårcupen – fredag')
    expect(
      normalizeArrangementChildTitle('Vårcupen – 12 – lørdag', parent, { date: '2026-06-13', title: '' }, ctx)
    ).toBe('Vårcupen – lørdag')
    expect(
      normalizeArrangementChildTitle('Vårcupen – 12 – søndag', parent, { date: '2026-06-14', title: '' }, ctx)
    ).toBe('Vårcupen – søndag')
  })

  it('auto-title er defensiv og stabil: parent + ukedag', () => {
    const parent = 'Vårcupen 2026 – 12.–14. juni 2026'
    expect(
      normalizeArrangementChildTitle('Vårcupen G12 – fredag', parent, { date: '2026-06-12', title: '' })
    ).toBe('Vårcupen – fredag')
    expect(
      normalizeArrangementChildTitle('Vårcupen Cup 2 – lørdag', parent, { date: '2026-06-13', title: '' })
    ).toBe('Vårcupen – lørdag')
  })

  it('regresjon: Tankestrøm «12 – . –»-rot i segmenttittel → kun kjerne + ukedag', () => {
    const parentTitle = 'Vårcupen 2026 – 12.–14. juni 2026'
    const blob = [
      'Vårcupen – 12 – . – Vårcupen – fredag',
      'Vårcupen – 12 – . – Vårcupen – lørdag',
      'Vårcupen – 12 – . – Vårcupen – søndag',
    ].join('\n')
    expect(
      buildArrangementChildDisplayTitle({
        parentTitle,
        segmentTitle: 'Vårcupen – 12 – . – Vårcupen – fredag',
        segmentDate: '2026-06-12',
        siblingTitlesBlob: blob,
      })
    ).toBe('Vårcupen – fredag')
    expect(
      buildArrangementChildDisplayTitle({
        parentTitle,
        segmentTitle: 'Vårcupen – 12 – . – Vårcupen – lørdag',
        segmentDate: '2026-06-13',
        siblingTitlesBlob: blob,
      })
    ).toBe('Vårcupen – lørdag')
    expect(
      buildArrangementChildDisplayTitle({
        parentTitle,
        segmentTitle: 'Vårcupen – 12 – . – Vårcupen – søndag',
        segmentDate: '2026-06-14',
        siblingTitlesBlob: blob,
      })
    ).toBe('Vårcupen – søndag')
  })

  it('fjerner kamp/runde-fragmenter fra auto-titler', () => {
    const parent = 'Serie 2026 – uke 12'
    expect(normalizeArrangementChildTitle('Kamp 2 – søndag', parent, { date: '2026-03-22', title: '' })).toBe(
      'Serie – søndag'
    )
    expect(normalizeArrangementChildTitle('Runde 3 – lørdag', parent, { date: '2026-03-21', title: '' })).toBe(
      'Serie – lørdag'
    )
  })

  it('manuell barn-tittel (userEditedTitle) bygges ikke om med parent/ukedag/dato', () => {
    const parent = 'Vårcupen 2026 – 12.–14. juni 2026'
    const seg: EmbeddedScheduleSegment = {
      date: '2026-06-12',
      title: 'Vårcupen dag 1',
      userEditedTitle: true,
      titleOverride: 'Vårcupen dag 1',
    }
    expect(embeddedScheduleChildTitleForReview(parent, seg, '')).toBe('Vårcupen dag 1')
    expect(embeddedScheduleChildCalendarExportTitle(seg, parent)).toBe('Vårcupen dag 1')
    expect(normalizeArrangementChildTitle('should-be-ignored', parent, seg)).toBe('Vårcupen dag 1')
  })

  it('uten manuell edit: auto-title normaliseres fortsatt', () => {
    const parent = 'Vårcupen 2026 – 12.–14. juni 2026'
    const seg: EmbeddedScheduleSegment = {
      date: '2026-06-12',
      title: 'Vårcupen – 12 – fredag',
    }
    expect(embeddedScheduleChildTitleForReview(parent, seg, '')).toBe('Vårcupen – fredag')
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
