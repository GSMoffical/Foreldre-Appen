/**
 * Full import/persist-simulering for Høstcup (ikke bare preview).
 */
import type { Event, Person } from '../../types'
import type { EmbeddedScheduleSegment } from '../../types'
import type { PortalEventProposal } from '../../features/tankestrom/types'
import { flattenEmbeddedScheduleOrdered } from '../embeddedSchedule'
import { calculateVisibleEvents } from '../schedule'
import {
  buildDraftsFromItems,
  buildPersistTimes,
  collectTankestromEventExportValidationIssues,
  initialSelectedIdsForGeneralImport,
  makeEmbeddedChildProposalId,
  tankestromEmbeddedParentSkipsExistingEventUpdateOnlyPath,
} from '../../features/tankestrom/useTankestromImport'
import { loadHostcupLiveNarrativeFixture } from './hostcupLiveNarrativePreviewHarness'

export type SimulatedPersistedEventRow = {
  proposalId: string
  date: string
  start: string
  end: string
  title: string
  personId: string | null
}

export type HostcupLiveNarrativePersistResult = {
  selectedIds: string[]
  parentProposalId: string
  segmentsExported: number
  persisted: SimulatedPersistedEventRow[]
  validationFailures: Array<{ proposalId: string; codes: string[] }>
  wouldBypassParentUpdateOnly: boolean
}

/** Samme segment-filter som `approveSelected` for programforelder. */
export function segmentsToExportForEmbeddedParent(
  parentProposalId: string,
  segments: Array<{ origIndex: number; segment: EmbeddedScheduleSegment }>,
  selectedIds: Set<string>,
  detachedChildIds: Set<string>
): Array<{ origIndex: number; segment: EmbeddedScheduleSegment }> {
  const included = segments.filter((r) =>
    selectedIds.has(makeEmbeddedChildProposalId(parentProposalId, r.origIndex))
  )
  const baseSegments = included.length > 0 ? included : segments
  return baseSegments.filter(
    (r) => !detachedChildIds.has(makeEmbeddedChildProposalId(parentProposalId, r.origIndex))
  )
}

/**
 * Simulerer delprogram-eksport (createEvent) for valgte Høstcup-dager uten Supabase.
 */
export function simulateHostcupEmbeddedChildPersist(opts?: {
  analyzeJson?: string
  sourceTextFile?: string
  people?: Person[]
  defaultPersonId?: string
}): HostcupLiveNarrativePersistResult {
  const { source, bundle } = loadHostcupLiveNarrativeFixture({
    analyzeJson: opts?.analyzeJson,
    sourceTextFile: opts?.sourceTextFile,
  })
  const personId = opts?.defaultPersonId ?? 'person-a'
  const validPersonIds = new Set([personId])
  const people =
    opts?.people ??
    ([
      {
        id: personId,
        name: 'Test',
        memberKind: 'child' as const,
        colorTint: 'bg-slate-200',
        colorAccent: 'border-slate-400',
      },
    ] as Person[])

  const drafts = buildDraftsFromItems(bundle.items, validPersonIds, personId, people, undefined, {
    originalImportText: source,
  })
  const selectedIds = initialSelectedIdsForGeneralImport(
    bundle.items,
    drafts,
    people,
    personId,
    undefined,
    { originalImportText: source }
  )

  const parentItem = bundle.items.find(
    (i): i is PortalEventProposal => i.kind === 'event' && tankestromEmbeddedParentSkipsExistingEventUpdateOnlyPath(i, drafts[i.proposalId])
  )!
  const parentId = parentItem.proposalId
  const parentDraftWrap = drafts[parentId]
  if (!parentDraftWrap || parentDraftWrap.importKind !== 'event') {
    throw new Error('missing parent draft')
  }
  const flat = flattenEmbeddedScheduleOrdered(parentItem.event.metadata)
  const rows = flat.map((segment, origIndex) => ({ origIndex, segment }))
  const toExport = segmentsToExportForEmbeddedParent(parentId, rows, selectedIds, new Set())
  const persisted: SimulatedPersistedEventRow[] = []
  const validationFailures: HostcupLiveNarrativePersistResult['validationFailures'] = []

  for (const row of toExport) {
    const childProposalId = makeEmbeddedChildProposalId(parentId, row.origIndex)
    const childWrap = drafts[childProposalId]
    if (!childWrap || childWrap.importKind !== 'event') {
      validationFailures.push({ proposalId: childProposalId, codes: ['missing_child_draft'] })
      continue
    }
    const draftEv = {
      ...childWrap.event,
      title: childWrap.event.title.trim(),
      date: childWrap.event.date.trim(),
      start: childWrap.event.start.trim(),
      end: childWrap.event.end.trim(),
    }
    const issues = collectTankestromEventExportValidationIssues(
      childProposalId,
      childProposalId,
      draftEv,
      validPersonIds
    )
    if (issues.length > 0) {
      validationFailures.push({
        proposalId: childProposalId,
        codes: issues.map((i) => i.code),
      })
      continue
    }
    const times = buildPersistTimes(draftEv)
    persisted.push({
      proposalId: childProposalId,
      date: draftEv.date,
      start: times.start,
      end: times.end,
      title: draftEv.title,
      personId: draftEv.personId.trim() || null,
    })
  }

  return {
    selectedIds: [...selectedIds],
    parentProposalId: parentId,
    segmentsExported: toExport.length,
    persisted,
    validationFailures,
    wouldBypassParentUpdateOnly: tankestromEmbeddedParentSkipsExistingEventUpdateOnlyPath(
      parentItem,
      parentDraftWrap
    ),
  }
}

export function persistedRowsVisibleInCalendar(
  rows: SimulatedPersistedEventRow[],
  personId: string
): SimulatedPersistedEventRow[] {
  const visible: SimulatedPersistedEventRow[] = []
  for (const row of rows) {
    const ev: Event = {
      id: row.proposalId,
      personId: row.personId,
      title: row.title,
      start: row.start,
      end: row.end,
      metadata: { timePrecision: 'timed', inferredEndTime: true, endTimeSource: 'frontend_canonical_fallback' },
    }
    const dayVisible = calculateVisibleEvents([ev], [personId])
    if (dayVisible.length > 0) visible.push(row)
  }
  return visible
}
