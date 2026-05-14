import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  parsePortalImportProposalBundle,
} from '../../../lib/tankestromApi'
import {
  flattenEmbeddedScheduleOrdered,
} from '../../../lib/embeddedSchedule'
import {
  makeEmbeddedChildProposalId,
  validateTankestromDraft,
  getTankestromDraftFieldErrors,
  collectTankestromEventExportValidationIssues,
  buildEmbeddedChildStructuredScheduleDetailsForReview,
  initialSelectedIdsForGeneralImport,
} from '../useTankestromImport'
import {
  normalizeEmbeddedScheduleParentDisplayTitle,
  embeddedScheduleChildTitleForReview,
} from '../../../lib/tankestromCupEmbeddedScheduleMerge'
import type { TankestromEventDraft, TankestromImportDraft } from '../types'

const VAACUP_FIXTURE = join(process.cwd(), 'fixtures/tankestrom/vaacup_original.analyze.json')
const fixtureJson = JSON.parse(readFileSync(VAACUP_FIXTURE, 'utf8'))
const bundle = parsePortalImportProposalBundle(fixtureJson)

const parentItem = bundle.items[0]!
const parentMeta = parentItem.kind === 'event' ? parentItem.event.metadata : undefined
const segments = flattenEmbeddedScheduleOrdered(parentMeta)
const fridaySeg = segments.find((s) => s.date === '2026-06-12')!
const saturdaySeg = segments.find((s) => s.date === '2026-06-13')!
const sundaySeg = segments.find((s) => s.date === '2026-06-14')!

const parentCard = normalizeEmbeddedScheduleParentDisplayTitle(
  parentItem.kind === 'event' ? parentItem.event.title.trim() : ''
).title

const validPersonIds = new Set(['person-a'])

function mockParentDraft(): TankestromEventDraft {
  return {
    title: 'Vårcupen 2026',
    date: '2026-06-12',
    start: '00:00',
    end: '23:59',
    personId: 'person-a',
    location: '',
    notes: '',
    includeRecurrence: false,
    dropoffBy: '',
    pickupBy: '',
  }
}

function makeParentImportDraft(): TankestromImportDraft {
  return {
    importKind: 'event',
    event: mockParentDraft(),
  }
}

describe('Vårcup lørdag display time', () => {
  it('lørdag har highlights med 08:35 som tidligste tid', () => {
    const childId = makeEmbeddedChildProposalId(parentItem.proposalId, 1)
    const displayTitle = embeddedScheduleChildTitleForReview(parentCard, saturdaySeg)
    const structured = buildEmbeddedChildStructuredScheduleDetailsForReview(
      saturdaySeg, parentCard, displayTitle, childId
    )
    const times = structured.highlights.map((h) => h.time).sort()
    expect(times[0]).toBe('08:35')
  })

  it('lørdag segment.start er 08:35 (ikke 17:45)', () => {
    expect(saturdaySeg.start).toBe('08:35')
  })

  it('lørdag har ingen 17:45 i sine egne highlights', () => {
    const highlights = saturdaySeg.tankestromHighlights ?? []
    const has1745 = highlights.some((h: { time?: string }) => h?.time === '17:45')
    expect(has1745).toBe(false)
  })

  it('lørdag display time rule: tidligste highlight (08:35) har prioritet over derivert tid', () => {
    const highlights = Array.isArray(saturdaySeg.tankestromHighlights)
      ? saturdaySeg.tankestromHighlights.filter(
          (h: { time?: string }) => h?.time && /^([01]\d|2[0-3]):[0-5]\d$/.test(h.time)
        )
      : []
    const earliestHighlight = highlights.map((h: { time: string }) => h.time).sort()[0]
    expect(earliestHighlight).toBe('08:35')
  })

  it('fredag 17:45 lekker ikke til lørdag highlights', () => {
    const childId = makeEmbeddedChildProposalId(parentItem.proposalId, 1)
    const displayTitle = embeddedScheduleChildTitleForReview(parentCard, saturdaySeg)
    const structured = buildEmbeddedChildStructuredScheduleDetailsForReview(
      saturdaySeg, parentCard, displayTitle, childId
    )
    const has1745 = structured.highlights.some((h) => h.time === '17:45')
    expect(has1745).toBe(false)
  })
})

