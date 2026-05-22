/**
 * Kjører Høstcup tekst- + segment-varianter gjennom samme import/preview-pipeline som UI.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EmbeddedScheduleSegment } from '../../types'
import type { PortalImportProposalBundle } from '../../features/tankestrom/types'
import {
  buildDraftsFromItems,
  buildEmbeddedChildCanonicalPreviewForReview,
  collectTankestromEventExportValidationIssues,
  draftHasStartWithoutKnownEnd,
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
import { canonicalEditSeedFromPreview } from '../tankestromCanonicalPreview'
import { resolveEmbeddedScheduleSegmentTimesForCalendarExport } from '../tankestromEmbeddedChildNotesPresentation'
import { normalizeEmbeddedScheduleDaySnapshots } from './vaacupNormalize'
import { invariantFailuresForHostcupDays } from './fixtureInvariants'
import { HOSTCUP_TEXT_VARIANTS, type HostcupTextVariant } from './hostcupTextVariants'
import {
  applyHostcupSegmentMutation,
  buildMetadataFromHostcupSegments,
  HOSTCUP_SEGMENT_MUTATION_KINDS,
  type HostcupSegmentMutationKind,
} from './hostcupSegmentMutations'

const HM24 = /^([01]\d|2[0-3]):[0-5]\d$/

function parseHmToMinutes(hm: string): number | null {
  const t = hm.trim().slice(0, 5)
  if (!HM24.test(t)) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function durationMinutesBetween(start: string, end: string): number | null {
  const s = parseHmToMinutes(start)
  const e = parseHmToMinutes(end)
  if (s == null || e == null || e <= s) return null
  return e - s
}

function loadHostcupAnalyzeTemplate(): PortalImportProposalBundle {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures/tankestrom/hostcup_original.analyze.json'), 'utf8')
  )
  return parsePortalImportProposalBundle(raw)
}

function bundleWithSegments(
  template: PortalImportProposalBundle,
  segments: EmbeddedScheduleSegment[]
): PortalImportProposalBundle {
  const item = template.items[0]
  if (!item || item.kind !== 'event') {
    throw new Error('hostcupDurationInferenceHarness: forventet ett event-item')
  }
  const cloned = JSON.parse(JSON.stringify(template)) as PortalImportProposalBundle
  const ev = cloned.items[0]
  if (ev.kind !== 'event') throw new Error('hostcupDurationInferenceHarness: event-item mangler')
  ev.event.metadata = buildMetadataFromHostcupSegments(segments)
  return cloned
}

function importSummaryText(selectedIds: Set<string>, parentProposalId: string): string {
  const embeddedChildCount = [...selectedIds].filter((id) => parseEmbeddedChildProposalId(id)).length
  const parentSelected = selectedIds.has(parentProposalId)
  if (parentSelected && embeddedChildCount > 0) {
    return `1 arrangement / ${embeddedChildCount} hendelser`
  }
  return `${embeddedChildCount} hendelser`
}

export type HostcupDayDurationSnapshot = {
  date: string
  displayTitle: string
  rawSegmentStart?: string
  rawSegmentEnd?: string
  isConditional: boolean
  canonicalDisplayTime: string | null
  displayTimeOrigin: string
  timeLabel: string
  editSeedStart: string
  editSeedEnd: string
  exportResolvedStart: string
  exportResolvedEnd: string
  exportPolicy: string
  usesSyntheticLayoutEnd: boolean
  draftStart: string
  draftEnd: string
  draftHasStartWithoutEnd: boolean
  draftUsesSyntheticLayoutEnd: boolean
  draftDurationMinutes: number | null
  canonicalHighlights: string[]
  isPreliminaryDay: boolean
  hasConcreteTimeDisplay: boolean
  selected: boolean
  validationBlockers: string[]
  normalizedEvalHighlights: string[]
}

export type HostcupVariantRunResult = {
  caseId: string
  textVariantId: string
  textDescription: string
  segmentMutation: HostcupSegmentMutationKind
  segmentMutationDescription: string
  originalImportTextLength: number
  importButtonSummary: string
  evalInvariantFailures: { code: string; message: string }[]
  days: HostcupDayDurationSnapshot[]
}

export type HostcupDurationMatrixOptions = {
  textVariantIds?: string[]
  segmentMutationKinds?: HostcupSegmentMutationKind[]
}

export function runHostcupDurationCase(
  textVariant: HostcupTextVariant,
  segmentMutation: HostcupSegmentMutationKind,
  opts?: { personId?: string }
): HostcupVariantRunResult {
  const personId = opts?.personId ?? 'person-a'
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

  const template = loadHostcupAnalyzeTemplate()
  const mut = applyHostcupSegmentMutation(segmentMutation)
  const bundle = bundleWithSegments(template, mut.segments)
  const source = textVariant.text

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

  const item = bundle.items[0]!
  const parentId = item.proposalId
  const parentTitle = normalizeEmbeddedScheduleParentDisplayTitle(
    item.kind === 'event' ? item.event.title.trim() : ''
  ).title
  const segments = flattenEmbeddedScheduleOrdered(
    item.kind === 'event' ? item.event.metadata : undefined
  )
  const siblingBlob = segments.map((s) => s.title.trim()).join('\n')

  const evalDays = normalizeEmbeddedScheduleDaySnapshots(
    (item.kind === 'event' ? item.event.metadata : {}) as import('../../types').EventMetadata,
    { globalSourceText: source }
  )
  const evalFailures = invariantFailuresForHostcupDays(evalDays)

  const days: HostcupDayDurationSnapshot[] = segments.map((seg, i) => {
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
    const exportTimes = resolveEmbeddedScheduleSegmentTimesForCalendarExport(seg, {
      childProposalId: childId,
    })
    const draft = drafts[childId]
    const ev = draft?.importKind === 'event' ? draft.event : null
    const blockers =
      ev != null
        ? collectTankestromEventExportValidationIssues(childId, childId, ev, validPersonIds).map(
            (x) => x.code
          )
        : []
    const evalDay = evalDays.find((d) => d.date === seg.date)
    return {
      date: seg.date,
      displayTitle,
      rawSegmentStart: seg.start,
      rawSegmentEnd: seg.end,
      isConditional: seg.isConditional === true,
      canonicalDisplayTime: preview.displayTime,
      displayTimeOrigin: preview.displayTimeOrigin,
      timeLabel: preview.timeLabel,
      editSeedStart: editSeed.start,
      editSeedEnd: editSeed.end,
      exportResolvedStart: exportTimes.start,
      exportResolvedEnd: exportTimes.end,
      exportPolicy: exportTimes.embeddedScheduleChildExportTimePolicyUsed,
      usesSyntheticLayoutEnd: exportTimes.usesSyntheticLayoutEnd,
      draftStart: ev?.start ?? '',
      draftEnd: ev?.end ?? '',
      draftHasStartWithoutEnd: ev != null ? draftHasStartWithoutKnownEnd(ev) : false,
      draftUsesSyntheticLayoutEnd: ev?.embeddedScheduleExport?.usesSyntheticLayoutEnd === true,
      draftDurationMinutes:
        ev != null ? durationMinutesBetween(ev.start, ev.end) : null,
      canonicalHighlights: preview.normalized.highlights.map((h) => `${h.time} ${h.label}`),
      isPreliminaryDay: preview.isPreliminaryDay,
      hasConcreteTimeDisplay: preview.hasConcreteTimeDisplay,
      selected: selected.has(childId),
      validationBlockers: blockers,
      normalizedEvalHighlights: (evalDay?.highlights ?? []).map((h) => `${h.time} ${h.label}`),
    }
  })

  return {
    caseId: `${textVariant.id}__${segmentMutation}`,
    textVariantId: textVariant.id,
    textDescription: textVariant.description,
    segmentMutation,
    segmentMutationDescription: mut.description,
    originalImportTextLength: source.length,
    importButtonSummary: importSummaryText(selected, parentId),
    evalInvariantFailures: evalFailures.map((f) => ({ code: f.code, message: f.message })),
    days,
  }
}

export function runHostcupDurationMatrix(opts?: HostcupDurationMatrixOptions): HostcupVariantRunResult[] {
  const textIds = opts?.textVariantIds ?? HOSTCUP_TEXT_VARIANTS.map((v) => v.id)
  const segKinds = opts?.segmentMutationKinds ?? HOSTCUP_SEGMENT_MUTATION_KINDS

  const out: HostcupVariantRunResult[] = []
  for (const tid of textIds) {
    const tv = HOSTCUP_TEXT_VARIANTS.find((v) => v.id === tid)
    if (!tv) continue
    for (const sk of segKinds) {
      out.push(runHostcupDurationCase(tv, sk))
    }
  }
  return out
}
