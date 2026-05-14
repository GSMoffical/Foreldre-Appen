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
} from '../useTankestromImport'
import {
  normalizeEmbeddedScheduleParentDisplayTitle,
  embeddedScheduleChildTitleForReview,
} from '../../../lib/tankestromCupEmbeddedScheduleMerge'
import type { TankestromEventDraft } from '../types'

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
    const err = validateTankestromDraft(draft, validPersonIds)
    expect(err).toBeNull()
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

  it('søndag er ikke forhåndsvalgt som kalenderhendelse uten confirmed tid', () => {
    expect(sundaySeg.isConditional).toBe(true)
    expect((sundaySeg.start ?? '').trim()).toBe('')
    expect((sundaySeg.end ?? '').trim()).toBe('')
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

  it('fredag er ikke isConditional', () => {
    expect(fridaySeg.isConditional).toBeUndefined()
  })

  it('lørdag er ikke isConditional', () => {
    expect(saturdaySeg.isConditional).toBeUndefined()
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