describe('Vårcup søndag (foreløpig dag)', () => {
  it('søndag er isConditional', () => {
    expect(sundaySeg.isConditional).toBe(true)
  })

  it('søndag har ingen start/end', () => {
    expect(sundaySeg.start).toBeUndefined()
    expect(sundaySeg.end).toBeUndefined()
  })

  it('søndag date-only draft passerer validation (ingen "Mangler sluttid")', () => {
    const draft: TankestromEventDraft = {
      ...mockParentDraft(),
      date: '2026-06-14',
      title: 'Vårcupen – søndag',
      start: '',
      end: '',
    }
    expect(validateTankestromDraft(draft, validPersonIds)).toBeNull()
  })

  it('søndag date-only draft har ingen field errors for start/end', () => {
    const draft: TankestromEventDraft = {
      ...mockParentDraft(),
      date: '2026-06-14',
      title: 'Vårcupen – søndag',
      start: '',
      end: '',
    }
    const errs = getTankestromDraftFieldErrors(draft, validPersonIds)
    expect(errs.end).toBeUndefined()
    expect(errs.start).toBeUndefined()
  })

  it('søndag date-only har ingen missing_end_time export issues', () => {
    const draft: TankestromEventDraft = {
      ...mockParentDraft(),
      date: '2026-06-14',
      title: 'Vårcupen – søndag',
      start: '',
      end: '',
    }
    const issues = collectTankestromEventExportValidationIssues(
      'sun-id', 'sun-child', draft, validPersonIds
    )
    expect(issues.some((i) => i.code === 'missing_end_time')).toBe(false)
  })

  it('søndag notes har ingen duplikater', () => {
    const childId = makeEmbeddedChildProposalId(parentItem.proposalId, 2)
    const displayTitle = embeddedScheduleChildTitleForReview(parentCard, sundaySeg)
    const structured = buildEmbeddedChildStructuredScheduleDetailsForReview(
      sundaySeg, parentCard, displayTitle, childId
    )
    const lowerNotes = structured.notes.map((n) => n.toLowerCase().trim())
    const unique = new Set(lowerNotes)
    expect(unique.size).toBe(lowerNotes.length)
  })

  it('søndag har ingen 17:45/18:40 lekkasje i highlights', () => {
    const childId = makeEmbeddedChildProposalId(parentItem.proposalId, 2)
    const displayTitle = embeddedScheduleChildTitleForReview(parentCard, sundaySeg)
    const structured = buildEmbeddedChildStructuredScheduleDetailsForReview(
      sundaySeg, parentCard, displayTitle, childId
    )
    const leaked = structured.highlights.filter(
      (h) => h.time === '17:45' || h.time === '18:40'
    )
    expect(leaked).toHaveLength(0)
  })
})

