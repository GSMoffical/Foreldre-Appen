/**
 * Live-lignende Høstcup narrative: rå tekst + buggy Tankestrøm-payload → full import-preview.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EmbeddedScheduleSegment } from '../../types'
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
import type { CanonicalDisplayTimeOrigin } from '../tankestromCanonicalPreview'
import { canonicalEditSeedFromPreview } from '../tankestromCanonicalPreview'

export type HostcupLiveNarrativeDaySnapshot = {
  date: string
  displayTitle: string
  rawSegmentStart?: string
  rawSegmentEnd?: string
  isConditional: boolean
  canonicalDisplayTime: string | null
  displayTimeOrigin: CanonicalDisplayTimeOrigin
  timeLabel: string
  canonicalHighlights: string[]
  timeWindowSummaries: string[]
  selected: boolean
  isPreliminaryDay: boolean
  isImportSelectable: boolean
  editSeedStart: string
  editSeedEnd: string
  draftStart: string
  draftEnd: string
  validationBlockers: string[]
}

export type HostcupLiveNarrativeRunResult = {
  source: string
  bundle: PortalImportProposalBundle
  segments: EmbeddedScheduleSegment[]
  importButtonSummary: string
  embeddedChildSelectedCount: number
  taskDueTime: string | null
  days: HostcupLiveNarrativeDaySnapshot[]
}

export function loadHostcupLiveNarrativeFixture(): {
  source: string
  bundle: PortalImportProposalBundle
} {
  const root = join(process.cwd(), 'fixtures/tankestrom')
  const source = readFileSync(join(root, 'hostcup_duration_inference_rich.txt'), 'utf8')
  const bundle = parsePortalImportProposalBundle(
    JSON.parse(readFileSync(join(root, 'hostcup_duration_inference_rich.analyze.json'), 'utf8'))
  )
  return { source, bundle }
}

export function runHostcupLiveNarrativePreviewCase(): HostcupLiveNarrativeRunResult {
  const { source, bundle } = loadHostcupLiveNarrativeFixture()
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

  const days: HostcupLiveNarrativeDaySnapshot[] = segments.map((seg, i) => {
    const childId = makeEmbeddedChildProposalId(parentId, i)
    const displayTitle = embeddedScheduleChildTitleForReview(parentTitle, seg, siblingBlob)
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      seg,
      parentTitle,
      displayTitle,
      childId,
      { originalImportText: source }
    )
    const editSeed = canonicalEditSeedFromPreview(preview, seg, { childProposalId: childId })
    const draft = drafts[childId]
    const ev = draft?.importKind === 'event' ? draft.event : null
    return {
      date: seg.date,
      displayTitle,
      rawSegmentStart: seg.start,
      rawSegmentEnd: seg.end,
      isConditional: seg.isConditional === true,
      canonicalDisplayTime: preview.displayTime,
      displayTimeOrigin: preview.displayTimeOrigin,
      timeLabel: preview.timeLabel,
      canonicalHighlights: preview.normalized.highlights.map((h) => `${h.time} ${h.label}`),
      timeWindowSummaries: preview.normalized.timeWindowSummaries.map(
        (w) => `${w.timeRange}${w.tentative ? ' (foreløpig)' : ''} ${w.label}`.trim()
      ),
      selected: selected.has(childId),
      isPreliminaryDay: preview.isPreliminaryDay,
      isImportSelectable: preview.isImportSelectable,
      editSeedStart: editSeed.start,
      editSeedEnd: editSeed.end,
      draftStart: ev?.start ?? '',
      draftEnd: ev?.end ?? '',
      validationBlockers:
        ev != null
          ? collectTankestromEventExportValidationIssues(childId, childId, ev, validPersonIds).map(
              (x) => x.code
            )
          : [],
    }
  })

  const taskItem = bundle.items.find((i) => i.kind === 'task')
  const embeddedChildCount = [...selected].filter((id) => parseEmbeddedChildProposalId(id)).length
  const parentSelected = selected.has(parentId)

  return {
    source,
    bundle,
    segments,
    importButtonSummary:
      parentSelected && embeddedChildCount > 0
        ? `1 arrangement / ${embeddedChildCount} hendelser`
        : `${embeddedChildCount} hendelser`,
    embeddedChildSelectedCount: embeddedChildCount,
    taskDueTime: taskItem?.kind === 'task' ? (taskItem.task.dueTime ?? null) : null,
    days,
  }
}

export function writeHostcupLiveNarrativeDebugActual(
  result: HostcupLiveNarrativeRunResult,
  opts?: { dir?: string; filename?: string }
): string {
  const dir = opts?.dir ?? join(process.cwd(), 'tmp', 'tankestrom-preview-debug')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, opts?.filename ?? 'hostcup_duration_inference_rich.actual.json')
  const payload = {
    generatedAt: new Date().toISOString(),
    fixtureLabel: 'hostcup_duration_inference_rich (live narrative)',
    originalImportTextLength: result.source.length,
    importButtonSummary: result.importButtonSummary,
    embeddedChildSelectedCount: result.embeddedChildSelectedCount,
    taskDueTime: result.taskDueTime,
    rawBundleItems: result.bundle.items,
    embeddedScheduleSegments: result.segments,
    days: result.days,
  }
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8')
  return path
}
