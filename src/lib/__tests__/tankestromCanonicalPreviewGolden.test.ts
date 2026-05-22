import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { TankestromImportDraft } from '../../features/tankestrom/types'
import {
  buildDraftsFromItems,
  collectTankestromEventExportValidationIssues,
  initialSelectedIdsForGeneralImport,
  makeEmbeddedChildProposalId,
  parseEmbeddedChildProposalId,
  buildEmbeddedChildCanonicalPreviewForReview,
} from '../../features/tankestrom/useTankestromImport'
import { parsePortalImportProposalBundle } from '../tankestromApi'
import {
  writeTankestromPreviewDebugReport,
  type TankestromPreviewDebugDayRow,
  type TankestromPreviewDebugReport,
} from '../tankestromCanonicalPreviewDebug'
import { flattenEmbeddedScheduleOrdered } from '../embeddedSchedule'
import {
  embeddedScheduleChildTitleForReview,
  normalizeEmbeddedScheduleParentDisplayTitle,
} from '../tankestromCupEmbeddedScheduleMerge'
import type { PortalImportProposalBundle } from '../../features/tankestrom/types'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function loadCup(label: 'vaacup' | 'hostcup') {
  const source = readFileSync(join(root, `fixtures/tankestrom/${label}_original.txt`), 'utf8')
  const bundle = parsePortalImportProposalBundle(
    JSON.parse(readFileSync(join(root, `fixtures/tankestrom/${label}_original.analyze.json`), 'utf8'))
  )
  return { source, bundle }
}

function highlightLines(
  preview: ReturnType<typeof buildEmbeddedChildCanonicalPreviewForReview>
): string[] {
  return preview.normalized.highlights.map((h) => `${h.time} ${h.label}`)
}

function importSummaryText(selectedIds: Set<string>, parentProposalId: string): string {
  const embeddedChildCount = [...selectedIds].filter((id) => parseEmbeddedChildProposalId(id)).length
  const parentSelected = selectedIds.has(parentProposalId)
  if (parentSelected && embeddedChildCount > 0) {
    return `1 arrangement / ${embeddedChildCount} hendelser`
  }
  return `${embeddedChildCount} hendelser`
}

function buildDebugRows(
  label: string,
  source: string,
  bundle: PortalImportProposalBundle,
  selectedIds: Set<string>,
  drafts: Record<string, TankestromImportDraft>,
  validPersonIds: Set<string>
): TankestromPreviewDebugReport {
  const item = bundle.items[0]!
  const parentId = item.proposalId
  const parentTitle = normalizeEmbeddedScheduleParentDisplayTitle(
    item.kind === 'event' ? item.event.title.trim() : ''
  ).title
  const segments = flattenEmbeddedScheduleOrdered(item.kind === 'event' ? item.event.metadata : undefined)
  const siblingBlob = segments.map((s) => s.title.trim()).join('\n')
  const days: TankestromPreviewDebugDayRow[] = segments.map((seg, i) => {
    const childId = makeEmbeddedChildProposalId(parentId, i)
    const displayTitle = embeddedScheduleChildTitleForReview(parentTitle, seg, siblingBlob)
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      seg,
      parentTitle,
      displayTitle,
      childId,
      { originalImportText: source }
    )
    const draft = drafts[childId]
    const blockers =
      draft?.importKind === 'event'
        ? collectTankestromEventExportValidationIssues(
            childId,
            childId,
            draft.event,
            validPersonIds
          ).map((x) => x.code)
        : []
    return {
      date: seg.date,
      title: displayTitle,
      rawSegmentStart: seg.start,
      rawSegmentEnd: seg.end,
      canonicalDisplayTime: preview.displayTime,
      displayTimeOrigin: preview.displayTimeOrigin,
      shownTidField: preview.timeLabel,
      canonicalHighlights: highlightLines(preview),
      selected: selectedIds.has(childId),
      blockers,
      isImportSelectable: preview.isImportSelectable,
      isPreliminaryDay: preview.isPreliminaryDay,
      importCountContribution: selectedIds.has(childId) ? 1 : 0,
    }
  })
  return {
    fixtureLabel: label,
    originalImportTextLength: source.length,
    importButtonSummary: importSummaryText(selectedIds, parentId),
    days,
  }
}