describe('initialSelectedIdsForGeneralImport — foreløpig dag ekskluderes', () => {
  it('conditional søndag uten tid er ikke i selectedIds', () => {
    const drafts: Record<string, TankestromImportDraft> = {
      [parentItem.proposalId]: makeParentImportDraft(),
    }
    const people = [{ id: 'person-a', name: 'Test', memberKind: 'child' as const }]
    const selected = initialSelectedIdsForGeneralImport(
      bundle.items, drafts, people as any, 'person-a'
    )
    const sundayChildId = makeEmbeddedChildProposalId(parentItem.proposalId, 2)
    expect(selected.has(sundayChildId)).toBe(false)
  })

  it('confirmed fredag og lørdag er i selectedIds', () => {
    const drafts: Record<string, TankestromImportDraft> = {
      [parentItem.proposalId]: makeParentImportDraft(),
    }
    const people = [{ id: 'person-a', name: 'Test', memberKind: 'child' as const }]
    const selected = initialSelectedIdsForGeneralImport(
      bundle.items, drafts, people as any, 'person-a'
    )
    const fridayChildId = makeEmbeddedChildProposalId(parentItem.proposalId, 0)
    const saturdayChildId = makeEmbeddedChildProposalId(parentItem.proposalId, 1)
    expect(selected.has(fridayChildId)).toBe(true)
    expect(selected.has(saturdayChildId)).toBe(true)
  })

  it('import count = 2 hendelser (ikke 3) for Vårcup', () => {
    const drafts: Record<string, TankestromImportDraft> = {
      [parentItem.proposalId]: makeParentImportDraft(),
    }
    const people = [{ id: 'person-a', name: 'Test', memberKind: 'child' as const }]
    const selected = initialSelectedIdsForGeneralImport(
      bundle.items, drafts, people as any, 'person-a'
    )
    const childIds = segments.map((_, i) =>
      makeEmbeddedChildProposalId(parentItem.proposalId, i)
    )
    const selectedChildren = childIds.filter((id) => selected.has(id))
    expect(selectedChildren).toHaveLength(2)
  })

  it('ny analyse gir samme selection (ingen stale state)', () => {
    const drafts: Record<string, TankestromImportDraft> = {
      [parentItem.proposalId]: makeParentImportDraft(),
    }
    const people = [{ id: 'person-a', name: 'Test', memberKind: 'child' as const }]

    const sel1 = initialSelectedIdsForGeneralImport(bundle.items, drafts, people as any, 'person-a')
    const sel2 = initialSelectedIdsForGeneralImport(bundle.items, drafts, people as any, 'person-a')

    const sundayChildId = makeEmbeddedChildProposalId(parentItem.proposalId, 2)
    expect(sel1.has(sundayChildId)).toBe(false)
    expect(sel2.has(sundayChildId)).toBe(false)
    expect([...sel1]).toEqual([...sel2])
  })
})

describe('Vårcup fredag/lørdag (confirmed dager)', () => {
  it('fredag passerer validation med tider', () => {
    const draft: TankestromEventDraft = {
      ...mockParentDraft(),
      date: '2026-06-12',
      title: 'Vårcupen – fredag',
      start: '17:45',
      end: '19:00',
    }
    expect(validateTankestromDraft(draft, validPersonIds)).toBeNull()
  })

  it('lørdag passerer validation med tider', () => {
    const draft: TankestromEventDraft = {
      ...mockParentDraft(),
      date: '2026-06-13',
      title: 'Vårcupen – lørdag',
      start: '08:35',
      end: '16:00',
    }
    expect(validateTankestromDraft(draft, validPersonIds)).toBeNull()
  })

  it('fredag har 17:45 Oppmøte og 18:40 Første kamp highlights', () => {
    const childId = makeEmbeddedChildProposalId(parentItem.proposalId, 0)
    const displayTitle = embeddedScheduleChildTitleForReview(parentCard, fridaySeg)
    const structured = buildEmbeddedChildStructuredScheduleDetailsForReview(
      fridaySeg, parentCard, displayTitle, childId
    )
    const times = structured.highlights.map((h) => h.time)
    expect(times).toContain('17:45')
    expect(times).toContain('18:40')
  })

  it('confirmed fredag/lørdag blokkeres ikke av foreløpig søndag', () => {
    const fridayDraft: TankestromEventDraft = {
      ...mockParentDraft(),
      date: '2026-06-12',
      title: 'Vårcupen – fredag',
      start: '17:45',
      end: '19:00',
    }
    const saturdayDraft: TankestromEventDraft = {
      ...mockParentDraft(),
      date: '2026-06-13',
      title: 'Vårcupen – lørdag',
      start: '08:35',
      end: '16:00',
    }
    expect(validateTankestromDraft(fridayDraft, validPersonIds)).toBeNull()
    expect(validateTankestromDraft(saturdayDraft, validPersonIds)).toBeNull()
  })
})
