import { describe, expect, it } from 'vitest'
import type { TankestromImportDraft } from '../../features/tankestrom/types'
import { makeEmbeddedChildProposalId } from '../../features/tankestrom/useTankestromImport'
import {
  formatTankestromImportCardValidationBanner,
  norwegianWeekdayLowercase,
  shortInlineLabelForIssue,
  summarizeEmbeddedChildrenImportValidation,
} from '../tankestromInlineValidationLabel'
import {
  collectTankestromEventExportValidationIssues,
  collectTankestromTaskExportValidationIssues,
} from '../../features/tankestrom/useTankestromImport'

describe('tankestromInlineValidationLabel', () => {
  it('viser Mangler person på enkeltkort', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'p1',
      undefined,
      {
        title: 'X',
        date: '2026-06-01',
        start: '10:00',
        end: '11:00',
        personId: '',
        location: '',
        notes: '',
        includeRecurrence: false,
        dropoffBy: '',
        pickupBy: '',
        isManualCalendarEntry: true,
      },
      new Set(['person-a'])
    )
    const line = formatTankestromImportCardValidationBanner(issues)
    expect(line).toMatch(/Mangler person/i)
    expect(line).toMatch(/Rediger/)
  })

  it('viser Mangler dato', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'p1',
      undefined,
      {
        title: 'X',
        date: '',
        start: '',
        end: '',
        personId: 'person-a',
        location: '',
        notes: '',
        includeRecurrence: false,
        dropoffBy: '',
        pickupBy: '',
        isManualCalendarEntry: true,
      },
      new Set(['person-a'])
    )
    expect(formatTankestromImportCardValidationBanner(issues)).toMatch(/Mangler dato/i)
  })

  it('viser flere felt med og og +N til', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'p1',
      undefined,
      {
        title: '',
        date: '',
        start: '',
        end: '',
        personId: '',
        location: '',
        notes: '',
        includeRecurrence: false,
        dropoffBy: '',
        pickupBy: '',
        isManualCalendarEntry: true,
      },
      new Set(['person-a'])
    )
    const line = formatTankestromImportCardValidationBanner(issues)
    expect(line).toMatch(/ og /)
    expect(line).toMatch(/\+\d+ til/)
  })

  it('ved mange felt bruker forenklet formulering', () => {
    const many = Array.from({ length: 5 }, () => ({
      code: 'missing_title' as const,
      field: 'title' as const,
      proposalId: 'p',
      title: 't',
      message: 'm',
      actionHint: 'h',
    }))
    expect(formatTankestromImportCardValidationBanner(many)).toMatch(/5 felt må rettes/)
  })

  it('gyldig kort gir ingen banner', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'p1',
      undefined,
      {
        title: 'Skolefest',
        date: '2026-06-15',
        start: '10:00',
        end: '11:00',
        personId: 'person-a',
        location: '',
        notes: '',
        includeRecurrence: false,
        dropoffBy: '',
        pickupBy: '',
        isManualCalendarEntry: true,
      },
      new Set(['person-a'])
    )
    expect(formatTankestromImportCardValidationBanner(issues)).toBeNull()
  })

  it('legger til ukedag for manglende starttid', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'c1',
      'c1',
      {
        title: 'Kamp',
        date: '2026-06-07',
        start: '',
        end: '12:00',
        personId: 'person-a',
        location: '',
        notes: '',
        includeRecurrence: false,
        dropoffBy: '',
        pickupBy: '',
        isManualCalendarEntry: true,
      },
      new Set(['person-a'])
    )
    const wd = norwegianWeekdayLowercase('2026-06-07')
    expect(wd.length).toBeGreaterThan(2)
    const label = shortInlineLabelForIssue(issues[0]!, wd)
    expect(label.toLowerCase()).toContain(wd.toLowerCase())
    expect(label).toMatch(/starttid/i)
  })

  it('oppgave: mangler tittel', () => {
    const issues = collectTankestromTaskExportValidationIssues('t1', {
      title: '',
      date: '2026-06-01',
      notes: '',
      dueTime: '',
      childPersonId: '',
      assignedToPersonId: '',
      showInMonthView: false,
      taskIntent: 'must_do',
    })
    expect(formatTankestromImportCardValidationBanner(issues)).toMatch(/Mangler tittel/i)
  })

  it('arrangement: flere barn med samme feil oppsummeres på forelder', () => {
    const parentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const c0 = makeEmbeddedChildProposalId(parentId, 0)
    const c1 = makeEmbeddedChildProposalId(parentId, 1)
    const c2 = makeEmbeddedChildProposalId(parentId, 2)
    const childEvent = {
      title: 'Dag X',
      date: '2026-06-10',
      start: '10:00',
      end: '11:00',
      personId: '',
      location: '',
      notes: '',
      includeRecurrence: false,
      dropoffBy: '',
      pickupBy: '',
      isManualCalendarEntry: true,
    }
    const drafts: Record<string, TankestromImportDraft | undefined> = {
      [c0]: { importKind: 'event', event: { ...childEvent, date: '2026-06-10' } },
      [c1]: { importKind: 'event', event: { ...childEvent, date: '2026-06-11' } },
      [c2]: { importKind: 'event', event: { ...childEvent, date: '2026-06-12' } },
    }
    const selected = new Set([c0, c1, c2])
    const summary = summarizeEmbeddedChildrenImportValidation(
      parentId,
      [{ origIndex: 0 }, { origIndex: 1 }, { origIndex: 2 }],
      selected,
      drafts,
      new Set(['person-a']),
      makeEmbeddedChildProposalId
    )
    expect(summary.parentBanner).toMatch(/Mangler person på 3 hendelser/)
    expect(summary.parentBanner).toMatch(/Rediger/)
    expect(summary.suppressPerChildDuplicateBanners).toBe(true)
  })

  it('arrangement: én barn-feil gir ingen forelder-oppsummering (per-barn-linje)', () => {
    const parentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const c0 = makeEmbeddedChildProposalId(parentId, 0)
    const childEvent = {
      title: 'Dag X',
      date: '2026-06-10',
      start: '10:00',
      end: '11:00',
      personId: '',
      location: '',
      notes: '',
      includeRecurrence: false,
      dropoffBy: '',
      pickupBy: '',
      isManualCalendarEntry: true,
    }
    const drafts: Record<string, TankestromImportDraft | undefined> = {
      [c0]: { importKind: 'event', event: childEvent },
    }
    const summary = summarizeEmbeddedChildrenImportValidation(
      parentId,
      [{ origIndex: 0 }],
      new Set([c0]),
      drafts,
      new Set(['person-a']),
      makeEmbeddedChildProposalId
    )
    expect(summary.parentBanner).toBeNull()
    expect(summary.suppressPerChildDuplicateBanners).toBe(false)
  })
})