describe('Tankestrom canonical preview golden (Vårcup)', () => {
  const { source, bundle } = loadCup('vaacup')
  const validPersonIds = new Set(['person-a'])
  const people = [
    {
      id: 'person-a',
      name: 'Test',
      memberKind: 'child' as const,
      colorTint: 'bg-slate-200',
      colorAccent: 'border-slate-400',
    },
  ]
  const drafts = buildDraftsFromItems(bundle.items, validPersonIds, 'person-a', people, undefined, {
    originalImportText: source,
  })
  const selected = initialSelectedIdsForGeneralImport(
    bundle.items,
    drafts,
    people,
    'person-a',
    undefined,
    { originalImportText: source }
  )
  const parentId = bundle.items[0]!.proposalId
  const parentTitle = normalizeEmbeddedScheduleParentDisplayTitle(
    bundle.items[0]!.kind === 'event' ? bundle.items[0]!.event.title.trim() : ''
  ).title
  const segments = flattenEmbeddedScheduleOrdered(
    bundle.items[0]!.kind === 'event' ? bundle.items[0]!.event.metadata : undefined
  )

  it('import count = 1 arrangement / 2 hendelser', () => {
    expect(importSummaryText(selected, parentId)).toBe('1 arrangement / 2 hendelser')
  })

  it('fredag exact', () => {
    const seg = segments[0]!
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      seg,
      parentTitle,
      'Vårcupen – fredag',
      makeEmbeddedChildProposalId(parentId, 0),
      { originalImportText: source }
    )
    expect(preview.displayTime).toBe('17:45')
    expect(highlightLines(preview)).toEqual(['17:45 Oppmøte', '18:40 Første kamp'])
    expect(highlightLines(preview).join('\n')).not.toContain('18:40 Oppmøte')
    expect(preview.isImportSelectable).toBe(true)
    expect(selected.has(makeEmbeddedChildProposalId(parentId, 0))).toBe(true)
  })

  it('lørdag exact — ingen 17:45', () => {
    const seg = segments[1]!
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      seg,
      parentTitle,
      'Vårcupen – lørdag',
      makeEmbeddedChildProposalId(parentId, 1),
      { originalImportText: source }
    )
    expect(preview.displayTime).toBe('08:35')
    expect(highlightLines(preview)).toEqual([
      '08:35 Oppmøte før første kamp',
      '09:20 Første kamp',
      '14:25 Oppmøte før andre kamp',
      '15:10 Andre kamp',
    ])
    expect(highlightLines(preview).some((l) => l.includes('17:45'))).toBe(false)
  })

  it('søndag foreløpig — ikke selected, ingen blocker', () => {
    const seg = segments[2]!
    const childId = makeEmbeddedChildProposalId(parentId, 2)
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      seg,
      parentTitle,
      'Vårcupen – søndag',
      childId,
      { originalImportText: source }
    )
    expect(preview.displayTime).toBeNull()
    expect(preview.timeLabel).toBe('–')
    expect(preview.isImportSelectable).toBe(false)
    expect(selected.has(childId)).toBe(false)
    const draft = drafts[childId]!
    expect(draft.importKind).toBe('event')
    if (draft.importKind === 'event') {
      const issues = collectTankestromEventExportValidationIssues(
        childId,
        childId,
        draft.event,
        validPersonIds
      )
      expect(issues.some((i) => i.code === 'missing_end_time')).toBe(false)
    }
    expect(highlightLines(preview).some((t) => t.includes('17:45') || t.includes('18:40'))).toBe(
      false
    )
  })

  it('skriver debug-rapport for Vårcup', () => {
    const report = buildDebugRows('vaacup', source, bundle, selected, drafts, validPersonIds)
    const path = writeTankestromPreviewDebugReport(report, { filename: 'vaacup-golden.json' })
    expect(path).toContain('tankestrom-preview-debug')
    expect(report.days).toHaveLength(3)
  })
})

describe('Tankestrom canonical preview golden (Høstcup)', () => {
  const { source, bundle } = loadCup('hostcup')
  const validPersonIds = new Set(['person-a'])
  const people = [
    {
      id: 'person-a',
      name: 'Test',
      memberKind: 'child' as const,
      colorTint: 'bg-slate-200',
      colorAccent: 'border-slate-400',
    },
  ]
  const drafts = buildDraftsFromItems(bundle.items, validPersonIds, 'person-a', people, undefined, {
    originalImportText: source,
  })
  const selected = initialSelectedIdsForGeneralImport(
    bundle.items,
    drafts,
    people,
    'person-a',
    undefined,
    { originalImportText: source }
  )
  const parentId = bundle.items[0]!.proposalId
  const parentTitle = normalizeEmbeddedScheduleParentDisplayTitle(
    bundle.items[0]!.kind === 'event' ? bundle.items[0]!.event.title.trim() : ''
  ).title
  const segments = flattenEmbeddedScheduleOrdered(
    bundle.items[0]!.kind === 'event' ? bundle.items[0]!.event.metadata : undefined
  )

  it('import count = 1 arrangement / 2 hendelser', () => {
    expect(importSummaryText(selected, parentId)).toBe('1 arrangement / 2 hendelser')
  })

  it('fredag exact med kilde-tekst', () => {
    const seg = segments[0]!
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      seg,
      parentTitle,
      'Høstcupen – fredag',
      makeEmbeddedChildProposalId(parentId, 0),
      { originalImportText: source }
    )
    expect(preview.displayTime).toBe('17:30')
    const lines = highlightLines(preview)
    expect(lines).toHaveLength(2)
    expect(lines).toEqual(['17:30 Oppmøte ved bane 2', '18:15 Første kamp'])
  })

  it('lørdag exact', () => {
    const seg = segments[1]!
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      seg,
      parentTitle,
      'Høstcupen – lørdag',
      makeEmbeddedChildProposalId(parentId, 1),
      { originalImportText: source }
    )
    expect(preview.displayTime).toBe('08:20')
    expect(highlightLines(preview)).toEqual([
      '08:20 Oppmøte før første kamp',
      '09:00 Første kamp',
      '13:55 Oppmøte før andre kamp',
      '14:40 Andre kamp',
    ])
  })

  it('søndag/sluttspill foreløpig', () => {
    const childId = makeEmbeddedChildProposalId(parentId, 2)
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      segments[2]!,
      parentTitle,
      'Høstcupen – søndag',
      childId,
      { originalImportText: source }
    )
    expect(preview.isPreliminaryDay).toBe(true)
    expect(preview.isImportSelectable).toBe(false)
    expect(selected.has(childId)).toBe(false)
    expect(highlightLines(preview)).toHaveLength(0)
  })

  it('skriver debug-rapport for Høstcup', () => {
    const report = buildDebugRows('hostcup', source, bundle, selected, drafts, validPersonIds)
    writeTankestromPreviewDebugReport(report, { filename: 'hostcup-golden.json' })
    expect(report.importButtonSummary).toBe('1 arrangement / 2 hendelser')
  })
})
