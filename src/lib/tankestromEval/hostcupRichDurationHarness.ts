/**
 * Rich Høstcup varighets-fixture (16:40/17:30 fredag, 08:30/09:15 lørdag, foreløpig søndag).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PortalImportProposalBundle } from '../../features/tankestrom/types'
import {
  buildDraftsFromItems,
  buildEmbeddedChildCanonicalPreviewForReview,
  collectTankestromEventExportValidationIssues,
  initialSelectedIdsForGeneralImport,
  makeEmbeddedChildProposalId,
  parseEmbeddedChildProposalId,
} from '../../features/tankestrom/useTankestromImport'
import { parsePortalImportProposalBundle } from '../tankestromApi'
import { flattenEmbeddedScheduleOrdered } from '../embeddedSchedule'
import {
  embeddedScheduleChildTitleForReview,
  normalizeEmbeddedScheduleParentDisplayTitle,
} from '../tankestromCupEmbeddedScheduleMerge'
import { resolveEmbeddedScheduleSegmentTimesForCalendarExport } from '../tankestromEmbeddedChildNotesPresentation'

export type HostcupRichDaySnapshot = {
  date: string
  displayTitle: string
  canonicalDisplayTime: string | null
  canonicalHighlights: string[]
  draftStart: string
  draftEnd: string
  selected: boolean
  validationBlockers: string[]
  isPreliminaryDay: boolean
  isImportSelectable: boolean
  exportResolvedStart: string
  exportResolvedEnd: string
}

export type HostcupRichRunResult = {
  source: string
  bundle: PortalImportProposalBundle
  importButtonSummary: string
  taskProposalId: string | null
  taskDueTime: string | null
  days: HostcupRichDaySnapshot[]
}

export function loadHostcupRichFixture(): { source: string; bundle: PortalImportProposalBundle } {
  const root = join(process.cwd(), 'fixtures/tankestrom')
  const source = readFileSync(join(root, 'hostcup_duration_inference_rich.txt'), 'utf8')
  const bundle = parsePortalImportProposalBundle(
    JSON.parse(readFileSync(join(root, 'hostcup_duration_inference_rich.analyze.json'), 'utf8'))
  )
  return { source, bundle }
}

export function runHostcupRichDurationCase(): HostcupRichRunResult {
  const { source, bundle } = loadHostcupRichFixture()
  const personId = 'person-a'
  const validPersonIds = new Set([personId])
  const people = [
    {
      id: personId,
      name: 'Test',
      memberKind: 'child' as const,
      colorTint: 'bg-slate-200',
      colorAccent: 'border-slate-400',
    },
  ]

  const drafts = buildDraftsFromItems(bundle.items, validPersonIds, personId, people, undefined, {
    originalImportText: source,
  })
  const selected = initialSelectedIdsForGeneralImport(
    bundle.items,
    drafts,
    people,
    personId,
    undefined,
    { originalImportText: source }
  )

  const eventItem = bundle.items.find((i) => i.kind === 'event')!
  const parentId = eventItem.proposalId
  const parentTitle = normalizeEmbeddedScheduleParentDisplayTitle(
    eventItem.kind === 'event' ? eventItem.event.title.trim() : ''
  ).title
  const segments = flattenEmbeddedScheduleOrdered(
    eventItem.kind === 'event' ? eventItem.event.metadata : undefined
  )
  const siblingBlob = segments.map((s) => s.title.trim()).join('\n')

  const days: HostcupRichDaySnapshot[] = segments.map((seg, i) => {
    const childId = makeEmbeddedChildProposalId(parentId, i)
    const displayTitle = embeddedScheduleChildTitleForReview(parentTitle, seg, siblingBlob)
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      seg,
      parentTitle,
      displayTitle,
      childId,
      { originalImportText: source }
    )
    const exportTimes = resolveEmbeddedScheduleSegmentTimesForCalendarExport(seg, { childProposalId: childId })
    const draft = drafts[childId]
    const ev = draft?.importKind === 'event' ? draft.event : null
    return {
      date: seg.date,
      displayTitle,
      canonicalDisplayTime: preview.displayTime,
      canonicalHighlights: preview.normalized.highlights.map((h) => `${h.time} ${h.label}`),
      draftStart: ev?.start ?? '',
      draftEnd: ev?.end ?? '',
      selected: selected.has(childId),
      validationBlockers:
        ev != null
          ? collectTankestromEventExportValidationIssues(childId, childId, ev, validPersonIds).map(
              (x) => x.code
            )
          : [],
      isPreliminaryDay: preview.isPreliminaryDay,
      isImportSelectable: preview.isImportSelectable,
      exportResolvedStart: exportTimes.start,
      exportResolvedEnd: exportTimes.end,
    }
  })

  const taskItem = bundle.items.find((i) => i.kind === 'task')
  const embeddedChildCount = [...selected].filter((id) => parseEmbeddedChildProposalId(id)).length
  const parentSelected = selected.has(parentId)

  return {
    source,
    bundle,
    importButtonSummary:
      parentSelected && embeddedChildCount > 0
        ? `1 arrangement / ${embeddedChildCount} hendelser`
        : `${embeddedChildCount} hendelser`,
    taskProposalId: taskItem?.proposalId ?? null,
    taskDueTime: taskItem?.kind === 'task' ? (taskItem.task.dueTime ?? null) : null,
    days,
  }
}
