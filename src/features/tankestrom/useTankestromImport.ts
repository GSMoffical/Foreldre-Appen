import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  ChildSchoolProfile,
  EmbeddedScheduleSegment,
  Event,
  EventMetadata,
  Person,
  SchoolWeekOverlay,
  TankestromScheduleHighlight,
  Task,
  WeekdayMonFri,
} from '../../types'
import {
  evaluateEmbeddedScheduleParentCardHeuristic,
  flattenEmbeddedScheduleOrdered,
  isEmbeddedScheduleParentProposalItem,
  parseEmbeddedScheduleFromMetadata,
} from '../../lib/embeddedSchedule'
import { filterSubjectUpdatesByLanguageTrack } from '../../lib/schoolWeekOverlayFilters'
import {
  applyCupWeekendEmbeddedScheduleMerge,
  embeddedScheduleChildCalendarExportTitle,
  normalizeEmbeddedScheduleParentDisplayTitle,
} from '../../lib/tankestromCupEmbeddedScheduleMerge'
import { normalizeCalendarEventTitle } from '../../lib/tankestromTitleNormalization'
import { dedupeNearDuplicateCalendarProposals } from '../../lib/tankestromImportDedupe'
import { foldLegacyArrangementChildSegments } from '../../lib/tankestromLegacyArrangementSegments'
import { redistributeEnrichSubjectUpdatesForDay } from '../../lib/schoolWeekOverlayEnrichRouting'
import { resolveEmbeddedScheduleSegmentTimesForCalendarExport } from '../../lib/tankestromEmbeddedChildNotesPresentation'
import { presentEmbeddedChildNotesForReview } from '../../lib/tankestromEmbeddedChildNotesPresentation'
import {
  buildTankestromScheduleDescriptionFallback,
  dedupeNotesAgainstHighlights,
  readTankestromScheduleDetailsFromMetadata,
} from '../../lib/tankestromScheduleDetails'
import type {
  PortalEventProposal,
  PortalImportProposalBundle,
  PortalProposalItem,
  PortalSchoolProfileProposal,
  PortalSchoolWeekOverlayProposal,
  PortalSecondaryImportCandidate,
  PortalTaskProposal,
  TankestromEventDraft,
  TankestromImportDraft,
  TankestromPersonMatchStatus,
  TankestromTaskDraft,
} from './types'
import {
  analyzeDocumentWithTankestrom,
  analyzeTextWithTankestrom,
  mergePortalImportProposalBundles,
} from '../../lib/tankestromApi'
import { detectLessonConflicts } from '../../lib/schoolProfileConflicts'
import { normalizeTaskIntent, suggestTaskIntentFromTitleAndNotes } from '../../lib/taskIntent'
import { parseTime } from '../../lib/time'
import { getISOWeek, getISOWeekYear } from '../../lib/isoWeek'
import {
  findConservativeExistingEventMatch,
  getIncomingArrangementRange,
  readArrangementBlockGroupId,
  readArrangementCoreTitle,
  readArrangementStableKey,
  type ExistingEventMatchResult,
} from '../../lib/tankestromExistingEventMatch'
import { addCalendarDaysOslo } from '../../lib/osloCalendar'
import { getEventParticipantIds } from '../../lib/schedule'
import { cleanupParallelClusterDayRowsAfterEmbeddedParentUpdate } from '../../lib/tankestromExistingEventClusterCleanup'
import {
  aggregatePersistFailureKinds,
  buildTankestromImportFailureBulletBlock,
  buildTankestromImportFailureUserMessage,
  buildTankestromTaskPersistPayloadFingerprint,
  buildTaskPersistFailureSupabaseDebugPayload,
  classifyTankestromPersistThrownError,
  taskPersistFailureCanonicalBucket,
  type TankestromImportPersistFailureRecord,
  type TankestromImportPersistOperation,
} from '../../lib/tankestromImportPersistDiagnostics'
import { logEvent } from '../../lib/appLogger'
import {
  buildEventProposalFromSecondaryCandidate,
  buildMergedSecondaryImportCandidates,
  buildTaskProposalFromSecondaryCandidate,
  filterVisibleSecondaryCandidates,
  buildImportClassificationContext,
  proposalItemQualifiesSecondaryZone,
  type ImportClassificationContext,
} from '../../lib/tankestromSecondaryCandidates'
import { resolvePersonForImport } from '../../lib/tankestromImportPersonResolve'
import { normalizePersistedPersonId, requiresPersonForImport } from '../../lib/tankestromRequiresPerson'
import {
  TANKESTROM_FLIGHT_MISSING_END_LABEL,
  tankestromApplyStrippedFlightEndMetadata,
  tankestromShouldStripSyntheticFlightEnd,
} from '../../lib/tankestromFlightImportEnd'

const TANKESTROM_IMPORT_PERSIST_DEBUG =
  import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true'
const MISSING_ENDTIME_REVIEW_MESSAGE = 'Sluttid ikke oppgitt – rediger før import.'
const DATE_ONLY_FALLBACK_START = '09:00'
const DATE_ONLY_FALLBACK_END = '09:30'
const DATE_ONLY_LABEL = 'Tid ikke avklart'

function logTankestromImportPersist(payload: Record<string, unknown>): void {
  if (!TANKESTROM_IMPORT_PERSIST_DEBUG) return
  console.debug('[tankestrom import persist]', payload)
}

type Step = 'pick' | 'review'
export type TankestromInputMode = 'file' | 'text'

export type TankestromPendingFileStatus = 'ready' | 'analyzing' | 'done' | 'error'

export interface TankestromPendingFile {
  id: string
  file: File
  status: TankestromPendingFileStatus
  /** Kort feilmelding eller «Ingen hendelsesforslag» ved status error */
  statusDetail?: string
}

export type TankestromImportSuccess = {
  createdEvents: Array<{ id: string; title: string; date: string; start?: string | null; end?: string | null }>
  updatedEvents: Array<{ id: string; title: string; date: string; start?: string | null; end?: string | null }>
  createdTasks: Array<{ id: string; title: string; date: string }>
  arrangementTitle?: string
  /** Forventede forgrunns-hendelser (program + enkelt) fra valg — til ærlig toast/oppfølging. */
  promisedForegroundEventCount?: number
}

export type TankestromImportTerminalStatus = 'success' | 'partial_success' | 'failed' | 'noop_bug'

export type TankestromImportAttemptDebug = {
  selectedProposalIds: string[]
  selectedActions: Array<{
    proposalId: string
    importKind: string
    existingAction: string
  }>
  persistPlan: Array<{
    planSurface: 'event' | 'task'
    proposalId: string
    childId?: string
    mode: string
    title: string
    date: string
    start: string
    end: string
    personId: string
    validationErrors: string[]
  }>
  persistPlanLength: number
  attemptedPersistOps: number
  createdEventsCount: number
  updatedEventsCount: number
  createdTasksCount: number
  failuresCount: number
  noopReason?: string
}

export type TankestromImportLastAttempt =
  | { status: 'running'; id: string; startedAt: string }
  | {
      status: 'success'
      id: string
      startedAt: string
      debug: TankestromImportAttemptDebug
      createdEvents: TankestromImportSuccess['createdEvents']
      updatedEvents: TankestromImportSuccess['updatedEvents']
      createdTasks: TankestromImportSuccess['createdTasks']
    }
  | {
      status: 'partial_success'
      id: string
      startedAt: string
      debug: TankestromImportAttemptDebug
      createdEvents: TankestromImportSuccess['createdEvents']
      updatedEvents: TankestromImportSuccess['updatedEvents']
      createdTasks: TankestromImportSuccess['createdTasks']
      failures: TankestromImportPersistFailureRecord[]
    }
  | {
      status: 'failed'
      id: string
      startedAt: string
      debug: TankestromImportAttemptDebug
      failures: TankestromImportPersistFailureRecord[]
    }
  | {
      status: 'noop_bug'
      id: string
      startedAt: string
      debug: TankestromImportAttemptDebug
    }

export type TankestromImportResult = {
  ok: boolean
  partial: boolean
  success?: TankestromImportSuccess
  failureMessage?: string
  importAttemptId?: string
  terminalStatus?: TankestromImportTerminalStatus
}

function preflightImportFailureRecord(message: string): TankestromImportPersistFailureRecord {
  return {
    proposalId: '__preflight__',
    proposalSurfaceType: 'event',
    operation: 'createEvent',
    kind: 'validation',
    message,
  }
}

function newPendingFileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

const MANUAL_REVIEW_SOURCE_TYPE = 'manual_review'
const MANUAL_REVIEW_SOURCE_LABEL = 'Manuelt tillegg i import'

function isHm24(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s.trim())
}

/** Normaliser `type="time"`-verdi til HH:mm (f.eks. 09:30:00 → 09:30). */
export function normalizeTimeInput(s: string): string {
  const t = s.trim()
  const parts = t.split(':')
  if (parts.length >= 2) {
    const h = parts[0]!.padStart(2, '0').slice(-2)
    const m = parts[1]!.padStart(2, '0').slice(0, 2)
    return `${h}:${m}`
  }
  return t
}

function hmPlusMinutes(hm: string, addMinutes: number): string {
  const norm = normalizeTimeInput(hm)
  if (!isHm24(norm)) return '10:00'
  const total = parseTime(norm) + addMinutes
  const clamped = Math.min(Math.max(0, total), 23 * 60 + 59)
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function defaultChildPersonId(people: Person[], validPersonIds: Set<string>): string {
  const c = people.find((p) => p.memberKind === 'child' && validPersonIds.has(p.id))
  return c?.id ?? ''
}

const EMBEDDED_CHILD_ID_PREFIX = 'ts-emb:'

export type EmbeddedScheduleReviewRow = { origIndex: number; segment: EmbeddedScheduleSegment }

export function makeEmbeddedChildProposalId(parentProposalId: string, origIndex: number): string {
  return `${EMBEDDED_CHILD_ID_PREFIX}${parentProposalId}:${origIndex}`
}

export function parseEmbeddedChildProposalId(proposalId: string): {
  parentProposalId: string
  origIndex: number
} | null {
  if (!proposalId.startsWith(EMBEDDED_CHILD_ID_PREFIX)) return null
  const rest = proposalId.slice(EMBEDDED_CHILD_ID_PREFIX.length)
  const lastColon = rest.lastIndexOf(':')
  if (lastColon <= 0) return null
  const parentProposalId = rest.slice(0, lastColon)
  const origIndex = Number(rest.slice(lastColon + 1))
  if (!Number.isInteger(origIndex) || origIndex < 0) return null
  return { parentProposalId, origIndex }
}

/** Antall kalenderhendelser brukeren forventer fra valget (programbarn + enkelthendelser), ikke gjøremål. */
function countPromisedTankestromCalendarEventRows(
  ids: string[],
  bundle: PortalImportProposalBundle,
  draftByProposalId: Record<string, TankestromImportDraft>,
  embeddedScheduleReviewRowsByParentId: Record<string, EmbeddedScheduleReviewRow[]>,
  detachedEmbeddedChildIds: Set<string>,
  selectedIds: Set<string>
): number {
  let n = 0
  for (const id of ids) {
    const d = draftByProposalId[id]
    if (d?.importKind === 'task') continue

    const emb = parseEmbeddedChildProposalId(id)
    if (emb) {
      if (ids.includes(emb.parentProposalId)) continue
      n += 1
      continue
    }

    const item = bundle.items.find((i) => i.proposalId === id)
    if (!item || item.kind !== 'event') continue

    const meta =
      item.event.metadata && typeof item.event.metadata === 'object' && !Array.isArray(item.event.metadata)
        ? (item.event.metadata as Record<string, unknown>)
        : null

    const isProgramParentContainer =
      meta?.isArrangementParent === true &&
      meta?.exportAsCalendarEvent === false &&
      Array.isArray(meta?.embeddedSchedule) &&
      (meta?.embeddedSchedule as unknown[]).length > 0

    if (isProgramParentContainer && d?.importKind === 'event') {
      const rows = embeddedScheduleReviewRowsByParentId[item.proposalId] ?? []
      const included = rows.filter((r) => selectedIds.has(makeEmbeddedChildProposalId(item.proposalId, r.origIndex)))
      const baseSegments = included.length > 0 ? included : rows
      const segmentsToExport = baseSegments.filter(
        (r) => !detachedEmbeddedChildIds.has(makeEmbeddedChildProposalId(item.proposalId, r.origIndex))
      )
      n += segmentsToExport.length
      continue
    }

    n += 1
  }
  return n
}

function isEmbeddedScheduleParentCalendarItem(item: PortalProposalItem): item is PortalEventProposal {
  return item.kind === 'event' && isEmbeddedScheduleParentProposalItem(item)
}

function isEmbeddedScheduleParentForReview(
  item: PortalProposalItem,
  draft: TankestromImportDraft | undefined
): boolean {
  return item.kind === 'event' && draft?.importKind === 'event' && isEmbeddedScheduleParentCalendarItem(item)
}

function proposalImportDateRangeForMatch(
  item: PortalEventProposal,
  draft: TankestromEventDraft,
  embeddedRows: EmbeddedScheduleReviewRow[] | undefined
): { start: string; end: string } | null {
  const start = draft.date.trim()
  if (!DATE_KEY_RE.test(start)) return null
  const meta = item.event.metadata
  const endFromMeta =
    meta && typeof meta === 'object' && !Array.isArray(meta) && typeof (meta as { endDate?: unknown }).endDate === 'string'
      ? String((meta as { endDate: string }).endDate).trim()
      : ''
  if (DATE_KEY_RE.test(endFromMeta) && endFromMeta >= start) {
    return { start, end: endFromMeta }
  }
  if (isEmbeddedScheduleParentProposalItem(item) && embeddedRows?.length) {
    let maxD = start
    for (const r of embeddedRows) {
      const d = (r.segment.date ?? '').trim()
      if (DATE_KEY_RE.test(d) && d > maxD) maxD = d
    }
    return { start, end: maxD }
  }
  return { start, end: start }
}

/**
 * Bestem om import skal persistere som oppdatering av eksisterende hendelse.
 * Når konservativ match finnes og brukeren ikke har valgt eksplisitt «ny», brukes match (standard oppdatering).
 */
function resolveTankestromExistingEventPersistPlan(
  match: ExistingEventMatchResult | undefined,
  explicitLink: 'new' | 'update' | 'skip' | undefined,
  explicitTarget: { eventId: string; anchorDate: string } | undefined
):
  | { mode: 'update'; target: { eventId: string; anchorDate: string } }
  | { mode: 'new'; reason: string }
  | { mode: 'skip' }
  | { mode: 'blocked'; message: string } {
  if (explicitLink === 'skip') {
    return { mode: 'skip' }
  }
  if (explicitLink === 'new') {
    return { mode: 'new', reason: 'explicit_new' }
  }
  const cand = match && !match.rejected && match.candidate ? match.candidate : undefined
  if (explicitLink === 'update') {
    if (explicitTarget) return { mode: 'update', target: explicitTarget }
    if (cand) return { mode: 'update', target: { eventId: cand.event.id, anchorDate: cand.anchorDate } }
    return {
      mode: 'blocked',
      message:
        'Update valgt, men ingen eksisterende hendelse var koblet til importforslaget.',
    }
  }
  if (explicitLink === undefined && cand) {
    return { mode: 'update', target: { eventId: cand.event.id, anchorDate: cand.anchorDate } }
  }
  return { mode: 'new', reason: 'no_match_or_rejected' }
}

function buildEmbeddedChildEventDraft(
  parentDraft: TankestromEventDraft,
  segment: EmbeddedScheduleSegment,
  timeOpts?: { childProposalId?: string; siblingTitlesBlob?: string }
): TankestromEventDraft {
  const segmentHasConcreteTimes = Boolean((segment.start ?? '').trim() || (segment.end ?? '').trim())
  const exportTimes = segmentHasConcreteTimes
    ? resolveEmbeddedScheduleSegmentTimesForCalendarExport(segment, timeOpts)
    : { start: '', end: '' }
  const start = segmentHasConcreteTimes ? normalizeTimeInput(exportTimes.start) : ''
  const end = segmentHasConcreteTimes ? normalizeTimeInput(exportTimes.end) : ''
  const calendarTitle = embeddedScheduleChildCalendarExportTitle(
    segment,
    parentDraft.title,
    timeOpts?.siblingTitlesBlob
  )
  if (import.meta.env.DEV && calendarTitle.trim() !== segment.title.trim()) {
    console.debug('[tankestrom calendar export title]', {
      calendarExportTitleNormalized: calendarTitle,
      reviewSummaryPhraseSuppressedInExportTitle: true,
      segmentTitleRaw: segment.title,
    })
  }
  return {
    ...parentDraft,
    documentExtractedPersonName: undefined,
    title: calendarTitle,
    date: segment.date,
    start,
    end,
    notes: segment.notes?.trim() ? segment.notes.trim() : parentDraft.notes,
  }
}

function highlightTypeFromLabel(label: string): TankestromScheduleHighlight['type'] {
  const s = label.toLocaleLowerCase('nb-NO')
  if (s.includes('kamp') || s.includes('match')) return 'match'
  if (s.includes('oppmøte') || s.includes('møte')) return 'meeting'
  if (s.includes('frist') || s.includes('deadline')) return 'deadline'
  if (s.includes('notat') || s.includes('husk')) return 'note'
  return 'other'
}

function structuredDetailsFromSegment(
  segment: EmbeddedScheduleSegment,
  parentCardTitle: string,
  displayTitle: string,
  childProposalId: string
): { highlights: TankestromScheduleHighlight[]; notes: string[] } {
  const p = presentEmbeddedChildNotesForReview({
    seg: segment,
    parentCardTitle,
    displayTitle,
    childProposalId,
  })
  if (!p) return { highlights: [], notes: [] }
  if (p.mode === 'plain') return { highlights: [], notes: [] }
  const highlights = p.highlights.map((h) => ({
    time: h.displayTime.slice(0, 5),
    label: h.label,
    type: highlightTypeFromLabel(h.label),
  }))
  const notes = dedupeNotesAgainstHighlights(p.noteLines, highlights)
  return { highlights, notes }
}

function attachTankestromDetailsToMetadata(
  metadata: Record<string, unknown>,
  details: { highlights: TankestromScheduleHighlight[]; notes: string[] }
): void {
  if (details.highlights.length === 0 && details.notes.length === 0) {
    delete metadata.tankestromHighlights
    delete metadata.tankestromNotes
    delete metadata.tankestromDescriptionFallback
    return
  }
  metadata.tankestromHighlights = details.highlights
  metadata.tankestromNotes = details.notes
  metadata.tankestromDescriptionFallback = buildTankestromScheduleDescriptionFallback(
    details.highlights,
    details.notes
  )
}

function buildDetachedEmbeddedChildProposal(
  parent: PortalEventProposal,
  segment: EmbeddedScheduleSegment,
  origIndex: number
): PortalEventProposal {
  const proposalId = makeEmbeddedChildProposalId(parent.proposalId, origIndex)
  const segmentHasConcreteTimes = Boolean((segment.start ?? '').trim() || (segment.end ?? '').trim())
  const exportTimes = segmentHasConcreteTimes
    ? resolveEmbeddedScheduleSegmentTimesForCalendarExport(segment, {
        childProposalId: proposalId,
      })
    : { start: '', end: '' }
  const start = segmentHasConcreteTimes ? normalizeTimeInput(exportTimes.start) : ''
  const end = segmentHasConcreteTimes ? normalizeTimeInput(exportTimes.end) : ''
  const baseMeta =
    parent.event.metadata && typeof parent.event.metadata === 'object' && !Array.isArray(parent.event.metadata)
      ? { ...(parent.event.metadata as Record<string, unknown>) }
      : {}
  delete baseMeta.embeddedSchedule
  delete baseMeta.endDate
  delete baseMeta.multiDayAllDay
  baseMeta.isAllDay = false
  baseMeta.detachedFromEmbeddedParentId = parent.proposalId
  baseMeta.detachedEmbeddedOrigIndex = origIndex

  return {
    ...parent,
    proposalId,
    kind: 'event',
    event: {
      ...parent.event,
      date: segment.date,
      start,
      end,
      title: embeddedScheduleChildCalendarExportTitle(segment, parent.event.title),
      notes: segment.notes?.trim() ? segment.notes.trim() : parent.event.notes,
      metadata: baseMeta,
    },
  }
}

/** Samme fremmedspråk-lexemes som overlay-review (unngå engelsk/norsk som «språkfag»). */
const TASK_FOREIGN_LANG_LEXEMES: ReadonlyArray<{ canon: string; pattern: RegExp }> = [
  { canon: 'spansk', pattern: /\bspansk\b|spanish/i },
  { canon: 'tysk', pattern: /\btysk\b|tyskland|german|deutsch/i },
  { canon: 'fransk', pattern: /\bfransk\b|french/i },
  { canon: 'russisk', pattern: /\brussisk\b|russian/i },
  { canon: 'italiensk', pattern: /\bitaliensk\b|italian/i },
  { canon: 'mandarin', pattern: /\bmandarin\b|kinesisk|kinamål/i },
  { canon: 'japansk', pattern: /\bjapansk\b|japanese/i },
  { canon: 'arabisk', pattern: /\barabisk\b|arabic/i },
]

const TASK_VALGFAG_LEXEMES: ReadonlyArray<{ canon: string; pattern: RegExp }> = [
  { canon: 'programmering', pattern: /\bprogrammering\b|coding|programming/i },
  { canon: 'musikk', pattern: /\bmusikk\b|music/i },
  { canon: 'idrett', pattern: /\bidrett\b|sport/i },
  { canon: 'teater', pattern: /\bteater\b|theatre|theater|drama/i },
  { canon: 'kunst og visuell kultur', pattern: /\bkunst\b|\bvisuell\b|visual art|kunst og visuell/i },
  { canon: 'mat og helse', pattern: /\bmat og helse\b|home economics|kokk|koking/i },
]

function inferredLessonTrackForSubject(
  school: ChildSchoolProfile | undefined,
  subjectKey: string
): { track?: string; usedCustomLabelFallbackTrack: boolean } {
  if (!school?.weekdays) return { track: undefined, usedCustomLabelFallbackTrack: false }
  for (const plan of Object.values(school.weekdays)) {
    if (!plan?.lessons) continue
    for (const l of plan.lessons) {
      if (l.subjectKey !== subjectKey) continue
      const fromSubcategory = l.lessonSubcategory?.trim()
      if (fromSubcategory) {
        return { track: fromSubcategory, usedCustomLabelFallbackTrack: false }
      }
      const fromCustom = l.customLabel?.trim()
      if (fromCustom) {
        return { track: fromCustom, usedCustomLabelFallbackTrack: true }
      }
    }
  }
  return { track: undefined, usedCustomLabelFallbackTrack: false }
}

type ResolvedLanguageTrackDiagnostics = {
  languageLessonSubjectKeys: string[]
  languageLessonSubcategories: string[]
  languageLessonCustomLabels: string[]
  childSchoolLanguageCandidates: Array<{ subjectKey: string; lessonSubcategory?: string; customLabel?: string }>
  resolvedLanguageTrack?: string
  resolvedLanguageTrackSource?:
    | 'lessonSubcategory'
    | 'customLabel'
    | 'direct_language_subjectKey'
    | 'direct_language_label'
}

function displayLanguageFromCanon(canon: string): string {
  return canon.slice(0, 1).toLocaleUpperCase('nb-NO') + canon.slice(1)
}

function firstForeignLanguageCanonInText(text: string): string | undefined {
  for (const { canon, pattern } of TASK_FOREIGN_LANG_LEXEMES) {
    if (pattern.test(text)) return canon
  }
  return undefined
}

function resolveLanguageTrackDiagnostics(
  school: ChildSchoolProfile | undefined
): ResolvedLanguageTrackDiagnostics {
  const out: ResolvedLanguageTrackDiagnostics = {
    languageLessonSubjectKeys: [],
    languageLessonSubcategories: [],
    languageLessonCustomLabels: [],
    childSchoolLanguageCandidates: [],
  }
  if (!school?.weekdays) return out
  for (const plan of Object.values(school.weekdays)) {
    if (!plan?.lessons) continue
    for (const l of plan.lessons) {
      if (l.subjectKey !== 'fremmedspråk') continue
      out.languageLessonSubjectKeys.push(l.subjectKey)
      if (l.lessonSubcategory?.trim()) out.languageLessonSubcategories.push(l.lessonSubcategory.trim())
      if (l.customLabel?.trim()) out.languageLessonCustomLabels.push(l.customLabel.trim())
      out.childSchoolLanguageCandidates.push({
        subjectKey: l.subjectKey,
        lessonSubcategory: l.lessonSubcategory?.trim() || undefined,
        customLabel: l.customLabel?.trim() || undefined,
      })
      if (!out.resolvedLanguageTrack) {
        if (l.lessonSubcategory?.trim()) {
          out.resolvedLanguageTrack = l.lessonSubcategory.trim()
          out.resolvedLanguageTrackSource = 'lessonSubcategory'
        } else if (l.customLabel?.trim()) {
          out.resolvedLanguageTrack = l.customLabel.trim()
          out.resolvedLanguageTrackSource = 'customLabel'
        }
      }
    }
  }
  // Fallback for older/direct profiles: subjectKey=tysk/fransk/spansk/... or label text with language.
  if (!out.resolvedLanguageTrack) {
    for (const plan of Object.values(school.weekdays)) {
      if (!plan?.lessons) continue
      for (const l of plan.lessons) {
        const subjectCanon = firstForeignLanguageCanonInText(l.subjectKey)
        if (subjectCanon) {
          out.resolvedLanguageTrack = displayLanguageFromCanon(subjectCanon)
          out.resolvedLanguageTrackSource = 'direct_language_subjectKey'
          return out
        }
        const labelBlob = `${l.lessonSubcategory ?? ''}\n${l.customLabel ?? ''}`.trim()
        if (!labelBlob) continue
        const labelCanon = firstForeignLanguageCanonInText(labelBlob)
        if (labelCanon) {
          out.resolvedLanguageTrack = displayLanguageFromCanon(labelCanon)
          out.resolvedLanguageTrackSource = 'direct_language_label'
          return out
        }
      }
    }
  }
  return out
}

export function inferLanguageTrackFromChildSchool(school: ChildSchoolProfile | undefined): string | undefined {
  return resolveLanguageTrackDiagnostics(school).resolvedLanguageTrack
}

export function inferValgfagTrackFromChildSchool(school: ChildSchoolProfile | undefined): string | undefined {
  return inferredLessonTrackForSubject(school, 'valgfag').track
}

function foreignLanguageCanonsInText(text: string): Set<string> {
  const out = new Set<string>()
  for (const { canon, pattern } of TASK_FOREIGN_LANG_LEXEMES) {
    if (pattern.test(text)) out.add(canon)
  }
  return out
}

function taskMentionsCatalogForeignLanguage(title: string, notesBody: string): boolean {
  return foreignLanguageCanonsInText(`${title}\n${notesBody}`).size > 0
}

/** Barnets spor kan være «Tysk 2» — matcher fortsatt lexeme-canon `tysk`. */
function trackMatchesCanon(trackNorm: string, canon: string): boolean {
  if (trackNorm === canon) return true
  const first = trackNorm.split(/[\s/-]+/)[0] ?? trackNorm
  if (first === canon) return true
  if (trackNorm.startsWith(`${canon} `) || trackNorm.startsWith(`${canon}-`)) return true
  return false
}

/** Fjern første «Fra: …»-linje slik at kildeprefill ikke gir falske språktreff. */
export function scanNotesBodyForLanguage(notes: string): string {
  const lines = notes.replace(/\r\n/g, '\n').split('\n')
  if (lines[0]?.trim().toLowerCase().startsWith('fra:')) {
    return lines.slice(1).join('\n').trim()
  }
  return notes.trim()
}

/** True når tittel/notat tydelig viser annet fremmedspråk enn barnets spor. */
export function taskIndicatesForeignLanguageMismatchWithTrack(
  title: string,
  notesBody: string,
  resolvedTrack: string | undefined
): boolean {
  const track = resolvedTrack?.trim().toLocaleLowerCase('nb-NO')
  if (!track) return false
  const mentioned = foreignLanguageCanonsInText(`${title}\n${notesBody}`)
  if (mentioned.size === 0) return false
  for (const m of mentioned) {
    if (!trackMatchesCanon(track, m)) return true
  }
  return false
}

function taskIndicatesValgfagMismatchWithTrack(
  title: string,
  notesBody: string,
  resolvedTrack: string | undefined
): boolean {
  const track = resolvedTrack?.trim().toLocaleLowerCase('nb-NO')
  if (!track) return false
  const blob = `${title}\n${notesBody}`
  const mentioned = new Set<string>()
  for (const { canon, pattern } of TASK_VALGFAG_LEXEMES) {
    if (pattern.test(blob)) mentioned.add(canon)
  }
  if (mentioned.size === 0) return false
  for (const m of mentioned) {
    if (!trackMatchesCanon(track, m)) return true
  }
  return false
}

export function humanImportSourceLabelForBundle(bundle: PortalImportProposalBundle | null | undefined): string | undefined {
  if (!bundle) return undefined
  const ov = bundle.schoolWeekOverlayProposal
  if (ov?.sourceTitle?.trim()) return ov.sourceTitle.trim()
  if (ov?.classLabel?.trim() && ov.weekNumber != null) {
    return `A-plan ${ov.classLabel.trim()} uke ${ov.weekNumber}`
  }
  if (ov?.classLabel?.trim()) return `A-plan ${ov.classLabel.trim()}`
  if (ov?.weekNumber != null) return `A-plan uke ${ov.weekNumber}`
  const st = bundle.provenance?.sourceType?.trim()
  if (st) return st
  return undefined
}

function initialSelectedIdsForGeneralImport(
  items: PortalProposalItem[],
  drafts: Record<string, TankestromImportDraft>,
  people: Person[],
  schoolProfileChildId: string,
  classificationCtx?: ImportClassificationContext
): Set<string> {
  const child = people.find((p) => p.id === schoolProfileChildId && p.memberKind === 'child')
  const languageDiag = resolveLanguageTrackDiagnostics(child?.school)
  const languageTrackInfo = inferredLessonTrackForSubject(child?.school, 'fremmedspråk')
  const valgfagTrackInfo = inferredLessonTrackForSubject(child?.school, 'valgfag')
  const track = languageDiag.resolvedLanguageTrack
  const valgfagTrack = valgfagTrackInfo.track
  const out = new Set<string>()
  let taskMismatch = 0
  let taskMismatchValgfag = 0
  const taskLanguageReview: Array<{
    proposalId: string
    title: string
    notesBody: string
    mismatchLanguage: boolean
    mismatchValgfag: boolean
    selected: boolean
  }> = []
  for (const item of items) {
    if (item.kind === 'school_profile') continue
    if (item.kind === 'event') {
      if (proposalItemQualifiesSecondaryZone(item, classificationCtx)) continue
      out.add(item.proposalId)
      continue
    }
    if (item.kind === 'task') {
      if (proposalItemQualifiesSecondaryZone(item, classificationCtx)) continue
      const d = drafts[item.proposalId]
      if (!d || d.importKind !== 'task') continue
      const body = scanNotesBodyForLanguage(d.task.notes)
      const mismatchLanguage = taskIndicatesForeignLanguageMismatchWithTrack(d.task.title, body, track)
      if (mismatchLanguage) {
        taskMismatch += 1
        taskLanguageReview.push({
          proposalId: item.proposalId,
          title: d.task.title,
          notesBody: body,
          mismatchLanguage: true,
          mismatchValgfag: false,
          selected: false,
        })
        continue
      }
      const mismatchValgfag = taskIndicatesValgfagMismatchWithTrack(d.task.title, body, valgfagTrack)
      if (mismatchValgfag) {
        taskMismatch += 1
        taskMismatchValgfag += 1
        taskLanguageReview.push({
          proposalId: item.proposalId,
          title: d.task.title,
          notesBody: body,
          mismatchLanguage: false,
          mismatchValgfag: true,
          selected: false,
        })
        continue
      }
      out.add(item.proposalId)
      if (taskMentionsCatalogForeignLanguage(d.task.title, body)) {
        taskLanguageReview.push({
          proposalId: item.proposalId,
          title: d.task.title,
          notesBody: body,
          mismatchLanguage: false,
          mismatchValgfag: false,
          selected: true,
        })
      }
    }
  }
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
    console.debug('[tankestrom task language selection]', {
      reviewLanguageTrack: track,
      resolvedLanguageTrack: languageDiag.resolvedLanguageTrack,
      resolvedLanguageTrackSource: languageDiag.resolvedLanguageTrackSource,
      childSchoolLanguageCandidates: languageDiag.childSchoolLanguageCandidates,
      languageLessonSubjectKeys: languageDiag.languageLessonSubjectKeys,
      languageLessonSubcategories: languageDiag.languageLessonSubcategories,
      languageLessonCustomLabels: languageDiag.languageLessonCustomLabels,
      childLessonSubcategoryTrack: { language: track, valgfag: valgfagTrack },
      usedLessonSubcategoryForFiltering: !!(track || valgfagTrack),
      usedCustomLabelFallbackTrack:
        languageTrackInfo.usedCustomLabelFallbackTrack || valgfagTrackInfo.usedCustomLabelFallbackTrack,
      taskLanguageMismatchCount: taskMismatch,
      taskValgfagMismatchCount: taskMismatchValgfag,
      taskDeselectedBecauseLanguageMismatch: taskMismatch,
      taskRejectedByStoredTrackMismatch: taskMismatch,
      taskHiddenBecauseLanguageMismatch: 0,
      taskLanguageReview,
    })
    if (!languageDiag.resolvedLanguageTrack) {
      console.debug('[tankestrom task language selection] no language track resolved', {
        resolvedLanguageTrack: languageDiag.resolvedLanguageTrack,
        childSchoolLanguageCandidates: languageDiag.childSchoolLanguageCandidates,
      })
    }
  }
  for (const item of items) {
    if (item.kind !== 'event') continue
    const d = drafts[item.proposalId]
    if (!isEmbeddedScheduleParentForReview(item, d)) continue
    if (!out.has(item.proposalId)) continue
    const flat = flattenEmbeddedScheduleOrdered(item.event.metadata)
    for (let i = 0; i < flat.length; i++) {
      out.add(makeEmbeddedChildProposalId(item.proposalId, i))
    }
  }
  return out
}

export function validateTankestromDraft(
  d: TankestromEventDraft,
  validPersonIds: Set<string>
): string | null {
  if (!d.title.trim()) return 'Tittel kan ikke være tom.'
  const dateStr = d.date.trim()
  if (!DATE_KEY_RE.test(dateStr)) return 'Dato må være på formen ÅÅÅÅ-MM-DD.'
  const parsed = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return 'Ugyldig dato.'

  const missingStart = !d.start.trim()
  const missingEnd = !d.end.trim()
  const dateOnly = missingStart && missingEnd
  const flightUnknownEnd = isFlightDraftWithUnknownEndForImport(d)
  if (!dateOnly && missingStart) return 'Starttid ikke oppgitt. Rediger forslaget og legg inn starttid før import.'
  const startNorm = normalizeTimeInput(d.start)
  if (!dateOnly && !isHm24(startNorm)) return 'Starttid må være gyldig klokkeslett (HH:mm, 24 t).'

  if (!dateOnly && missingEnd && !flightUnknownEnd) {
    return MISSING_ENDTIME_REVIEW_MESSAGE
  }
  if (!dateOnly && !missingEnd) {
    const endNorm = normalizeTimeInput(d.end)
    if (!isHm24(endNorm)) return 'Sluttid må være gyldig klokkeslett (HH:mm, 24 t).'
    const startMin = parseTime(startNorm)
    const endMin = parseTime(endNorm)
    if (endMin <= startMin) return 'Sluttid må være senere enn starttid.'
  }

  if (requiresPersonForImport(d)) {
    if (!d.personId.trim() || !validPersonIds.has(d.personId)) return 'Velg person før import.'
  } else if (d.personId.trim() && !validPersonIds.has(d.personId)) {
    return 'Ugyldig person valgt.'
  }
  if (d.participantPersonIds?.length) {
    for (const id of d.participantPersonIds) {
      if (!validPersonIds.has(id)) return 'Ugyldig deltaker på hendelsen.'
    }
    const primary = d.personId.trim()
    if (primary && d.participantPersonIds[0] !== d.personId) {
      return 'Primær person må være den første i deltakerlisten.'
    }
  }
  return null
}

export function validateTankestromTaskDraft(d: TankestromTaskDraft): string | null {
  if (!d.title.trim()) return 'Tittel kan ikke være tom.'
  const dateStr = d.date.trim()
  if (!DATE_KEY_RE.test(dateStr)) return 'Dato må være på formen ÅÅÅÅ-MM-DD.'
  const parsed = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return 'Ugyldig dato.'
  const due = d.dueTime.trim()
  if (due && !isHm24(normalizeTimeInput(due))) return 'Frist (klokkeslett) må være HH:mm.'
  return null
}

export type TankestromFieldErrorKey = 'title' | 'date' | 'start' | 'end' | 'personId'
export type TankestromTaskFieldErrorKey = 'title' | 'date' | 'dueTime'
export type ImportValidationError = {
  proposalId: string
  childId?: string
  title: string
  date?: string
  field: 'title' | 'date' | 'start' | 'end' | 'personId' | 'parent' | 'database' | 'unknown'
  message: string
}

/** Felt-spesifikke meldinger for inline validering (samme regler som validateTankestromDraft). */
export function getTankestromDraftFieldErrors(
  d: TankestromEventDraft,
  validPersonIds: Set<string>
): Partial<Record<TankestromFieldErrorKey, string>> {
  const out: Partial<Record<TankestromFieldErrorKey, string>> = {}
  if (!d.title.trim()) out.title = 'Tittel kan ikke være tom.'
  const dateStr = d.date.trim()
  if (!DATE_KEY_RE.test(dateStr)) out.date = 'Bruk formatet ÅÅÅÅ-MM-DD.'
  else {
    const parsed = new Date(`${dateStr}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) out.date = 'Ugyldig dato.'
  }
  const missingStart = !d.start.trim()
  const missingEnd = !d.end.trim()
  const dateOnly = missingStart && missingEnd
  const flightUnknownEnd = isFlightDraftWithUnknownEndForImport(d)
  if (!dateOnly && !d.start.trim()) {
    out.start = 'Starttid ikke oppgitt. Rediger forslaget og legg inn starttid før import.'
  } else {
    const startNorm = normalizeTimeInput(d.start)
    if (!dateOnly && !isHm24(startNorm)) out.start = 'Ugyldig tid (HH:mm, 24 t).'
  }

  if (!dateOnly && missingEnd && !flightUnknownEnd) {
    out.end = MISSING_ENDTIME_REVIEW_MESSAGE
  } else if (!dateOnly && !missingEnd) {
    const endNorm = normalizeTimeInput(d.end)
    if (!isHm24(endNorm)) out.end = 'Ugyldig tid (HH:mm, 24 t).'
  }

  const startNorm = normalizeTimeInput(d.start)
  const endNorm = normalizeTimeInput(d.end)
  if (!dateOnly && !missingEnd && isHm24(startNorm) && isHm24(endNorm) && parseTime(endNorm) <= parseTime(startNorm)) {
    out.end = 'Slutt må være etter start.'
  }
  if (requiresPersonForImport(d)) {
    if (!d.personId.trim() || !validPersonIds.has(d.personId)) {
      out.personId = 'Velg person før import.'
    }
  } else if (d.personId.trim() && !validPersonIds.has(d.personId)) {
    out.personId = 'Ugyldig person valgt.'
  }
  if (d.participantPersonIds?.length) {
    for (const id of d.participantPersonIds) {
      if (!validPersonIds.has(id)) {
        out.personId = 'Ugyldig deltaker.'
        break
      }
    }
    const primary = d.personId.trim()
    if (primary && d.participantPersonIds[0] !== d.personId) {
      out.personId = 'Primær person må være først blant deltakerne.'
    }
  }
  return out
}

export function getTankestromTaskFieldErrors(
  d: TankestromTaskDraft
): Partial<Record<TankestromTaskFieldErrorKey, string>> {
  const out: Partial<Record<TankestromTaskFieldErrorKey, string>> = {}
  if (!d.title.trim()) out.title = 'Tittel kan ikke være tom.'
  const dateStr = d.date.trim()
  if (!DATE_KEY_RE.test(dateStr)) out.date = 'Bruk formatet ÅÅÅÅ-MM-DD.'
  else {
    const parsed = new Date(`${dateStr}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) out.date = 'Ugyldig dato.'
  }
  const due = d.dueTime.trim()
  if (due && !isHm24(normalizeTimeInput(due))) out.dueTime = 'Ugyldig tid (HH:mm).'
  return out
}

function validateUnifiedDraft(d: TankestromImportDraft, validPersonIds: Set<string>): string | null {
  if (d.importKind === 'event') return validateTankestromDraft(d.event, validPersonIds)
  return validateTankestromTaskDraft(d.task)
}

function preflightEventValidationErrors(
  proposalId: string,
  childId: string | undefined,
  d: TankestromEventDraft,
  validPersonIds: Set<string>
): ImportValidationError[] {
  const errs = getTankestromDraftFieldErrors(d, validPersonIds)
  const out: ImportValidationError[] = []
  const title = d.title.trim() || 'Uten tittel'
  const date = d.date.trim() || undefined
  if (errs.title) out.push({ proposalId, childId, title, date, field: 'title', message: errs.title })
  if (errs.date) out.push({ proposalId, childId, title, date, field: 'date', message: errs.date })
  if (errs.start) out.push({ proposalId, childId, title, date, field: 'start', message: errs.start })
  if (errs.end) out.push({ proposalId, childId, title, date, field: 'end', message: errs.end })
  if (errs.personId) out.push({ proposalId, childId, title, date, field: 'personId', message: errs.personId })
  return out
}

function bulkApplyTaskPersonFields(
  people: Person[],
  validPersonIds: Set<string>,
  personIds: string[]
): Pick<TankestromTaskDraft, 'childPersonId' | 'assignedToPersonId'> {
  const resolved = personIds
    .map((id) => people.find((p) => p.id === id && validPersonIds.has(id)))
    .filter(Boolean) as Person[]
  const children = resolved.filter((p) => p.memberKind === 'child')
  const adults = resolved.filter((p) => p.memberKind !== 'child')
  if (children.length > 0) {
    return {
      childPersonId: children[0]!.id,
      assignedToPersonId: adults[0]?.id ?? '',
    }
  }
  if (adults.length > 0) {
    return { childPersonId: '', assignedToPersonId: adults[0]!.id }
  }
  return { childPersonId: '', assignedToPersonId: '' }
}

function mergeEventParticipantsIntoMetadata(
  metadata: Record<string, unknown>,
  draft: TankestromEventDraft,
  validPersonIds: Set<string>
): void {
  const list = draft.participantPersonIds?.filter((id) => validPersonIds.has(id))
  if (list && list.length > 1) {
    metadata.participants = list
  } else {
    delete metadata.participants
  }
}

/**
 * Tankestrøm delprogram: aldri arv forelders flerdagers-/container-felt. Ellers kan
 * `getAllEventsForDate` projisere samme hendelse på flere dager (isAllDay + endDate).
 */
function sanitizeEmbeddedChildCalendarExportMetadata(metadata: Record<string, unknown>): void {
  delete metadata.endDate
  delete metadata.embeddedSchedule
  delete metadata.multiDayAllDay
  delete metadata.__anchorDate
  metadata.isAllDay = false
}

function draftIsDateOnly(draft: Pick<TankestromEventDraft, 'start' | 'end'>): boolean {
  return !draft.start.trim() && !draft.end.trim()
}

function isFlightDraftWithUnknownEndForImport(draft: TankestromEventDraft): boolean {
  return (
    String(draft.travelImportType ?? '').trim().toLowerCase() === 'flight' &&
    draft.start.trim().length > 0 &&
    !draft.end.trim()
  )
}

function applyDateOnlyMetadata(metadata: Record<string, unknown>, isDateOnly: boolean): void {
  if (!isDateOnly) {
    metadata.timePrecision = 'timed'
    if (metadata.displayTimeLabel === DATE_ONLY_LABEL) delete metadata.displayTimeLabel
    if (metadata.requiresManualTimeReview === true) metadata.requiresManualTimeReview = false
    return
  }
  metadata.timePrecision = 'date_only'
  metadata.displayTimeLabel = DATE_ONLY_LABEL
  metadata.requiresManualTimeReview = true
  metadata.startTimeSource = 'missing'
  metadata.endTimeSource = 'missing'
}

/** Kalender-persist: etter applyDateOnlyMetadata — overstyr for fly med ukjent slutt. */
function applyFlightStartOnlyPersistMetadata(metadata: Record<string, unknown>, draft: TankestromEventDraft): void {
  if (draftIsDateOnly(draft) || !isFlightDraftWithUnknownEndForImport(draft)) return
  metadata.timePrecision = 'start_only'
  metadata.endTimeSource = 'missing_or_unreadable'
  metadata.requiresManualTimeReview = true
  metadata.inferredEndTime = false
  metadata.displayTimeLabel = TANKESTROM_FLIGHT_MISSING_END_LABEL
}

function applyEventTimingMetadataForPersist(metadata: Record<string, unknown>, draft: TankestromEventDraft): void {
  applyDateOnlyMetadata(metadata, draftIsDateOnly(draft))
  applyFlightStartOnlyPersistMetadata(metadata, draft)
}

function buildPersistTimes(draft: TankestromEventDraft): { start: string; end: string } {
  if (!draftIsDateOnly(draft)) {
    if (isFlightDraftWithUnknownEndForImport(draft)) {
      const s = normalizeTimeInput(draft.start)
      return { start: s, end: s }
    }
    return {
      start: normalizeTimeInput(draft.start),
      end: normalizeTimeInput(draft.end),
    }
  }
  return {
    start: DATE_ONLY_FALLBACK_START,
    end: DATE_ONLY_FALLBACK_END,
  }
}

function buildPersistNotes(draft: Pick<TankestromEventDraft, 'notes' | 'start' | 'end'>): string | undefined {
  const base = draft.notes.trim()
  if (!draftIsDateOnly(draft)) return base || undefined
  const marker = 'Tidspunkt ikke avklart. Oppdater hendelsen når tidspunkt er kjent.'
  if (!base) return `(tid ikke avklart)\n${marker}`
  if (base.includes(marker)) return base
  return `${base}\n\n(tid ikke avklart)\n${marker}`
}

export function buildEventDraftFromProposal(
  p: PortalEventProposal,
  validPersonIds: Set<string>,
  people: Person[],
  defaultPersonId: string
): TankestromEventDraft {
  const ev = p.event
  const meta =
    ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata)
      ? (ev.metadata as Record<string, unknown>)
      : {}
  const transport =
    meta.transport && typeof meta.transport === 'object' && !Array.isArray(meta.transport)
      ? (meta.transport as { dropoffBy?: unknown; pickupBy?: unknown })
      : null
  const dropoffBy = typeof transport?.dropoffBy === 'string' ? transport.dropoffBy : ''
  const pickupBy = typeof transport?.pickupBy === 'string' ? transport.pickupBy : ''
  const metaParticipants = meta.participants
  const travelRaw = meta.travel
  const travelImportType =
    travelRaw && typeof travelRaw === 'object' && !Array.isArray(travelRaw)
      ? typeof (travelRaw as { type?: unknown }).type === 'string'
        ? (travelRaw as { type: string }).type
        : undefined
      : undefined
  const importSourceKind = typeof meta.sourceKind === 'string' ? meta.sourceKind : undefined
  const importRequiresPerson = meta.requiresPerson === true

  let pid: string
  let documentExtractedPersonName: string | undefined
  let personMatchStatus: TankestromPersonMatchStatus | undefined

  if (p.originalSourceType === MANUAL_REVIEW_SOURCE_TYPE) {
    pid = validPersonIds.has(ev.personId) ? ev.personId : defaultPersonId
    personMatchStatus = pid ? 'matched' : undefined
  } else {
    const trimmedApiPid = ev.personId.trim()
    if (trimmedApiPid && validPersonIds.has(trimmedApiPid)) {
      pid = trimmedApiPid
      personMatchStatus = 'matched'
    } else {
      const resolution = resolvePersonForImport(p, people)
      pid =
        resolution.personId != null && validPersonIds.has(resolution.personId) ? resolution.personId : ''
      personMatchStatus = resolution.status
      if (resolution.status === 'unmatched_document_name') {
        documentExtractedPersonName = resolution.extractedName
      }
    }
  }

  if (!documentExtractedPersonName) {
    const dn = meta.documentExtractedPersonName
    if (typeof dn === 'string' && dn.trim()) documentExtractedPersonName = dn.trim()
  }

  let participantPersonIds: string[] | undefined
  if (pid) {
    const fromMeta = Array.isArray(metaParticipants)
      ? metaParticipants.filter((x): x is string => typeof x === 'string' && validPersonIds.has(x))
      : []
    const merged = [...new Set([pid, ...fromMeta])]
    const orderedParticipants = [pid, ...merged.filter((id) => id !== pid)]
    participantPersonIds = orderedParticipants.length > 1 ? orderedParticipants : undefined
  }

  const title =
    isEmbeddedScheduleParentProposalItem(p)
      ? normalizeCalendarEventTitle(normalizeEmbeddedScheduleParentDisplayTitle(ev.title.trim()).title, {
          start: ev.start,
          end: ev.end,
        })
      : normalizeCalendarEventTitle(ev.title, { start: ev.start, end: ev.end })
  const isFlightImport = String(travelImportType ?? '').trim().toLowerCase() === 'flight'
  const shouldStripFlightEnd = isFlightImport && tankestromShouldStripSyntheticFlightEnd(travelImportType, meta)
  const draftEnd = shouldStripFlightEnd ? '' : ev.end
  if (shouldStripFlightEnd) {
    if (!ev.metadata || typeof ev.metadata !== 'object' || Array.isArray(ev.metadata)) {
      ev.metadata = {}
    }
    tankestromApplyStrippedFlightEndMetadata(ev.metadata as Record<string, unknown>)
  }
  return {
    title,
    date: ev.date,
    start: ev.start,
    end: draftEnd,
    personId: pid,
    personMatchStatus,
    importSourceKind,
    importRequiresPerson,
    travelImportType,
    isManualCalendarEntry: p.originalSourceType === MANUAL_REVIEW_SOURCE_TYPE,
    documentExtractedPersonName,
    participantPersonIds,
    location: ev.location ?? '',
    notes: ev.notes ?? '',
    reminderMinutes: typeof ev.reminderMinutes === 'number' ? ev.reminderMinutes : undefined,
    includeRecurrence: !!ev.recurrenceGroupId,
    dropoffBy,
    pickupBy,
  }
}

function buildTaskDraftFromProposal(
  p: PortalTaskProposal,
  validPersonIds: Set<string>,
  people: Person[],
  taskSourceLabelHint?: string
): TankestromTaskDraft {
  function normalizeTaskNotesText(s: string): string {
    return s.replace(/\r\n/g, '\n').trim()
  }

  function buildTaskNotesPrefill(proposal: PortalTaskProposal): string {
    const rawDetail = normalizeTaskNotesText(proposal.task.notes ?? '')
    const sourceLabel =
      taskSourceLabelHint?.trim() || proposal.originalSourceType?.trim() || 'Ukjent kilde'
    const sourceLine = `Fra: ${sourceLabel}`

    const lower = rawDetail.toLocaleLowerCase('nb-NO')
    const startsWithSource = lower.startsWith('fra:')
    const detailWithoutSource = startsWithSource
      ? rawDetail
          .split('\n')
          .slice(1)
          .join('\n')
          .trim()
      : rawDetail

    if (!detailWithoutSource) return sourceLine
    return `${sourceLine}\n\n${detailWithoutSource}`
  }

  const t = p.task
  const prefilledNotes = buildTaskNotesPrefill(p)
  const resolvedLabel =
    taskSourceLabelHint?.trim() || p.originalSourceType?.trim() || 'Ukjent kilde'
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
    console.debug('[tankestrom task notes prefill]', {
      proposalId: p.proposalId,
      originalSourceType: p.originalSourceType,
      parsedTaskNotes: t.notes,
      taskDraftPrefillNotes: prefilledNotes,
      taskSourceLabel: resolvedLabel,
      usedTechnicalSourceTypeOnly:
        !taskSourceLabelHint?.trim() && !!p.originalSourceType?.trim(),
    })
  }

  let childPersonId =
    t.childPersonId && validPersonIds.has(t.childPersonId) ? t.childPersonId : ''
  let assignedToPersonId =
    t.assignedToPersonId && validPersonIds.has(t.assignedToPersonId) ? t.assignedToPersonId : ''
  if (
    p.originalSourceType === MANUAL_REVIEW_SOURCE_TYPE &&
    !childPersonId &&
    !assignedToPersonId
  ) {
    childPersonId = defaultChildPersonId(people, validPersonIds)
  }
  const fromApi = normalizeTaskIntent(t.taskIntent)
  const suggested = suggestTaskIntentFromTitleAndNotes(t.title, t.notes)
  const taskIntent = fromApi ?? suggested
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
    console.debug('[tankestrom task intent]', {
      taskIntentSuggested: taskIntent,
      taskIntentDefaultedToMustDo: taskIntent === 'must_do' && !fromApi && suggested === 'must_do',
      proposalId: p.proposalId,
    })
  }
  return {
    title: t.title,
    date: t.date,
    notes: prefilledNotes,
    dueTime: t.dueTime ?? '',
    childPersonId,
    assignedToPersonId,
    showInMonthView: !!t.showInMonthView,
    taskIntent,
  }
}

function newManualReviewProposalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ts-manual-${crypto.randomUUID()}`
  }
  return `ts-manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function buildManualPlaceholderTask(defaultChildId: string): PortalTaskProposal {
  const today = new Date().toISOString().slice(0, 10)
  const proposalId = newManualReviewProposalId()
  return {
    proposalId,
    kind: 'task',
    sourceId: proposalId,
    originalSourceType: MANUAL_REVIEW_SOURCE_TYPE,
    confidence: 1,
    task: {
      date: today,
      title: '',
      notes: undefined,
      dueTime: undefined,
      childPersonId: defaultChildId,
      assignedToPersonId: undefined,
      taskIntent: 'must_do',
    },
  }
}

function buildManualPlaceholderEvent(defaultPersonId: string): PortalEventProposal {
  const today = new Date().toISOString().slice(0, 10)
  const proposalId = newManualReviewProposalId()
  return {
    proposalId,
    kind: 'event',
    sourceId: proposalId,
    originalSourceType: MANUAL_REVIEW_SOURCE_TYPE,
    confidence: 1,
    event: {
      date: today,
      personId: defaultPersonId,
      title: '',
      start: '09:00',
      end: '10:00',
    },
  }
}

function importDraftFromProposal(
  item: PortalEventProposal | PortalTaskProposal,
  validPersonIds: Set<string>,
  defaultPersonId: string,
  people: Person[],
  taskSourceLabelHint?: string
): TankestromImportDraft {
  if (item.kind === 'event') {
    return {
      importKind: 'event',
      event: buildEventDraftFromProposal(item, validPersonIds, people, defaultPersonId),
    }
  }
  return {
    importKind: 'task',
    task: buildTaskDraftFromProposal(item, validPersonIds, people, taskSourceLabelHint),
  }
}

function buildDraftsFromItems(
  items: PortalProposalItem[],
  validPersonIds: Set<string>,
  defaultPersonId: string,
  people: Person[],
  taskSourceLabelHint?: string
): Record<string, TankestromImportDraft> {
  const drafts: Record<string, TankestromImportDraft> = {}
  for (const item of items) {
    if (item.kind === 'school_profile') continue
    if (item.kind === 'event' || item.kind === 'task') {
      drafts[item.proposalId] = importDraftFromProposal(
        item,
        validPersonIds,
        defaultPersonId,
        people,
        taskSourceLabelHint
      )
    }
  }
  for (const item of items) {
    if (item.kind !== 'event' || !isEmbeddedScheduleParentCalendarItem(item)) continue
    const base = drafts[item.proposalId]
    if (!base || base.importKind !== 'event') continue
    const flat = flattenEmbeddedScheduleOrdered(item.event.metadata)
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
      console.debug('[tankestrom embedded schedule review]', {
        embeddedScheduleChildReviewItemsBuilt: flat.length,
        embeddedScheduleParentRetained: true,
        parentProposalId: item.proposalId,
      })
    }
    for (let i = 0; i < flat.length; i++) {
      const id = makeEmbeddedChildProposalId(item.proposalId, i)
      drafts[id] = {
        importKind: 'event',
        event: buildEmbeddedChildEventDraft(base.event, flat[i]!),
      }
    }
  }
  return drafts
}

function isSchoolProfileBundle(bundle: PortalImportProposalBundle): boolean {
  return bundle.items.length > 0 && bundle.items.every((i) => i.kind === 'school_profile')
}

function hasAnalyzeContent(bundle: PortalImportProposalBundle): boolean {
  return bundle.items.length > 0 || !!bundle.schoolWeekOverlayProposal
}

export { filterSubjectUpdatesByLanguageTrack } from '../../lib/schoolWeekOverlayFilters'

function overlayToChildWeekOverlay(
  proposal: PortalSchoolWeekOverlayProposal,
  childSchool?: ChildSchoolProfile
): SchoolWeekOverlay {
  const now = new Date()
  const fallbackWeekNumber = proposal.weekNumber ?? getISOWeek(now)
  const mappedDailyActions: SchoolWeekOverlay['dailyActions'] = {}
  const resolvedTrack = proposal.languageTrack?.resolvedTrack
  const valgfagTrack = inferValgfagTrackFromChildSchool(childSchool)
  const dbg =
    import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true'

  for (const [dayRaw, action] of Object.entries(proposal.dailyActions)) {
    if (!action) continue
    const day = Number(dayRaw)
    if (!Number.isInteger(day) || day < 0 || day > 6) continue
    let subjectUpdates = filterSubjectUpdatesByLanguageTrack(
      action.subjectUpdates,
      resolvedTrack,
      valgfagTrack
    )

    if (
      action.action === 'enrich_existing_school_block' &&
      childSchool &&
      day >= 0 &&
      day <= 4
    ) {
      const plan = childSchool.weekdays[day as WeekdayMonFri]
      if (plan && !plan.useSimpleDay && plan.lessons?.length) {
        const lessons = [...plan.lessons].sort((a, b) => a.start.localeCompare(b.start))
        const redistributed = redistributeEnrichSubjectUpdatesForDay(
          childSchool.gradeBand,
          lessons,
          subjectUpdates
        )
        subjectUpdates = redistributed
        if (dbg) {
          const placed = subjectUpdates.filter((u) => u.subjectKey !== 'other')
          const other = subjectUpdates.find((u) => u.subjectKey === 'other')
          const unplacedLines = other
            ? Object.values(other.sections ?? {}).reduce((n, l) => n + (l?.length ?? 0), 0)
            : 0
          const perLessonLineCounts = placed.map((u) =>
            Object.values(u.sections ?? {}).reduce((n, l) => n + (l?.length ?? 0), 0)
          )
          console.debug('[overlay apply enrich]', {
            day,
            overlayApplyMatchedSubjectBlocks: placed.length,
            overlayApplyUnplacedContent: unplacedLines,
            overlayApplySavedPerLessonCount: perLessonLineCounts,
          })
        }
      }
    }

    mappedDailyActions[day] = {
      action: action.action,
      reason: action.reason,
      summary: action.summary,
      subjectUpdates,
    }
  }
  return {
    id: proposal.proposalId,
    weekYear: getISOWeekYear(now),
    weekNumber: fallbackWeekNumber,
    sourceTitle: proposal.sourceTitle,
    originalSourceType: proposal.originalSourceType,
    weeklySummary: proposal.weeklySummary,
    classLabel: proposal.classLabel,
    languageTrack: proposal.languageTrack,
    profileMatch: proposal.profileMatch,
    dailyActions: mappedDailyActions,
    appliedAt: new Date().toISOString(),
  }
}

function cloneSchoolProfile(profile: ChildSchoolProfile): ChildSchoolProfile {
  return JSON.parse(JSON.stringify(profile)) as ChildSchoolProfile
}

function taskDraftFromEventDraft(e: TankestromEventDraft, people: Person[], validPersonIds: Set<string>): TankestromTaskDraft {
  const pid = validPersonIds.has(e.personId) ? e.personId : ''
  const person = people.find((p) => p.id === pid)
  const isChild = person?.memberKind === 'child'
  return {
    title: e.title,
    date: e.date,
    notes: e.notes,
    dueTime: isHm24(normalizeTimeInput(e.start)) ? normalizeTimeInput(e.start) : '',
    childPersonId: isChild ? pid : '',
    assignedToPersonId: !isChild && pid ? pid : '',
    showInMonthView: false,
    taskIntent: 'must_do',
  }
}

function eventDraftFromTaskDraft(t: TankestromTaskDraft, validPersonIds: Set<string>): TankestromEventDraft {
  const due = t.dueTime.trim()
  const start = due && isHm24(normalizeTimeInput(due)) ? normalizeTimeInput(due) : '09:00'
  const end = hmPlusMinutes(start, 60)
  let personId = ''
  if (t.childPersonId.trim() && validPersonIds.has(t.childPersonId)) personId = t.childPersonId
  else if (t.assignedToPersonId.trim() && validPersonIds.has(t.assignedToPersonId)) {
    personId = t.assignedToPersonId
  }
  return {
    title: t.title,
    date: t.date,
    start,
    end,
    personId,
    participantPersonIds: undefined,
    location: '',
    notes: t.notes,
    reminderMinutes: undefined,
    includeRecurrence: false,
    dropoffBy: '',
    pickupBy: '',
  }
}

export interface SchoolProfileReviewState {
  draft: ChildSchoolProfile
  meta: { confidence: number; originalSourceType: string }
  /**
   * TODO: remove school import debug after feilsøking
   * JSON av `ChildSchoolProfile` rett etter `parseChildSchoolProfile` / første `cloneSchoolProfile` (lag 2 → 3).
   * Ikke identisk med rå HTTP-body fra Tankestrøm (den lagres ikke i klienten).
   */
  parsedProfileSnapshotJson: string
}

export type TankestromEditEventFn = (
  date: string,
  event: Event,
  updates: Partial<
    Pick<Event, 'personId' | 'title' | 'start' | 'end' | 'notes' | 'location' | 'reminderMinutes' | 'metadata'>
  >,
  newDate?: string
) => Promise<void>

export interface UseTankestromImportOptions {
  open: boolean
  people: Person[]
  createEvent: (date: string, input: Omit<Event, 'id'>) => Promise<void>
  createTask: (input: Omit<Task, 'id'>) => Promise<void>
  /** Oppdater eksisterende hendelse ved import (valgfri MVP). */
  editEvent?: TankestromEditEventFn
  /** Eksisterende forgrunnshendelser for konservativ match i review. */
  getAnchoredForegroundEventsForMatching?: () => { event: Event; anchorDate: string }[]
  /** Prefetch kalenderhendelser for import-datoer ±7 dager (slik at matching ser hele kalenderen). */
  prefetchEventsForDateRange?: (
    startDate: string,
    endDate: string
  ) => void | Promise<void | Record<string, Event[]>>
  /** Slett overflødige dag-rader etter oppdatering av programforelder (valgfritt). */
  deleteEvent?: (date: string, eventId: string) => Promise<void>
  /** Kreves for lagring av timeplan-import (skoleprofil). */
  updatePerson?: (
    id: string,
    updates: Partial<Pick<Person, 'name' | 'colorTint' | 'colorAccent' | 'memberKind' | 'school' | 'work'>>
  ) => Promise<void>
}

export function useTankestromImport({
  open,
  people,
  createEvent,
  createTask,
  editEvent,
  getAnchoredForegroundEventsForMatching,
  prefetchEventsForDateRange,
  deleteEvent,
  updatePerson,
}: UseTankestromImportOptions) {
  const [step, setStep] = useState<Step>('pick')
  const [inputMode, setInputMode] = useState<TankestromInputMode>('file')
  const [pendingFiles, setPendingFiles] = useState<TankestromPendingFile[]>([])
  const [textInput, setTextInput] = useState('')
  const [bundle, setBundle] = useState<PortalImportProposalBundle | null>(null)
  /** Tekstlengde eller summerte filstørrelser (bytes) ved siste vellykkede analyse — for lang-dokument-klassifisering. */
  const [analyzedSourceLength, setAnalyzedSourceLength] = useState(0)
  const [schoolReview, setSchoolReview] = useState<SchoolProfileReviewState | null>(null)
  const [schoolProfileChildId, setSchoolProfileChildId] = useState('')

  const proposalItems = useMemo((): PortalProposalItem[] => bundle?.items ?? [], [bundle])

  const calendarProposalItems = useMemo(
    (): PortalProposalItem[] => proposalItems.filter((i) => i.kind !== 'school_profile'),
    [proposalItems]
  )

  const importClassificationContext = useMemo((): ImportClassificationContext | undefined => {
    if (!bundle) return undefined
    const calendarItemCount = bundle.items.filter((i) => i.kind !== 'school_profile').length
    const secondaryCandidateCount = bundle.secondaryCandidates?.length ?? 0
    const sourceLen =
      analyzedSourceLength > 0
        ? analyzedSourceLength
        : inputMode === 'text'
          ? textInput.length
          : 0
    return buildImportClassificationContext({
      inputMode,
      provenanceSourceType: bundle.provenance.sourceType,
      sourceLength: sourceLen,
      calendarItemCount,
      secondaryCandidateCount,
    })
  }, [bundle, inputMode, analyzedSourceLength, textInput])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastImportAttempt, setLastImportAttempt] = useState<TankestromImportLastAttempt | null>(null)
  /** Kandidater i «Kanskje også relevant» som brukeren har skjult. */
  const [secondaryDismissedCandidateIds, setSecondaryDismissedCandidateIds] = useState<Set<string>>(
    () => new Set()
  )
  /** Lav-sikkerhetsforslag som er løftet inn i hovedlisten. */
  const [secondaryPromotedProposalIds, setSecondaryPromotedProposalIds] = useState<Set<string>>(
    () => new Set()
  )
  const secondaryShownLogKeyRef = useRef('')

  const primaryCalendarProposalItems = useMemo((): PortalProposalItem[] => {
    return calendarProposalItems.filter((it) => {
      if (it.kind !== 'event' && it.kind !== 'task') return true
      if (secondaryPromotedProposalIds.has(it.proposalId)) return true
      if (proposalItemQualifiesSecondaryZone(it, importClassificationContext)) return false
      return true
    })
  }, [calendarProposalItems, secondaryPromotedProposalIds, importClassificationContext])

  const mergedSecondaryImportCandidates = useMemo(
    () => buildMergedSecondaryImportCandidates(bundle, calendarProposalItems, importClassificationContext),
    [bundle, calendarProposalItems, importClassificationContext]
  )

  const visibleSecondaryImportCandidates = useMemo(() => {
    const base = filterVisibleSecondaryCandidates(
      mergedSecondaryImportCandidates,
      secondaryDismissedCandidateIds,
      secondaryPromotedProposalIds
    )
    return base.filter((c) => {
      if (!c.sourceProposalId) return true
      const it = calendarProposalItems.find((i) => i.proposalId === c.sourceProposalId)
      if (!it || (it.kind !== 'event' && it.kind !== 'task')) return true
      if (!proposalItemQualifiesSecondaryZone(it, importClassificationContext)) return false
      return true
    })
  }, [
    mergedSecondaryImportCandidates,
    secondaryDismissedCandidateIds,
    secondaryPromotedProposalIds,
    calendarProposalItems,
    importClassificationContext,
  ])

  useEffect(() => {
    if (step !== 'review' || schoolReview != null || visibleSecondaryImportCandidates.length === 0) return
    const key = `${bundle?.provenance.importRunId ?? 'norun'}:${visibleSecondaryImportCandidates
      .map((c) => c.candidateId)
      .join('|')}`
    if (secondaryShownLogKeyRef.current === key) return
    secondaryShownLogKeyRef.current = key
    logEvent('secondaryCandidateShown', {
      candidateIds: visibleSecondaryImportCandidates.map((c) => c.candidateId),
      count: visibleSecondaryImportCandidates.length,
      importRunId: bundle?.provenance.importRunId,
    })
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
      console.debug('[tankestrom secondary zone]', {
        secondaryCandidateShown: true,
        candidateIds: visibleSecondaryImportCandidates.map((c) => c.candidateId),
      })
    }
  }, [step, schoolReview, bundle?.provenance.importRunId, visibleSecondaryImportCandidates])

  /** @deprecated Bruk proposalItems; beholdt for enkel bakoverkompatibilitet i imports. */
  const eventProposals = useMemo((): PortalEventProposal[] => {
    return proposalItems.filter((i): i is PortalEventProposal => i.kind === 'event')
  }, [proposalItems])

  const [draftByProposalId, setDraftByProposalId] = useState<Record<string, TankestromImportDraft>>({})
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyzeWarning, setAnalyzeWarning] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setLastImportAttempt(null)
  }, [open])

  /** Gjenstående program-rader per forelder (løsnede er fjernet fra listen). */
  const [embeddedScheduleReviewRowsByParentId, setEmbeddedScheduleReviewRowsByParentId] = useState<
    Record<string, EmbeddedScheduleReviewRow[]>
  >({})
  const [detachedEmbeddedChildren, setDetachedEmbeddedChildren] = useState<
    Array<{ proposal: PortalEventProposal; parentProposalId: string }>
  >([])
  const [detachedEmbeddedChildIds, setDetachedEmbeddedChildIds] = useState<Set<string>>(() => new Set())

  const [existingEventLinkByProposalId, setExistingEventLinkByProposalId] = useState<
    Record<string, 'new' | 'update' | 'skip'>
  >({})
  const [existingEventUpdateTarget, setExistingEventUpdateTarget] = useState<
    Record<string, { eventId: string; anchorDate: string }>
  >({})

  const embeddedRowsRef = useRef(embeddedScheduleReviewRowsByParentId)
  const detachedIdsRef = useRef(detachedEmbeddedChildIds)
  const detachedListRef = useRef(detachedEmbeddedChildren)
  useEffect(() => {
    embeddedRowsRef.current = embeddedScheduleReviewRowsByParentId
  }, [embeddedScheduleReviewRowsByParentId])
  useEffect(() => {
    detachedIdsRef.current = detachedEmbeddedChildIds
  }, [detachedEmbeddedChildIds])
  useEffect(() => {
    detachedListRef.current = detachedEmbeddedChildren
  }, [detachedEmbeddedChildren])

  const validPersonIds = useMemo(() => new Set(people.map((p) => p.id)), [people])

  const canApproveSelection = useMemo(() => {
    if (schoolReview) return false
    if (selectedIds.size === 0) return false
    for (const id of selectedIds) {
      const draft = draftByProposalId[id]
      if (!draft) return false
      if (validateUnifiedDraft(draft, validPersonIds) != null) return false
    }
    return true
  }, [schoolReview, selectedIds, draftByProposalId, validPersonIds])

  const canSaveSchoolProfile = useMemo(() => {
    if (!schoolReview || !updatePerson) return false
    if (detectLessonConflicts(schoolReview.draft).length > 0) return false
    const cid = schoolProfileChildId.trim()
    if (!cid) return false
    const child = people.find((p) => p.id === cid && p.memberKind === 'child')
    return !!child
  }, [schoolReview, schoolProfileChildId, people, updatePerson])

  const canSaveSchoolWeekOverlay = useMemo(() => {
    const overlay = bundle?.schoolWeekOverlayProposal
    if (!overlay || !updatePerson) return false
    const cid = schoolProfileChildId.trim()
    if (!cid) return false
    const child = people.find((p) => p.id === cid && p.memberKind === 'child')
    return !!child
  }, [bundle?.schoolWeekOverlayProposal, schoolProfileChildId, people, updatePerson])

  const existingEventMatchesByProposalId = useMemo((): Record<string, ExistingEventMatchResult> => {
    if (step !== 'review' || !bundle) return {}
    const anchored = getAnchoredForegroundEventsForMatching?.() ?? []
    const out: Record<string, ExistingEventMatchResult> = {}
    for (const item of primaryCalendarProposalItems) {
      if (item.kind !== 'event') continue
      const draftWrap = draftByProposalId[item.proposalId]
      if (!draftWrap || draftWrap.importKind !== 'event') continue
      const range = proposalImportDateRangeForMatch(
        item,
        draftWrap.event,
        embeddedScheduleReviewRowsByParentId[item.proposalId]
      )
      if (!range) continue
      const pid = draftWrap.event.personId.trim()
      out[item.proposalId] = findConservativeExistingEventMatch(
        item,
        draftWrap.event.title.trim(),
        range.start,
        range.end,
        pid,
        anchored
      )
    }
    return out
  }, [
    step,
    bundle,
    primaryCalendarProposalItems,
    draftByProposalId,
    getAnchoredForegroundEventsForMatching,
    embeddedScheduleReviewRowsByParentId,
  ])

  const prefetchImportMatchRangeRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open || step === 'pick') {
      prefetchImportMatchRangeRef.current = null
    }
  }, [open, step])

  useEffect(() => {
    if (step !== 'review' || !bundle || !prefetchEventsForDateRange) return
    const dates: string[] = []
    for (const item of primaryCalendarProposalItems) {
      if (item.kind !== 'event') continue
      const draftWrap = draftByProposalId[item.proposalId]
      if (!draftWrap || draftWrap.importKind !== 'event') continue
      const range = proposalImportDateRangeForMatch(
        item,
        draftWrap.event,
        embeddedScheduleReviewRowsByParentId[item.proposalId]
      )
      if (range) {
        const inc = getIncomingArrangementRange(item, range.start, range.end)
        dates.push(inc.start, inc.end)
      }
      const meta = item.event.metadata
      if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        for (const seg of parseEmbeddedScheduleFromMetadata(meta as EventMetadata)) {
          dates.push(seg.date)
        }
      }
    }
    const valid = dates.filter((d) => DATE_KEY_RE.test(d))
    if (valid.length === 0) return
    const sorted = [...new Set(valid)].sort()
    const from = addCalendarDaysOslo(sorted[0]!, -7)
    const to = addCalendarDaysOslo(sorted[sorted.length - 1]!, 7)
    const key = `${from}|${to}`
    if (prefetchImportMatchRangeRef.current === key) return
    prefetchImportMatchRangeRef.current = key
    void prefetchEventsForDateRange(from, to)
  }, [
    step,
    bundle,
    prefetchEventsForDateRange,
    primaryCalendarProposalItems,
    draftByProposalId,
    embeddedScheduleReviewRowsByParentId,
  ])

  useLayoutEffect(() => {
    if (step !== 'review' || !bundle) return
    const proposals = primaryCalendarProposalItems
      .filter((p): p is PortalEventProposal => p.kind === 'event')
      .map((p) => ({
        proposalId: p.proposalId,
        title: p.event?.title,
        personId: p.event?.personId,
        start: p.event?.start,
        end: p.event?.end,
        metadata: {
          arrangementStableKey: p.event?.metadata?.arrangementStableKey,
          arrangementCoreTitle: p.event?.metadata?.arrangementCoreTitle,
          embeddedSchedule: p.event?.metadata?.embeddedSchedule,
          updateIntent: p.event?.metadata?.updateIntent,
        },
      }))
    const anchored = getAnchoredForegroundEventsForMatching?.() ?? []
    const existingEventsLoaded = anchored.map(({ event: e }) => ({
      id: e.id,
      title: e.title,
      personId: e.personId,
      participants: getEventParticipantIds(e),
      start: e.start,
      end: e.end,
      metadata: {
        arrangementStableKey: e.metadata?.arrangementStableKey,
        arrangementCoreTitle: e.metadata?.arrangementCoreTitle,
      },
    }))
    const matchesByProposalId = Object.fromEntries(
      Object.entries(existingEventMatchesByProposalId).map(([proposalId, match]) => [
        proposalId,
        {
          matchStatus: match?.matchStatus,
          eventId: match?.candidate?.event.id,
          eventTitle: match?.candidate?.event.title,
          score: match?.score,
          reasons: match?.reasons,
          defaultAction: match?.defaultAction,
          rejectReason: match?.rejectReason,
          importMatchTrace: match?.importMatchTrace,
        },
      ])
    )
    console.info('[Tankestrom import match debug]', {
      proposals,
      existingEventsLoaded,
      matchesByProposalId,
    })
  }, [
    step,
    bundle,
    primaryCalendarProposalItems,
    existingEventMatchesByProposalId,
    getAnchoredForegroundEventsForMatching,
  ])

  useEffect(() => {
    if (step !== 'review' || !bundle) return
    for (const item of primaryCalendarProposalItems) {
      if (item.kind !== 'event') continue
      const draftWrap = draftByProposalId[item.proposalId]
      if (!draftWrap || draftWrap.importKind !== 'event') continue
      const incomingDraft = draftWrap.event
      const meta = item.event.metadata
      const match = existingEventMatchesByProposalId[item.proposalId]
      console.info('[Tankestrom match result]', {
        incomingTitle: incomingDraft.title,
        incomingStableKey: readArrangementStableKey(meta),
        incomingUpdateIntent:
          meta && typeof meta === 'object' && !Array.isArray(meta)
            ? (meta as Record<string, unknown>).updateIntent
            : undefined,
        matched: Boolean(match && !match.rejected && match.candidate),
        matchStatus: match?.matchStatus,
        score: match?.score,
        matchedEventTitle: match?.candidate?.event.title,
        matchedEventId: match?.candidate?.event.id,
        reasons: match?.reasons,
      })
    }
  }, [step, bundle, primaryCalendarProposalItems, draftByProposalId, existingEventMatchesByProposalId])

  const setExistingEventImportLink = useCallback(
    (
      proposalId: string,
      choice: 'new' | 'update' | 'skip',
      updateTarget?: { eventId: string; anchorDate: string }
    ) => {
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
        console.debug('[tankestrom existing event link]', {
          existingEventLinkChoiceResolved: choice,
          existingEventUpdateModeSelected: choice,
          proposalId,
          updateTarget,
        })
      }
      setExistingEventLinkByProposalId((prev) => ({ ...prev, [proposalId]: choice }))
      if (choice === 'new' || choice === 'skip') {
        setExistingEventUpdateTarget((prev) => {
          const n = { ...prev }
          delete n[proposalId]
          return n
        })
      } else if (choice === 'update' && updateTarget) {
        setExistingEventUpdateTarget((prev) => ({ ...prev, [proposalId]: updateTarget }))
      }
    },
    []
  )

  const prevSchoolChildForLangAdjustRef = useRef<string | null>(null)

  const reset = useCallback(() => {
    setStep('pick')
    setInputMode('file')
    setPendingFiles([])
    setTextInput('')
    setBundle(null)
    setAnalyzedSourceLength(0)
    setSchoolReview(null)
    setSchoolProfileChildId('')
    setSelectedIds(new Set())
    setSecondaryDismissedCandidateIds(new Set())
    setSecondaryPromotedProposalIds(new Set())
    setDraftByProposalId({})
    setEmbeddedScheduleReviewRowsByParentId({})
    setDetachedEmbeddedChildren([])
    setDetachedEmbeddedChildIds(new Set())
    setExistingEventLinkByProposalId({})
    setExistingEventUpdateTarget({})
    setAnalyzeLoading(false)
    setSaveLoading(false)
    setError(null)
    setAnalyzeWarning(null)
    prevSchoolChildForLangAdjustRef.current = null
  }, [])

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  /** Etter bytte av globalt barn: fjern huk for språk-mismatch; ta med matchende språk-oppgaver. */
  useEffect(() => {
    if (step !== 'review' || schoolReview != null || !bundle) return
    const cid = schoolProfileChildId
    const prev = prevSchoolChildForLangAdjustRef.current
    if (prev === null) {
      prevSchoolChildForLangAdjustRef.current = cid
      return
    }
    if (prev === cid) return
    prevSchoolChildForLangAdjustRef.current = cid

    const child = people.find((p) => p.id === cid && p.memberKind === 'child')
    const languageDiag = resolveLanguageTrackDiagnostics(child?.school)
    const languageTrackInfo = inferredLessonTrackForSubject(child?.school, 'fremmedspråk')
    const valgfagTrackInfo = inferredLessonTrackForSubject(child?.school, 'valgfag')
    const track = languageDiag.resolvedLanguageTrack
    const valgfagTrack = valgfagTrackInfo.track
    let deselected = 0
    let selectedMatch = 0

    setSelectedIds((sel) => {
      const next = new Set(sel)
      for (const item of bundle.items) {
        if (item.kind !== 'task') continue
        const d = draftByProposalId[item.proposalId]
        if (!d || d.importKind !== 'task') continue
        const body = scanNotesBodyForLanguage(d.task.notes)
        const mismatch =
          taskIndicatesForeignLanguageMismatchWithTrack(d.task.title, body, track) ||
          taskIndicatesValgfagMismatchWithTrack(d.task.title, body, valgfagTrack)
        const langSignal = taskMentionsCatalogForeignLanguage(d.task.title, body)
        if (mismatch) {
          if (next.delete(item.proposalId)) deselected += 1
        } else if (track && langSignal) {
          if (!next.has(item.proposalId)) selectedMatch += 1
          next.add(item.proposalId)
        }
      }
      return next
    })

    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
      console.debug('[tankestrom task language on child change]', {
        reviewLanguageTrack: track,
        resolvedLanguageTrack: languageDiag.resolvedLanguageTrack,
        resolvedLanguageTrackSource: languageDiag.resolvedLanguageTrackSource,
        childSchoolLanguageCandidates: languageDiag.childSchoolLanguageCandidates,
        languageLessonSubjectKeys: languageDiag.languageLessonSubjectKeys,
        languageLessonSubcategories: languageDiag.languageLessonSubcategories,
        languageLessonCustomLabels: languageDiag.languageLessonCustomLabels,
        childLessonSubcategoryTrack: { language: track, valgfag: valgfagTrack },
        usedLessonSubcategoryForFiltering: !!(track || valgfagTrack),
        usedCustomLabelFallbackTrack:
          languageTrackInfo.usedCustomLabelFallbackTrack || valgfagTrackInfo.usedCustomLabelFallbackTrack,
        taskDeselectedBecauseLanguageMismatch: deselected,
        taskRejectedByStoredTrackMismatch: deselected,
        taskSelectedBecauseLanguageMatch: selectedMatch,
      })
    }
  }, [schoolProfileChildId, bundle, step, schoolReview, draftByProposalId, people])

  useEffect(() => {
    if (!bundle || step !== 'review' || schoolReview != null) {
      if (!bundle) {
        setEmbeddedScheduleReviewRowsByParentId({})
        setDetachedEmbeddedChildren([])
        setDetachedEmbeddedChildIds(new Set())
      }
      return
    }
    const map: Record<string, EmbeddedScheduleReviewRow[]> = {}
    for (const item of bundle.items) {
      if (item.kind !== 'event') continue
      const rawSched = item.event.metadata?.embeddedSchedule
      const hasRawSchedule = Array.isArray(rawSched) && rawSched.length > 0
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
        if (hasRawSchedule) {
          const h = evaluateEmbeddedScheduleParentCardHeuristic(item)
          if (h.ok) {
            console.debug('[tankestrom embedded parent heuristic]', {
              embeddedScheduleParentCardHeuristicMatched: true,
              embeddedScheduleParentCardMatchedFields: h.matchedFields,
              parentProposalId: item.proposalId,
            })
          } else {
            console.debug('[tankestrom embedded parent heuristic]', {
              embeddedScheduleParentCardHeuristicRejected: true,
              embeddedScheduleParentCardRejectedReason: h.reason,
              embeddedScheduleParentCardMatchedFields: h.matchedFields,
              embeddedScheduleParentCardExpectedButMissing: h.expectedButMissing,
              parentProposalId: item.proposalId,
            })
          }
        }
      }
      if (!isEmbeddedScheduleParentCalendarItem(item)) continue
      const flat = flattenEmbeddedScheduleOrdered(item.event.metadata)
      map[item.proposalId] = flat.map((segment, i) => ({ origIndex: i, segment }))
    }
    setEmbeddedScheduleReviewRowsByParentId(map)
    setDetachedEmbeddedChildren([])
    setDetachedEmbeddedChildIds(new Set())
  }, [bundle, step, schoolReview])

  const addFilesFromList = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list)
    if (arr.length === 0) return
    setError(null)
    setAnalyzeWarning(null)
    setPendingFiles((prev) => [
      ...prev,
      ...arr.map((file) => ({
        id: newPendingFileId(),
        file,
        status: 'ready' as const,
      })),
    ])
  }, [])

  const removePendingFile = useCallback((id: string) => {
    if (analyzeLoading) return
    setPendingFiles((prev) => prev.filter((p) => p.id !== id))
    setError(null)
  }, [analyzeLoading])

  /** Bakoverkompatibilitet: første valgte fil (samme som tidligere enkeltfil). */
  const file = pendingFiles[0]?.file ?? null

  const setInputModeSafe = useCallback((mode: TankestromInputMode) => {
    setInputMode(mode)
    setError(null)
    setAnalyzeWarning(null)
  }, [])

  const setTextInputSafe = useCallback((value: string) => {
    setTextInput(value)
    setError(null)
  }, [])

  const toggleProposal = useCallback((proposalId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const parsed = parseEmbeddedChildProposalId(proposalId)
      if (parsed) {
        if (next.has(proposalId)) next.delete(proposalId)
        else next.add(proposalId)
        return next
      }
      const rowsState = embeddedRowsRef.current
      const detachedSet = detachedIdsRef.current
      const detachedList = detachedListRef.current
      if (next.has(proposalId)) {
        next.delete(proposalId)
        for (const row of rowsState[proposalId] ?? []) {
          const cid = makeEmbeddedChildProposalId(proposalId, row.origIndex)
          next.delete(cid)
        }
        for (const d of detachedList) {
          if (d.parentProposalId === proposalId) next.delete(d.proposal.proposalId)
        }
      } else {
        next.add(proposalId)
        for (const row of rowsState[proposalId] ?? []) {
          const cid = makeEmbeddedChildProposalId(proposalId, row.origIndex)
          if (!detachedSet.has(cid)) next.add(cid)
        }
        for (const d of detachedList) {
          if (d.parentProposalId === proposalId) next.add(d.proposal.proposalId)
        }
      }
      return next
    })
  }, [])

  const detachEmbeddedScheduleChild = useCallback((parentProposalId: string, origIndex: number) => {
    const childId = makeEmbeddedChildProposalId(parentProposalId, origIndex)
    let removedRow: EmbeddedScheduleReviewRow | undefined
    setEmbeddedScheduleReviewRowsByParentId((prev) => {
      const rows = prev[parentProposalId]
      if (!rows) return prev
      removedRow = rows.find((r) => r.origIndex === origIndex)
      if (!removedRow) return prev
      return {
        ...prev,
        [parentProposalId]: rows.filter((r) => r.origIndex !== origIndex),
      }
    })
    if (!removedRow) return

    const parentItem = proposalItems.find(
      (i): i is PortalEventProposal => i.kind === 'event' && i.proposalId === parentProposalId
    )
    if (!parentItem) return

    const synthetic = buildDetachedEmbeddedChildProposal(parentItem, removedRow.segment, origIndex)
    setDetachedEmbeddedChildren((prev) => [...prev.filter((d) => d.proposal.proposalId !== childId), { proposal: synthetic, parentProposalId }])
    setDetachedEmbeddedChildIds((prev) => new Set(prev).add(childId))

    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
      console.debug('[tankestrom embedded schedule review]', {
        embeddedScheduleChildDetached: true,
        embeddedScheduleParentRetained: true,
        parentProposalId,
        childProposalId: childId,
      })
    }
  }, [proposalItems])

  /**
   * Oppdaterer ett innebygd programpunkt i review og synker tilsvarende barn-utkast (forblir under samme forelder).
   */
  const updateEmbeddedScheduleSegment = useCallback(
    (
      parentProposalId: string,
      origIndex: number,
      segmentPatch: Partial<EmbeddedScheduleSegment>,
      opts?: { personId?: string }
    ) => {
      let mergedSegment: EmbeddedScheduleSegment | undefined
      setEmbeddedScheduleReviewRowsByParentId((prev) => {
        const rows = prev[parentProposalId]
        if (!rows) return prev
        const nextRows = rows.map((r) => {
          if (r.origIndex !== origIndex) return r
          mergedSegment = { ...r.segment, ...segmentPatch }
          return { origIndex, segment: mergedSegment }
        })
        if (!mergedSegment) return prev
        return { ...prev, [parentProposalId]: nextRows }
      })
      if (!mergedSegment) return
      const segmentForChild = mergedSegment

      setDraftByProposalId((prev) => {
        const parentDraftEntry = prev[parentProposalId]
        if (!parentDraftEntry || parentDraftEntry.importKind !== 'event') return prev
        const childId = makeEmbeddedChildProposalId(parentProposalId, origIndex)
        const baseChild = buildEmbeddedChildEventDraft(parentDraftEntry.event, segmentForChild)
        const prevChild = prev[childId]
        let personId = baseChild.personId
        let participantPersonIds = baseChild.participantPersonIds
        if (opts?.personId !== undefined) {
          if (validPersonIds.has(opts.personId)) {
            personId = opts.personId
            participantPersonIds = undefined
          }
        } else if (prevChild?.importKind === 'event') {
          personId = prevChild.event.personId
          participantPersonIds = prevChild.event.participantPersonIds
        }
        return {
          ...prev,
          [childId]: { importKind: 'event', event: { ...baseChild, personId, participantPersonIds } },
        }
      })
    },
    [validPersonIds]
  )

  const updateEventDraft = useCallback((proposalId: string, patch: Partial<TankestromEventDraft>) => {
    setDraftByProposalId((prev) => {
      const cur = prev[proposalId]
      if (!cur || cur.importKind !== 'event') return prev
      const merged: TankestromEventDraft = { ...cur.event, ...patch }
      if (patch.personId !== undefined && patch.participantPersonIds === undefined) {
        merged.participantPersonIds = undefined
      }
      if (
        (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') &&
        patch.personId != null &&
        patch.personId !== cur.event.personId
      ) {
        console.debug('[tankestrom review person]', {
          reviewPersonOverridePerCard: proposalId,
          personId: patch.personId,
        })
      }
      return { ...prev, [proposalId]: { importKind: 'event', event: merged } }
    })
  }, [])

  const applyReviewBulkPersonTargets = useCallback(
    (rawPersonIds: string[], scope: 'selected' | 'all_calendar') => {
      const personIds = [...new Set(rawPersonIds.filter((id) => validPersonIds.has(id)))]
      if (personIds.length === 0) return

      const primary = personIds[0]!
      const participantPersonIds = personIds.length > 1 ? [...personIds] : undefined
      const taskFields = bulkApplyTaskPersonFields(people, validPersonIds, personIds)

      setDraftByProposalId((prev) => {
        const targetIds =
          scope === 'all_calendar' ? Object.keys(prev) : [...selectedIds].filter((id) => prev[id])

        const next = { ...prev }
        for (const proposalId of targetIds) {
          const cur = next[proposalId]
          if (!cur) continue
          if (cur.importKind === 'event') {
            next[proposalId] = {
              importKind: 'event',
              event: {
                ...cur.event,
                personId: primary,
                participantPersonIds,
              },
            }
          } else {
            next[proposalId] = {
              importKind: 'task',
              task: { ...cur.task, ...taskFields },
            }
          }
        }
        return next
      })

      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
        console.debug('[tankestrom review bulk person]', {
          reviewBulkPersonSelectionApplied: true,
          reviewParentChildPersonInheritanceApplied: true,
          scope,
          personIds,
          primaryPersonId: primary,
          eventParticipantCount: participantPersonIds?.length ?? 1,
        })
      }
    },
    [people, validPersonIds, selectedIds]
  )

  const updateTaskDraft = useCallback((proposalId: string, patch: Partial<TankestromTaskDraft>) => {
    setDraftByProposalId((prev) => {
      const cur = prev[proposalId]
      if (!cur || cur.importKind !== 'task') return prev
      const nextTask = { ...cur.task, ...patch }
      if (
        (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') &&
        patch.taskIntent != null &&
        patch.taskIntent !== cur.task.taskIntent
      ) {
        console.debug('[tankestrom task intent]', {
          taskIntentChangedInReview: patch.taskIntent,
          proposalId,
        })
      }
      return { ...prev, [proposalId]: { importKind: 'task', task: nextTask } }
    })
  }, [])

  const setSchoolProfileDraft = useCallback((next: ChildSchoolProfile) => {
    setSchoolReview((prev) => {
      if (!prev) return null
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
        console.debug('[school import draft update]', {
          before: prev.draft,
          after: next,
        })
        // #region agent log
        fetch('http://127.0.0.1:7535/ingest/049b3e24-eef8-4d09-b78d-4e257b02a969',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4d90a0'},body:JSON.stringify({sessionId:'4d90a0',runId:'school-review-trace-v1',hypothesisId:'H4',location:'useTankestromImport.ts:452',message:'setSchoolProfileDraft called',data:{before:prev.draft,after:next},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
      }
      return { ...prev, draft: next }
    })
  }, [])

  const setProposalImportKind = useCallback(
    (proposalId: string, importKind: 'event' | 'task') => {
      if (importKind === 'task') {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          for (const sid of next) {
            const p = parseEmbeddedChildProposalId(sid)
            if (p?.parentProposalId === proposalId) next.delete(sid)
          }
          return next
        })
        setEmbeddedScheduleReviewRowsByParentId((prev) => {
          if (!(proposalId in prev)) return prev
          const n = { ...prev }
          delete n[proposalId]
          return n
        })
        setDetachedEmbeddedChildren((prev) => prev.filter((d) => d.parentProposalId !== proposalId))
        setDetachedEmbeddedChildIds((prev) => {
          const next = new Set(prev)
          let changed = false
          for (const sid of prev) {
            const p = parseEmbeddedChildProposalId(sid)
            if (p?.parentProposalId === proposalId) {
              next.delete(sid)
              changed = true
            }
          }
          return changed ? next : prev
        })
      }
      setDraftByProposalId((prev) => {
        let base: Record<string, TankestromImportDraft> = { ...prev }
        if (importKind === 'task') {
          for (const key of Object.keys(base)) {
            const p = parseEmbeddedChildProposalId(key)
            if (p?.parentProposalId === proposalId) delete base[key]
          }
        }
        const cur = base[proposalId]
        if (!cur) return prev
        if (importKind === 'task') {
          if (cur.importKind === 'task') return base
          return {
            ...base,
            [proposalId]: { importKind: 'task', task: taskDraftFromEventDraft(cur.event, people, validPersonIds) },
          }
        }
        if (cur.importKind === 'event') return prev
        return {
          ...base,
          [proposalId]: {
            importKind: 'event',
            event: eventDraftFromTaskDraft(cur.task, validPersonIds),
          },
        }
      })
    },
    [people, validPersonIds]
  )

  const patchPendingFile = useCallback((id: string, patch: Partial<Pick<TankestromPendingFile, 'status' | 'statusDetail'>>) => {
    setPendingFiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const runAnalyze = useCallback(async (): Promise<boolean> => {
    if (inputMode === 'file') {
      if (pendingFiles.length === 0) {
        setError('Velg minst én fil.')
        return false
      }
    } else if (!textInput.trim()) {
      setError('Skriv inn tekst først.')
      return false
    }
    setError(null)
    setAnalyzeWarning(null)
    setAnalyzeLoading(true)
    try {
      if (inputMode === 'text') {
        const b = await analyzeTextWithTankestrom(textInput)
        if (isSchoolProfileBundle(b)) {
          setBundle(b)
          const schoolItems = b.items.filter((i): i is PortalSchoolProfileProposal => i.kind === 'school_profile')
          const primary = schoolItems[0]!
          const childIds = people.filter((p) => p.memberKind === 'child').map((p) => p.id)
          const initialChild =
            primary.suggestedPersonId && childIds.includes(primary.suggestedPersonId)
              ? primary.suggestedPersonId
              : (childIds[0] ?? '')
          setSchoolProfileChildId(initialChild)
          const parsedProfileSnapshotJson = JSON.stringify(primary.schoolProfile, null, 2)
          setSchoolReview({
            draft: cloneSchoolProfile(primary.schoolProfile),
            meta: { confidence: primary.confidence, originalSourceType: primary.originalSourceType },
            parsedProfileSnapshotJson,
          })
          // #region agent log
          fetch('http://127.0.0.1:7535/ingest/049b3e24-eef8-4d09-b78d-4e257b02a969',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4d90a0'},body:JSON.stringify({sessionId:'4d90a0',runId:'school-review-trace-v1',hypothesisId:'H1',location:'useTankestromImport.ts:518',message:'setSchoolReview from parsed snapshot (text mode)',data:{gradeBand:primary.schoolProfile.gradeBand,weekdays:primary.schoolProfile.weekdays},timestamp:Date.now()})}).catch(()=>{})
          // #endregion
          if (import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
            console.debug('[tankestrom school import] text path: parsed profile (etter API)', {
              gradeBand: primary.schoolProfile.gradeBand,
              weekdays: primary.schoolProfile.weekdays,
              snapshotJsonLength: parsedProfileSnapshotJson.length,
            })
          }
          setDraftByProposalId({})
          setSelectedIds(new Set())
          if (schoolItems.length > 1) {
            setAnalyzeWarning('Flere timeplaner i svaret — kun den første brukes.')
          }
          setStep('review')
          return true
        }
        setSchoolReview(null)
        setSecondaryDismissedCandidateIds(new Set())
        setSecondaryPromotedProposalIds(new Set())
        const childIds = people.filter((p) => p.memberKind === 'child').map((p) => p.id)
        const importChildId = b.schoolWeekOverlayProposal ? childIds[0] ?? '' : ''
        setSchoolProfileChildId(importChildId)
        const defaultPersonId = people[0]?.id ?? ''
        const sourceHint = humanImportSourceLabelForBundle(b)
        const withLegacySegments = foldLegacyArrangementChildSegments(b.items)
        const items = applyCupWeekendEmbeddedScheduleMerge(dedupeNearDuplicateCalendarProposals(withLegacySegments), {
          sourceText: textInput,
        })
        setAnalyzedSourceLength(textInput.length)
        const classificationCtx = buildImportClassificationContext({
          inputMode: 'text',
          provenanceSourceType: b.provenance.sourceType,
          sourceLength: textInput.length,
          calendarItemCount: items.filter((i) => i.kind !== 'school_profile').length,
          secondaryCandidateCount: b.secondaryCandidates?.length ?? 0,
        })
        setBundle({ ...b, items })
        const drafts = buildDraftsFromItems(items, validPersonIds, defaultPersonId, people, sourceHint)
        setDraftByProposalId(drafts)
        setSelectedIds(
          initialSelectedIdsForGeneralImport(items, drafts, people, importChildId, classificationCtx)
        )
        prevSchoolChildForLangAdjustRef.current = null
        setStep('review')
        return true
      }

      const queue = [...pendingFiles]
      const bundles: PortalImportProposalBundle[] = []
      const failureLines: string[] = []
      let analyzedBytesTotal = 0

      for (const pf of queue) {
        patchPendingFile(pf.id, { status: 'analyzing', statusDetail: undefined })
        try {
          const b = await analyzeDocumentWithTankestrom(pf.file)
          if (!hasAnalyzeContent(b)) {
            patchPendingFile(pf.id, {
              status: 'error',
              statusDetail: 'Ingen forslag',
            })
            failureLines.push(`${pf.file.name}: ingen forslag`)
            continue
          }
          if (import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
            console.debug('[tankestrom analyze result:file]', {
              fileName: pf.file.name,
              itemsLength: b.items.length,
              hasSchoolProfileProposal: b.items.some((i) => i.kind === 'school_profile'),
              hasSchoolWeekOverlayProposal: !!b.schoolWeekOverlayProposal,
            })
          }
          bundles.push(b)
          analyzedBytesTotal += pf.file.size
          patchPendingFile(pf.id, { status: 'done', statusDetail: undefined })
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Analyse feilet'
          patchPendingFile(pf.id, { status: 'error', statusDetail: msg })
          failureLines.push(`${pf.file.name}: ${msg}`)
        }
      }

      if (bundles.length === 0) {
        setError(
          failureLines.length > 0
            ? failureLines.join('\n')
            : 'Ingen filer ga forslag. Prøv andre filer eller tekstmodus.'
        )
        return false
      }

      const merged = mergePortalImportProposalBundles(bundles)
      if (!hasAnalyzeContent(merged)) {
        setError('Ingen forslag etter sammenslåing.')
        return false
      }
      if (import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
        const taskItemsCount = merged.items.filter((i) => i.kind === 'task').length
        console.debug('[tankestrom analyze result:merged]', {
          itemsLength: merged.items.length,
          hasSchoolProfileProposal: merged.items.some((i) => i.kind === 'school_profile'),
          hasSchoolWeekOverlayProposal: !!merged.schoolWeekOverlayProposal,
          overlayPresent: !!merged.schoolWeekOverlayProposal,
          taskItemsCount,
          branch: isSchoolProfileBundle(merged) ? 'school_profile_review' : 'general_review',
        })
      }

      if (isSchoolProfileBundle(merged)) {
        setBundle(merged)
        const schoolItems = merged.items.filter((i): i is PortalSchoolProfileProposal => i.kind === 'school_profile')
        const primary = schoolItems[0]!
        const childIds = people.filter((p) => p.memberKind === 'child').map((p) => p.id)
        const initialChild =
          primary.suggestedPersonId && childIds.includes(primary.suggestedPersonId)
            ? primary.suggestedPersonId
            : (childIds[0] ?? '')
        setSchoolProfileChildId(initialChild)
        const parsedProfileSnapshotJson = JSON.stringify(primary.schoolProfile, null, 2)
        setSchoolReview({
          draft: cloneSchoolProfile(primary.schoolProfile),
          meta: { confidence: primary.confidence, originalSourceType: primary.originalSourceType },
          parsedProfileSnapshotJson,
        })
        // #region agent log
        fetch('http://127.0.0.1:7535/ingest/049b3e24-eef8-4d09-b78d-4e257b02a969',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4d90a0'},body:JSON.stringify({sessionId:'4d90a0',runId:'school-review-trace-v1',hypothesisId:'H1',location:'useTankestromImport.ts:598',message:'setSchoolReview from parsed snapshot (file mode)',data:{gradeBand:primary.schoolProfile.gradeBand,weekdays:primary.schoolProfile.weekdays},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        if (import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
          console.debug('[tankestrom school import] file path: parsed profile (etter API)', {
            gradeBand: primary.schoolProfile.gradeBand,
            weekdays: primary.schoolProfile.weekdays,
            snapshotJsonLength: parsedProfileSnapshotJson.length,
          })
        }
        setDraftByProposalId({})
        setSelectedIds(new Set())
        const extra =
          schoolItems.length > 1 ? '\nFlere timeplaner i sammenslått svar — kun den første brukes.' : ''
        if (failureLines.length > 0) {
          setAnalyzeWarning(
            `${failureLines.length} fil(er) ble hoppet over:\n${failureLines.join('\n')}${extra}`
          )
        } else if (extra) {
          setAnalyzeWarning(extra.trim())
        }
        setStep('review')
        return true
      }

      setSchoolReview(null)
      setSecondaryDismissedCandidateIds(new Set())
      setSecondaryPromotedProposalIds(new Set())
      const childIds = people.filter((p) => p.memberKind === 'child').map((p) => p.id)
      const importChildId = merged.schoolWeekOverlayProposal ? childIds[0] ?? '' : ''
      setSchoolProfileChildId(importChildId)
      const defaultPersonId = people[0]?.id ?? ''
      const sourceHint = humanImportSourceLabelForBundle(merged)
      const withLegacySegments = foldLegacyArrangementChildSegments(merged.items)
      const items = applyCupWeekendEmbeddedScheduleMerge(dedupeNearDuplicateCalendarProposals(withLegacySegments), {
        sourceText: undefined,
      })
      setAnalyzedSourceLength(analyzedBytesTotal)
      const classificationCtx = buildImportClassificationContext({
        inputMode: 'file',
        provenanceSourceType: merged.provenance.sourceType,
        sourceLength: analyzedBytesTotal,
        calendarItemCount: items.filter((i) => i.kind !== 'school_profile').length,
        secondaryCandidateCount: merged.secondaryCandidates?.length ?? 0,
      })
      setBundle({ ...merged, items })
      const drafts = buildDraftsFromItems(items, validPersonIds, defaultPersonId, people, sourceHint)
      setDraftByProposalId(drafts)
      setSelectedIds(
        initialSelectedIdsForGeneralImport(items, drafts, people, importChildId, classificationCtx)
      )
      prevSchoolChildForLangAdjustRef.current = null
      setStep('review')

      if (failureLines.length > 0) {
        setAnalyzeWarning(
          `${failureLines.length} fil(er) ble hoppet over:\n${failureLines.join('\n')}`
        )
      }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyse feilet.')
      return false
    } finally {
      setAnalyzeLoading(false)
    }
  }, [inputMode, patchPendingFile, pendingFiles, people, textInput, validPersonIds])

  /** Tømmer review-tilstand uten å gå til «Velg innhold» eller endre tekst/filer. */
  const clearReviewStateForReanalyze = useCallback(() => {
    setBundle(null)
    setAnalyzedSourceLength(0)
    setSchoolReview(null)
    setSchoolProfileChildId('')
    setSelectedIds(new Set())
    setSecondaryDismissedCandidateIds(new Set())
    setSecondaryPromotedProposalIds(new Set())
    setDraftByProposalId({})
    setEmbeddedScheduleReviewRowsByParentId({})
    setDetachedEmbeddedChildren([])
    setDetachedEmbeddedChildIds(new Set())
    setExistingEventLinkByProposalId({})
    setExistingEventUpdateTarget({})
    setError(null)
    setAnalyzeWarning(null)
    prevSchoolChildForLangAdjustRef.current = null
    secondaryShownLogKeyRef.current = ''
  }, [])

  const reanalyzeFromSameInput = useCallback(async () => {
    if (step !== 'review') return
    if (analyzeLoading || saveLoading) return
    if (inputMode === 'file') {
      if (pendingFiles.length === 0) {
        setError('Velg minst én fil.')
        return
      }
    } else if (!textInput.trim()) {
      setError('Skriv inn tekst først.')
      return
    }
    logEvent('tankestromReanalyzeTriggered', {
      inputMode,
      fileCount: inputMode === 'file' ? pendingFiles.length : 0,
      textLength: inputMode === 'text' ? textInput.trim().length : 0,
    })
    clearReviewStateForReanalyze()
    logEvent('tankestromReanalyzeStarted', { inputMode })
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
      console.debug('[tankestrom reanalyze]', { tankestromReanalyzeStarted: true, inputMode })
    }
    const ok = await runAnalyze()
    if (ok) {
      logEvent('tankestromReanalyzeCompleted', { inputMode })
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
        console.debug('[tankestrom reanalyze]', { tankestromReanalyzeCompleted: true, inputMode })
      }
    } else {
      logEvent('tankestromReanalyzeFailed', { inputMode })
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
        console.debug('[tankestrom reanalyze]', { tankestromReanalyzeFailed: true, inputMode })
      }
    }
  }, [
    step,
    analyzeLoading,
    saveLoading,
    inputMode,
    pendingFiles,
    textInput,
    clearReviewStateForReanalyze,
    runAnalyze,
  ])

  const addManualReviewTask = useCallback(() => {
    if (!bundle || schoolReview != null) return
    const defaultPersonId = people[0]?.id ?? ''
    const childDefault = defaultChildPersonId(people, validPersonIds) || defaultPersonId
    const newItem = buildManualPlaceholderTask(childDefault)
    setBundle((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : null))
    setDraftByProposalId((prev) => ({
      ...prev,
      [newItem.proposalId]: importDraftFromProposal(
        newItem,
        validPersonIds,
        defaultPersonId,
        people,
        MANUAL_REVIEW_SOURCE_LABEL
      ),
    }))
    setSelectedIds((prev) => new Set(prev).add(newItem.proposalId))
    logEvent('manualReviewItemAdded', { kind: 'task', proposalId: newItem.proposalId })
    logEvent('manualReviewTaskAdded', { proposalId: newItem.proposalId })
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
      console.debug('[tankestrom manual review]', { manualReviewTaskAdded: true, proposalId: newItem.proposalId })
    }
  }, [bundle, schoolReview, people, validPersonIds])

  const addManualReviewEvent = useCallback(() => {
    if (!bundle || schoolReview != null) return
    const defaultPersonId = people[0]?.id ?? ''
    const eventPersonId = validPersonIds.has(defaultPersonId)
      ? defaultPersonId
      : (people.find((p) => validPersonIds.has(p.id))?.id ?? defaultPersonId)
    const newItem = buildManualPlaceholderEvent(eventPersonId)
    setBundle((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : null))
    setDraftByProposalId((prev) => ({
      ...prev,
      [newItem.proposalId]: importDraftFromProposal(
        newItem,
        validPersonIds,
        defaultPersonId,
        people,
        MANUAL_REVIEW_SOURCE_LABEL
      ),
    }))
    setSelectedIds((prev) => new Set(prev).add(newItem.proposalId))
    logEvent('manualReviewItemAdded', { kind: 'event', proposalId: newItem.proposalId })
    logEvent('manualReviewEventAdded', { proposalId: newItem.proposalId })
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
      console.debug('[tankestrom manual review]', { manualReviewEventAdded: true, proposalId: newItem.proposalId })
    }
  }, [bundle, schoolReview, people, validPersonIds])

  const saveSchoolProfile = useCallback(async (): Promise<boolean> => {
    if (!schoolReview || !updatePerson) {
      setError('Lagring av skoleprofil er ikke tilgjengelig.')
      return false
    }
    const cid = schoolProfileChildId.trim()
    const child = people.find((p) => p.id === cid && p.memberKind === 'child')
    if (!child) {
      setError('Velg hvilket barn den faste timeplanen skal lagres til.')
      return false
    }
    setError(null)
    setSaveLoading(true)
    try {
      await updatePerson(cid, { school: schoolReview.draft })
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke lagre skoleprofil.')
      return false
    } finally {
      setSaveLoading(false)
    }
  }, [schoolReview, schoolProfileChildId, people, updatePerson])

  const saveSchoolWeekOverlay = useCallback(async (): Promise<boolean> => {
    const overlay = bundle?.schoolWeekOverlayProposal
    if (!overlay || !updatePerson) {
      setError('Lagring av uke-overlay er ikke tilgjengelig.')
      return false
    }
    const cid = schoolProfileChildId.trim()
    const child = people.find((p) => p.id === cid && p.memberKind === 'child')
    if (!child) {
      setError('Velg hvilket barn uke-overlayen skal lagres til.')
      return false
    }
    const existingSchool = child.school
    if (!existingSchool) {
      setError('Barnet mangler skoleprofil. Lagre skoleprofil først.')
      return false
    }

    const nextOverlay = overlayToChildWeekOverlay(overlay, existingSchool)
    const existingOverlays = existingSchool.weekOverlays ?? []
    const remaining = existingOverlays.filter(
      (o) => !(o.weekYear === nextOverlay.weekYear && o.weekNumber === nextOverlay.weekNumber)
    )
    const nextSchool: ChildSchoolProfile = {
      ...existingSchool,
      weekOverlays: [...remaining, nextOverlay],
    }

    setError(null)
    setSaveLoading(true)
    try {
      await updatePerson(cid, { school: nextSchool })
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke lagre uke-overlay.')
      return false
    } finally {
      setSaveLoading(false)
    }
  }, [bundle?.schoolWeekOverlayProposal, schoolProfileChildId, people, updatePerson])

  const setSchoolWeekOverlayProposalDraft = useCallback((next: PortalSchoolWeekOverlayProposal) => {
    setBundle((prev) => {
      if (!prev || !prev.schoolWeekOverlayProposal) return prev
      return { ...prev, schoolWeekOverlayProposal: next }
    })
  }, [])

  const approveSelected = useCallback(async (): Promise<TankestromImportResult> => {
    const importAttemptId = newPendingFileId()
    const nowIso = () => new Date().toISOString()

    const failEarly = (message: string): TankestromImportResult => {
      const idsEarly = [...selectedIds]
      const selectedActionsEarly = idsEarly.map((id) => ({
        proposalId: id,
        importKind: draftByProposalId[id]?.importKind ?? 'missing',
        existingAction:
          existingEventLinkByProposalId[id] ??
          (existingEventMatchesByProposalId[id]?.candidate ? 'update_default' : 'new_default'),
      }))
      setLastImportAttempt({
        status: 'failed',
        id: importAttemptId,
        startedAt: nowIso(),
        debug: {
          selectedProposalIds: idsEarly,
          selectedActions: selectedActionsEarly,
          persistPlan: [],
          persistPlanLength: 0,
          attemptedPersistOps: 0,
          createdEventsCount: 0,
          updatedEventsCount: 0,
          createdTasksCount: 0,
          failuresCount: 1,
          noopReason: 'preflight',
        },
        failures: [preflightImportFailureRecord(message)],
      })
      setError(message)
      return { ok: false, partial: false, failureMessage: message, importAttemptId, terminalStatus: 'failed' }
    }

    if (schoolReview) {
      return failEarly(
        'Fullfør eller lukk skoleprofil-importen før du legger hendelser og gjøremål i kalenderen.'
      )
    }
    if (!bundle || proposalItems.length === 0) {
      return failEarly('Ingen importpakke å lagre. Analyser dokumentet på nytt.')
    }
    const ids = [...selectedIds]
    const selectedActions = ids.map((id) => ({
      proposalId: id,
      importKind: draftByProposalId[id]?.importKind ?? 'missing',
      existingAction:
        existingEventLinkByProposalId[id] ??
        (existingEventMatchesByProposalId[id]?.candidate ? 'update_default' : 'new_default'),
    }))
    console.info('[Tankestrom import approve clicked]', {
      importAttemptId,
      selectedProposalIds: ids,
      selectedCount: ids.length,
      proposalsCount: proposalItems.length,
      selectedActions,
    })
    if (ids.length === 0) {
      return failEarly('Velg minst ett forslag som skal importeres.')
    }

    for (const id of ids) {
      const draft = draftByProposalId[id]
      if (!draft) {
        return failEarly('Mangler redigeringsdata for et valgt forslag. Prøv å analysere på nytt.')
      }
      const err = validateUnifiedDraft(draft, validPersonIds)
      if (err) {
        return failEarly(err)
      }
    }

    const attemptStartedAt = nowIso()
    setLastImportAttempt({ status: 'running', id: importAttemptId, startedAt: attemptStartedAt })
    console.info('[Tankestrom import attempt started]', {
      importAttemptId,
      selectedProposalIds: ids,
      selectedCount: ids.length,
    })
    setError(null)
    setSaveLoading(true)
    let failed = 0
    try {
      const failureRecords: TankestromImportPersistFailureRecord[] = []
      const failedIds = new Set<string>()
      const persistPlanPreview: Array<{
        planSurface: 'event' | 'task'
        proposalId: string
        childId?: string
        mode: string
        title: string
        date: string
        start: string
        end: string
        personId: string
        validationErrors: string[]
      }> = []
      let attemptedPersistOps = 0
      const createdEvents: TankestromImportSuccess['createdEvents'] = []
      const updatedEvents: TankestromImportSuccess['updatedEvents'] = []
      const createdTasks: TankestromImportSuccess['createdTasks'] = []
      const createdEventKeys = new Set<string>()
      const updatedEventKeys = new Set<string>()
      const firstSelectedEventItem = ids
        .map((sid) => bundle.items.find((it) => it.proposalId === sid))
        .find((it): it is PortalProposalItem & { kind: 'event' } => Boolean(it && it.kind === 'event'))
      const selectedArrangementTitle =
        firstSelectedEventItem?.kind === 'event'
          ? normalizeEmbeddedScheduleParentDisplayTitle(firstSelectedEventItem.event.title).title
          : undefined

      const promisedForeground = countPromisedTankestromCalendarEventRows(
        ids,
        bundle,
        draftByProposalId,
        embeddedScheduleReviewRowsByParentId,
        detachedEmbeddedChildIds,
        selectedIds
      )

      const buildDebug = (noopReason?: string): TankestromImportAttemptDebug => ({
        selectedProposalIds: [...ids],
        selectedActions: selectedActions.map((a) => ({ ...a })),
        persistPlan: persistPlanPreview,
        persistPlanLength: persistPlanPreview.length,
        attemptedPersistOps,
        createdEventsCount: createdEvents.length,
        updatedEventsCount: updatedEvents.length,
        createdTasksCount: createdTasks.length,
        failuresCount: failureRecords.length,
        noopReason,
      })

      const pushCreatedEvent = (row: { id: string; title: string; date: string; start?: string | null; end?: string | null }) => {
        const key = `${row.id}|${row.date}`
        if (createdEventKeys.has(key)) return
        createdEventKeys.add(key)
        createdEvents.push(row)
      }
      const pushUpdatedEvent = (row: { id: string; title: string; date: string; start?: string | null; end?: string | null }) => {
        const key = `${row.id}|${row.date}`
        if (updatedEventKeys.has(key)) return
        updatedEventKeys.add(key)
        updatedEvents.push(row)
      }
      const findCreatedEventByProposalId = (proposalId: string) => {
        if (!getAnchoredForegroundEventsForMatching) return null
        const anchors = getAnchoredForegroundEventsForMatching()
        const found = anchors.find((a) => {
          const m = a.event.metadata
          if (!m || typeof m !== 'object' || Array.isArray(m)) return false
          const integration = (m as Record<string, unknown>).integration
          if (!integration || typeof integration !== 'object' || Array.isArray(integration)) return false
          const pid = (integration as Record<string, unknown>).proposalId
          return typeof pid === 'string' && pid === proposalId
        })
        return found ? { event: found.event, anchorDate: found.anchorDate } : null
      }

      const persistCreateEvent = async (dateKey: string, input: Omit<Event, 'id'>, logProposalId: string) => {
        const metaRec =
          input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
            ? (input.metadata as Record<string, unknown>)
            : undefined
        console.info('[Tankestrom create event attempt]', {
          proposalId: logProposalId,
          title: input.title,
          date: dateKey,
          start: input.start,
          end: input.end,
          personId: input.personId,
          timePrecision: metaRec?.timePrecision,
          metadata: input.metadata,
        })
        try {
          await createEvent(dateKey, input)
          const persisted = findCreatedEventByProposalId(logProposalId)
          if (persisted) {
            console.info('[Tankestrom create event success]', {
              proposalId: logProposalId,
              id: persisted.event.id,
              title: persisted.event.title,
              date: persisted.anchorDate,
              start: persisted.event.start,
              end: persisted.event.end,
              personId: persisted.event.personId,
            })
          } else {
            console.info('[Tankestrom create event success]', {
              proposalId: logProposalId,
              id: logProposalId,
              title: input.title,
              date: dateKey,
              start: input.start,
              end: input.end,
              personId: input.personId,
              note: 'persisted_row_not_found_in_anchor_cache',
            })
          }
        } catch (error) {
          console.error('[Tankestrom create event failure]', {
            proposalId: logProposalId,
            title: input.title,
            date: dateKey,
            error,
          })
          throw error
        }
      }

      const postImportPrefetchCalendar = async () => {
        if (!prefetchEventsForDateRange) return
        const dateKeys = new Set<string>()
        for (const e of createdEvents) {
          if (DATE_KEY_RE.test(e.date)) dateKeys.add(e.date)
        }
        for (const e of updatedEvents) {
          if (DATE_KEY_RE.test(e.date)) dateKeys.add(e.date)
        }
        if (dateKeys.size === 0) return
        const sorted = [...dateKeys].sort()
        const from = sorted[0]!
        const to = sorted[sorted.length - 1]!
        const refetched = await prefetchEventsForDateRange(from, to)
        if (!refetched || typeof refetched !== 'object') return
        const expectedIds = new Set(
          createdEvents.map((e) => e.id).filter((id) => !id.startsWith(EMBEDDED_CHILD_ID_PREFIX))
        )
        const fetchedFlat = Object.values(refetched).flat()
        console.info('[Tankestrom post-import event refetch]', {
          range: { from, to },
          expectedCreatedEventIds: [...expectedIds],
          fetchedEvents: fetchedFlat.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            personId: e.personId,
            metadata: e.metadata,
          })),
        })
      }

      for (const id of ids) {
        const unified = draftByProposalId[id]
        const item = bundle.items.find((p) => p.proposalId === id)
        if (!unified || !item || unified.importKind !== 'event') {
          if (unified?.importKind === 'task') {
            persistPlanPreview.push({
              planSurface: 'task',
              proposalId: id,
              mode: 'createTask',
              title: unified.task.title.trim(),
              date: unified.task.date.trim(),
              start: '',
              end: '',
              personId: unified.task.childPersonId || unified.task.assignedToPersonId || '',
              validationErrors: [],
            })
          }
          continue
        }
        const ev = unified.event
        const fieldErrors = getTankestromDraftFieldErrors(ev, validPersonIds)
        const meta =
          item.kind === 'event' && item.event.metadata && typeof item.event.metadata === 'object'
            ? (item.event.metadata as Record<string, unknown>)
            : null
        const mode =
          meta?.isArrangementParent === true && meta?.exportAsCalendarEvent === false
            ? 'embedded_parent_container'
            : existingEventLinkByProposalId[id] === 'update'
              ? 'update'
              : 'createEvent'
        persistPlanPreview.push({
          planSurface: 'event',
          proposalId: id,
          mode,
          title: ev.title.trim(),
          date: ev.date.trim(),
          start: normalizeTimeInput(ev.start),
          end: normalizeTimeInput(ev.end),
          personId: ev.personId.trim(),
          validationErrors: Object.values(fieldErrors).filter(Boolean),
        })
      }
      console.info('[Tankestrom import persist plan]', {
        planItems: persistPlanPreview,
      })
      console.info('[Tankestrom import persist plan events]', {
        eventPlanItems: persistPlanPreview.filter((p) => p.planSurface === 'event'),
        taskPlanItems: persistPlanPreview.filter((p) => p.planSurface === 'task'),
      })

      const recordFailure = (
        proposalId: string,
        surface: 'event' | 'task',
        operation: TankestromImportPersistFailureRecord['operation'],
        kind: TankestromImportPersistFailureRecord['kind'],
        message: string,
        extras?: Pick<
          TankestromImportPersistFailureRecord,
          | 'taskPersistContext'
          | 'childId'
          | 'title'
          | 'date'
          | 'field'
          | 'supabaseCode'
          | 'supabaseMessage'
          | 'supabaseDetails'
          | 'supabaseHint'
        >
      ) => {
        failed += 1
        failedIds.add(proposalId)
        failureRecords.push({ proposalId, proposalSurfaceType: surface, operation, kind, message, ...extras })
        console.error('[Tankestrom import persist failure]', {
          proposalId,
          childId: extras?.childId,
          title: extras?.title,
          mode: operation,
          validationErrors: extras?.field ? [{ field: extras.field, message }] : undefined,
          supabaseError: {
            code: extras?.supabaseCode,
            message: extras?.supabaseMessage,
            details: extras?.supabaseDetails,
            hint: extras?.supabaseHint,
          },
        })
        logTankestromImportPersist({
          tankestromImportPersistSuccess: false,
          tankestromImportPersistFailure: true,
          tankestromImportPersistOperation:
            operation === 'editEventPrecheck' ? 'editEvent' : operation,
          tankestromImportPersistErrorKind: kind,
          tankestromImportPersistErrorMessage: message,
          proposalId,
          proposalSurfaceType: surface,
        })
      }

      const recordSuccess = (
        proposalId: string,
        surface: 'event' | 'task',
        operation: TankestromImportPersistOperation
      ) => {
        logTankestromImportPersist({
          tankestromImportPersistSuccess: true,
          tankestromImportPersistFailure: false,
          tankestromImportPersistOperation: operation,
          proposalId,
          proposalSurfaceType: surface,
        })
      }

      for (const id of ids) {
        const parsedEmb = parseEmbeddedChildProposalId(id)
        if (parsedEmb) {
          if (!detachedEmbeddedChildIds.has(id)) {
            const parentProposalId = parsedEmb.parentProposalId
            const origIndex = parsedEmb.origIndex
            const parentItem = bundle.items.find(
              (p) => p.proposalId === parentProposalId && p.kind === 'event'
            )
            const parentUnified = draftByProposalId[parentProposalId]
            const childUnified = draftByProposalId[id]
            if (!parentItem || parentItem.kind !== 'event' || !parentUnified || parentUnified.importKind !== 'event') {
              recordFailure(
                id,
                'event',
                'createEvent',
                'validation',
                'Programrad mangler gyldig forelder i importutkastet.',
                { title: 'Programrad', field: 'parent' }
              )
              continue
            }
            const rows = embeddedScheduleReviewRowsByParentId[parentProposalId] ?? []
            const row = rows.find((r) => r.origIndex === origIndex)
            if (!row) {
              recordFailure(id, 'event', 'createEvent', 'validation', 'Fant ikke programraden som skal eksporteres.', {
                field: 'date',
              })
              continue
            }
            const rawP = parentUnified.event
            const parentDraft: TankestromEventDraft = {
              ...rawP,
              title: rawP.title.trim(),
              date: rawP.date.trim(),
              start: normalizeTimeInput(rawP.start),
              end: normalizeTimeInput(rawP.end),
              personId: rawP.personId,
              location: rawP.location.trim(),
              notes: rawP.notes.trim(),
            }
            const siblingTitlesBlob = rows.map((r) => r.segment.title.trim()).join('\n')
            const slice = buildEmbeddedChildEventDraft(parentDraft, row.segment, {
              childProposalId: id,
              siblingTitlesBlob,
            })
            let draftEv: TankestromEventDraft = {
              ...slice,
              title: slice.title.trim(),
              date: slice.date.trim(),
              start: normalizeTimeInput(slice.start),
              end: normalizeTimeInput(slice.end),
              personId: slice.personId,
              location: slice.location.trim(),
              notes: slice.notes.trim(),
            }
            if (childUnified?.importKind === 'event') {
              const ce = childUnified.event
              draftEv = {
                ...draftEv,
                title: ce.title.trim() || draftEv.title,
                date: ce.date.trim() || draftEv.date,
                start: normalizeTimeInput(ce.start),
                end: normalizeTimeInput(ce.end),
                personId: ce.personId,
                location: ce.location.trim() || draftEv.location,
                notes: ce.notes.trim() || draftEv.notes,
                dropoffBy: ce.dropoffBy,
                pickupBy: ce.pickupBy,
                reminderMinutes: ce.reminderMinutes,
              }
            }
            const preflightEmb = preflightEventValidationErrors(id, id, draftEv, validPersonIds)
            if (preflightEmb.length > 0) {
              for (const v of preflightEmb) {
                recordFailure(id, 'event', 'createEvent', 'validation', v.message, {
                  childId: v.childId,
                  title: v.title,
                  date: v.date,
                  field: v.field,
                })
              }
              continue
            }
            const parentProposal = parentItem
            let templateEvMetaNd: Record<string, unknown> = {}
            if (parentProposal.kind === 'event') {
              const evNd = parentProposal.event
              templateEvMetaNd =
                evNd.metadata && typeof evNd.metadata === 'object' && !Array.isArray(evNd.metadata)
                  ? { ...evNd.metadata }
                  : {}
            }
            const parentIntegrationNd = {
              proposalId: parentProposal.proposalId,
              importRunId: bundle.provenance.importRunId,
              confidence: parentProposal.confidence,
              originalSourceType: parentProposal.originalSourceType,
              externalRef: parentProposal.externalRef,
              sourceSystem: bundle.provenance.sourceSystem,
            }
            let baseMetaNd: Record<string, unknown> = { ...templateEvMetaNd }
            delete baseMetaNd.embeddedSchedule
            delete baseMetaNd.endDate
            delete baseMetaNd.multiDayAllDay
            baseMetaNd.isAllDay = false
            baseMetaNd.detachedFromEmbeddedParentId = parentProposal.proposalId
            baseMetaNd.detachedEmbeddedOrigIndex = row.origIndex

            const metadataNd: Record<string, unknown> = {
              ...baseMetaNd,
              sourceId: parentProposal.sourceId,
              integration: {
                ...parentIntegrationNd,
                proposalId: id,
              },
            }
            const transportMetaNd: Record<string, unknown> = {}
            if (draftEv.dropoffBy.trim()) transportMetaNd.dropoffBy = draftEv.dropoffBy.trim()
            if (draftEv.pickupBy.trim()) transportMetaNd.pickupBy = draftEv.pickupBy.trim()
            if (Object.keys(transportMetaNd).length > 0) {
              metadataNd.transport = {
                ...(baseMetaNd.transport && typeof baseMetaNd.transport === 'object' && !Array.isArray(baseMetaNd.transport)
                  ? (baseMetaNd.transport as Record<string, unknown>)
                  : {}),
                ...transportMetaNd,
              }
            } else if (baseMetaNd.transport && typeof baseMetaNd.transport === 'object') {
              const prevTNd = { ...(baseMetaNd.transport as Record<string, unknown>) }
              delete prevTNd.dropoffBy
              delete prevTNd.pickupBy
              if (Object.keys(prevTNd).length > 0) metadataNd.transport = prevTNd
              else delete metadataNd.transport
            }
            mergeEventParticipantsIntoMetadata(metadataNd, draftEv, validPersonIds)
            sanitizeEmbeddedChildCalendarExportMetadata(metadataNd)
            applyEventTimingMetadataForPersist(metadataNd, draftEv)
            const scheduleDetailsNd = structuredDetailsFromSegment(
              row.segment,
              normalizeEmbeddedScheduleParentDisplayTitle(parentDraft.title.trim()).title,
              draftEv.title,
              id
            )
            attachTankestromDetailsToMetadata(metadataNd, scheduleDetailsNd)

            const inputNd: Omit<Event, 'id'> = {
              ...buildPersistTimes(draftEv),
              personId: normalizePersistedPersonId(draftEv.personId),
              title: draftEv.title,
              notes: buildPersistNotes(draftEv),
              location: draftEv.location.length > 0 ? draftEv.location : undefined,
              reminderMinutes: draftEv.reminderMinutes,
              recurrenceGroupId: undefined,
              metadata: metadataNd,
            }
            try {
              attemptedPersistOps += 1
              await persistCreateEvent(draftEv.date, inputNd, id)
              recordSuccess(id, 'event', 'createEvent')
              const persistedNd = findCreatedEventByProposalId(id)
              if (persistedNd) {
                pushCreatedEvent({
                  id: persistedNd.event.id,
                  title: persistedNd.event.title,
                  date: persistedNd.anchorDate,
                  start: persistedNd.event.start,
                  end: persistedNd.event.end,
                })
              } else {
                pushCreatedEvent({
                  id,
                  title: draftEv.title,
                  date: draftEv.date,
                  start: draftEv.start || null,
                  end: draftEv.end || null,
                })
              }
            } catch (e) {
              const { kind, message, supabaseCode, supabaseMessage, supabaseDetails, supabaseHint } =
                classifyTankestromPersistThrownError(e, 'createEvent')
              recordFailure(id, 'event', 'createEvent', kind, message, {
                childId: id,
                title: draftEv.title,
                date: draftEv.date,
                field: 'database',
                supabaseCode,
                supabaseMessage,
                supabaseDetails,
                supabaseHint,
              })
            }
            continue
          }
          const unified = draftByProposalId[id]
          const entry = detachedEmbeddedChildren.find((d) => d.proposal.proposalId === id)
          const parentItem = bundle.items.find(
            (p) => p.proposalId === entry?.parentProposalId && p.kind === 'event'
          )
          if (!unified || unified.importKind !== 'event' || !entry || !parentItem || parentItem.kind !== 'event') {
            continue
          }
          const item = entry.proposal
          const raw = unified.event
          const draftEv: TankestromEventDraft = {
            ...raw,
            title: raw.title.trim(),
            date: raw.date.trim(),
            start: normalizeTimeInput(raw.start),
            end: normalizeTimeInput(raw.end),
            personId: raw.personId,
            location: raw.location.trim(),
            notes: raw.notes.trim(),
          }
          const preflightErrors = preflightEventValidationErrors(id, id, draftEv, validPersonIds)
          if (preflightErrors.length > 0) {
            for (const v of preflightErrors) {
              recordFailure(id, 'event', 'createEvent', 'validation', v.message, {
                childId: v.childId,
                title: v.title,
                date: v.date,
                field: v.field,
              })
            }
            continue
          }
          const integration = {
            proposalId: item.proposalId,
            importRunId: bundle.provenance.importRunId,
            confidence: parentItem.confidence,
            originalSourceType: parentItem.originalSourceType,
            externalRef: parentItem.externalRef,
            sourceSystem: bundle.provenance.sourceSystem,
          }
          let baseMeta: Record<string, unknown> = {}
          if (item.kind === 'event') {
            const ev = item.event
            baseMeta =
              ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata) ? { ...ev.metadata } : {}
          }
          const metadata: Record<string, unknown> = {
            ...baseMeta,
            sourceId: item.sourceId,
            integration,
          }
          const transportMeta: Record<string, unknown> = {}
          if (draftEv.dropoffBy.trim()) transportMeta.dropoffBy = draftEv.dropoffBy.trim()
          if (draftEv.pickupBy.trim()) transportMeta.pickupBy = draftEv.pickupBy.trim()
          if (Object.keys(transportMeta).length > 0) {
            metadata.transport = {
              ...(baseMeta.transport && typeof baseMeta.transport === 'object' && !Array.isArray(baseMeta.transport)
                ? (baseMeta.transport as Record<string, unknown>)
                : {}),
              ...transportMeta,
            }
          } else if (baseMeta.transport && typeof baseMeta.transport === 'object') {
            const prevT = { ...(baseMeta.transport as Record<string, unknown>) }
            delete prevT.dropoffBy
            delete prevT.pickupBy
            if (Object.keys(prevT).length > 0) metadata.transport = prevT
            else delete metadata.transport
          }
          mergeEventParticipantsIntoMetadata(metadata, draftEv, validPersonIds)
          sanitizeEmbeddedChildCalendarExportMetadata(metadata)
          const parentCoreTitle = normalizeEmbeddedScheduleParentDisplayTitle(
            parentItem.event.title.trim()
          ).title
          const detachedDetails = structuredDetailsFromSegment(
            {
              date: draftEv.date,
              start: draftEv.start,
              end: draftEv.end,
              title: draftEv.title,
              notes: draftEv.notes || undefined,
            },
            parentCoreTitle,
            draftEv.title,
            id
          )
          attachTankestromDetailsToMetadata(metadata, detachedDetails)
          applyEventTimingMetadataForPersist(metadata, draftEv)
          const input: Omit<Event, 'id'> = {
            ...buildPersistTimes(draftEv),
            personId: normalizePersistedPersonId(draftEv.personId),
            title: draftEv.title,
            notes: buildPersistNotes(draftEv),
            location: draftEv.location.length > 0 ? draftEv.location : undefined,
            reminderMinutes: draftEv.reminderMinutes,
            recurrenceGroupId: undefined,
            metadata,
          }
          if (TANKESTROM_IMPORT_PERSIST_DEBUG) {
            console.debug('[tankestrom embedded child export]', {
              embeddedScheduleChildExportPayloadBuilt: {
                proposalId: id,
                date: draftEv.date,
                start: draftEv.start,
                end: draftEv.end,
                title: draftEv.title,
              },
              embeddedScheduleChildExportDateNormalized: draftEv.date,
              embeddedScheduleChildExportEndDateRemoved: metadata.endDate === undefined,
              embeddedScheduleChildExportMultiDayFlagsCleared: metadata.multiDayAllDay === undefined,
              embeddedScheduleChildExportSingleDayConfirmed:
                metadata.isAllDay === false && !metadata.endDate && metadata.embeddedSchedule === undefined,
            })
          }
          try {
            attemptedPersistOps += 1
            await persistCreateEvent(draftEv.date, input, id)
            recordSuccess(id, 'event', 'createEvent')
            const persisted = findCreatedEventByProposalId(id)
            if (persisted) {
              pushCreatedEvent({
                id: persisted.event.id,
                title: persisted.event.title,
                date: persisted.anchorDate,
                start: persisted.event.start,
                end: persisted.event.end,
              })
            } else {
              pushCreatedEvent({
                id,
                title: draftEv.title,
                date: draftEv.date,
                start: draftEv.start || null,
                end: draftEv.end || null,
              })
            }
          } catch (e) {
            const { kind, message, supabaseCode, supabaseMessage, supabaseDetails, supabaseHint } =
              classifyTankestromPersistThrownError(e, 'createEvent')
            recordFailure(id, 'event', 'createEvent', kind, message, {
              childId: id,
              title: draftEv.title,
              date: draftEv.date,
              field: 'database',
              supabaseCode,
              supabaseMessage,
              supabaseDetails,
              supabaseHint,
            })
          }
          continue
        }

        const item = bundle.items.find((p) => p.proposalId === id)
        const unified = draftByProposalId[id]
        if (!item || !unified) continue
        if (item.kind === 'event') {
          const meta =
            item.event.metadata && typeof item.event.metadata === 'object' && !Array.isArray(item.event.metadata)
              ? (item.event.metadata as Record<string, unknown>)
              : null
          const isParentContainerWithoutProgram =
            meta?.isArrangementParent === true &&
            meta?.exportAsCalendarEvent === false &&
            (!Array.isArray(meta?.embeddedSchedule) ||
              (meta?.embeddedSchedule as unknown[]).length === 0)
          if (isParentContainerWithoutProgram) {
            recordFailure(
              id,
              'event',
              'createEvent',
              'validation',
              'Arrangementet har ingen importerbare underhendelser.',
              { title: draftByProposalId[id]?.importKind === 'event' ? draftByProposalId[id]!.event.title : 'Arrangement', field: 'unknown' }
            )
            continue
          }
        }

        if (unified.importKind === 'task') {
          const t = unified.task
          const rawIntent = t.taskIntent
          const safeIntent = normalizeTaskIntent(rawIntent) ?? 'must_do'
          if (
            rawIntent !== safeIntent &&
            (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true')
          ) {
            console.debug('[tankestrom task persist]', {
              tankestromTaskPersistFixApplied: true,
              proposalId: id,
              taskIntentBefore: rawIntent,
              taskIntentAfter: safeIntent,
            })
          }
          const childTrim = t.childPersonId.trim()
          const assignTrim = t.assignedToPersonId.trim()
          const childPersonId =
            childTrim && validPersonIds.has(childTrim) ? childTrim : undefined
          const assignedToPersonId =
            assignTrim && validPersonIds.has(assignTrim) ? assignTrim : undefined
          if (
            TANKESTROM_IMPORT_PERSIST_DEBUG &&
            ((childTrim && !validPersonIds.has(childTrim)) || (assignTrim && !validPersonIds.has(assignTrim)))
          ) {
            console.debug('[tankestrom task persist]', {
              tankestromTaskPersistInvalidPersonIdStripped: true,
              proposalId: id,
              childPersonIdRaw: childTrim || null,
              assignedToPersonIdRaw: assignTrim || null,
            })
          }
          const taskInput: Omit<Task, 'id'> = {
            title: t.title.trim(),
            date: t.date.trim(),
            notes: t.notes.trim() ? t.notes.trim() : undefined,
            dueTime:
              t.dueTime.trim() && isHm24(normalizeTimeInput(t.dueTime))
                ? normalizeTimeInput(t.dueTime)
                : undefined,
            childPersonId,
            assignedToPersonId,
            showInMonthView: t.showInMonthView || undefined,
            taskIntent: safeIntent,
          }
          try {
            if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
              console.debug('[tankestrom task persist]', {
                tankestromTaskPersistPayload: {
                  proposalId: id,
                  title: taskInput.title,
                  titleLength: taskInput.title.length,
                  taskIntent: taskInput.taskIntent,
                  date: taskInput.date,
                  dueTime: taskInput.dueTime ?? null,
                  childPersonId: taskInput.childPersonId ?? null,
                  assignedToPersonId: taskInput.assignedToPersonId ?? null,
                  showInMonthView: taskInput.showInMonthView ?? false,
                  notesLength: taskInput.notes?.length ?? 0,
                },
              })
            }
            attemptedPersistOps += 1
            await createTask(taskInput)
            recordSuccess(id, 'task', 'createTask')
            createdTasks.push({ id, title: taskInput.title, date: taskInput.date })
            if (item.originalSourceType === MANUAL_REVIEW_SOURCE_TYPE) {
              logEvent('manualReviewItemImported', { proposalId: id, kind: 'task' })
            }
          } catch (e) {
            const classified = classifyTankestromPersistThrownError(e, 'createTask')
            const { kind, message, supabaseCode, supabaseMessage, supabaseDetails, supabaseHint } = classified
            recordFailure(id, 'task', 'createTask', kind, message, {
              taskPersistContext: {
                title: taskInput.title,
                date: taskInput.date,
                dueTime: taskInput.dueTime,
                taskIntent: taskInput.taskIntent ?? safeIntent,
                childPersonId: taskInput.childPersonId ?? null,
                assignedToPersonId: taskInput.assignedToPersonId ?? null,
              },
              supabaseCode,
              supabaseMessage,
              supabaseDetails,
              supabaseHint,
            })
            if (TANKESTROM_IMPORT_PERSIST_DEBUG) {
              const failureSnapshot: TankestromImportPersistFailureRecord = {
                proposalId: id,
                proposalSurfaceType: 'task',
                operation: 'createTask',
                kind,
                message,
                taskPersistContext: {
                  title: taskInput.title,
                  date: taskInput.date,
                  dueTime: taskInput.dueTime,
                  taskIntent: taskInput.taskIntent ?? safeIntent,
                  childPersonId: taskInput.childPersonId ?? null,
                  assignedToPersonId: taskInput.assignedToPersonId ?? null,
                },
                supabaseCode,
                supabaseMessage,
                supabaseDetails,
                supabaseHint,
              }
              console.debug('[tankestrom task persist]', {
                tankestromTaskPersistFailureDetailed: true,
                proposalId: id,
                title: taskInput.title,
                taskIntent: taskInput.taskIntent,
                date: taskInput.date,
                dueTime: taskInput.dueTime ?? null,
                childPersonId: taskInput.childPersonId ?? null,
                assignedToPersonId: taskInput.assignedToPersonId ?? null,
                payload: taskInput,
                classifiedKind: kind,
                classifiedMessage: message,
                ...buildTaskPersistFailureSupabaseDebugPayload(failureSnapshot),
                tankestromTaskPersistPayloadFingerprint: buildTankestromTaskPersistPayloadFingerprint(taskInput),
                tankestromTaskPersistLikelyConcurrencyIssue: false,
                tankestromTaskPersistLikelyValidationIssue:
                  kind === 'validation' ||
                  taskInput.title.trim().length === 0 ||
                  !/^\d{4}-\d{2}-\d{2}$/.test(taskInput.date.trim()),
                tankestromTaskPersistFailureFieldSummary: {
                  titleEmpty: taskInput.title.length === 0,
                  dateLooksLikeKey: /^\d{4}-\d{2}-\d{2}$/.test(taskInput.date),
                  hasChildOrAssignee: !!(taskInput.childPersonId || taskInput.assignedToPersonId),
                },
              })
            }
          }
          continue
        }

        const raw = unified.event
        const draft: TankestromEventDraft = {
          ...raw,
          title: raw.title.trim(),
          date: raw.date.trim(),
          start: normalizeTimeInput(raw.start),
          end: normalizeTimeInput(raw.end),
          personId: raw.personId,
          location: raw.location.trim(),
          notes: raw.notes.trim(),
        }

        const persistPlan =
          item.kind === 'event'
            ? resolveTankestromExistingEventPersistPlan(
                existingEventMatchesByProposalId[id],
                existingEventLinkByProposalId[id],
                existingEventUpdateTarget[id]
              )
            : { mode: 'new' as const, reason: 'not_event' }

        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
          if (item.kind === 'event') {
            const mr = existingEventMatchesByProposalId[id]
            console.debug('[tankestrom approve existing event chain]', {
              proposalId: id,
              existingEventLinkChoiceResolved: existingEventLinkByProposalId[id] ?? 'unset',
              existingEventMatchSelectedTarget:
                persistPlan.mode === 'update' ? persistPlan.target : null,
              persistPlanMode: persistPlan.mode,
              persistPlanReason: persistPlan.mode === 'new' ? persistPlan.reason : undefined,
              matchRejected: mr?.rejected,
              matchScore: mr?.score,
              matchRejectReason: mr?.rejectReason,
            })
          }
        }

        if (item.kind === 'event' && persistPlan.mode === 'skip') {
          continue
        }

        if (item.kind === 'event' && persistPlan.mode === 'blocked') {
          recordFailure(id, 'event', 'editEventPrecheck', 'validation', persistPlan.message)
          continue
        }

        if (persistPlan.mode === 'update' && (!editEvent || !getAnchoredForegroundEventsForMatching)) {
          recordFailure(
            id,
            'event',
            'editEventPrecheck',
            'validation',
            !editEvent
              ? 'Oppdatering er ikke tilgjengelig (mangler editEvent).'
              : 'Oppdatering er ikke tilgjengelig (mangler kalenderdata for match).'
          )
          if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
            console.debug('[tankestrom approve existing event chain]', {
              proposalId: id,
              existingEventUpdateFlowBrokeAt: !editEvent ? 'missing_editEvent' : 'missing_getAnchoredForegroundEventsForMatching',
              tankestromApproveSelectedCreateEventChosen: false,
            })
          }
          continue
        }

        if (
          item.kind === 'event' &&
          editEvent &&
          getAnchoredForegroundEventsForMatching &&
          persistPlan.mode === 'update'
        ) {
          const target = persistPlan.target
          const anchorsNow = getAnchoredForegroundEventsForMatching()
          const found = anchorsNow.find((a) => a.event.id === target.eventId)
          if (!found) {
            recordFailure(
              id,
              'event',
              'editEventPrecheck',
              'event_update_target_missing',
              'Fant ikke målhendelsen for oppdatering (kan være slettet eller flyttet).'
            )
            continue
          }
          const existingEvent = found.event
          const anchorDate = found.anchorDate

          const integration = {
            proposalId: item.proposalId,
            importRunId: bundle.provenance.importRunId,
            confidence: item.confidence,
            originalSourceType: item.originalSourceType,
            externalRef: item.externalRef,
            sourceSystem: bundle.provenance.sourceSystem,
          }

          let baseMeta: Record<string, unknown> = {}
          if (
            existingEvent.metadata &&
            typeof existingEvent.metadata === 'object' &&
            !Array.isArray(existingEvent.metadata)
          ) {
            baseMeta = { ...(existingEvent.metadata as Record<string, unknown>) }
          }
          delete baseMeta.__anchorDate

          const ev = item.event
          const proposalMeta =
            ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata) ? { ...ev.metadata } : {}
          const endDateRaw = typeof proposalMeta.endDate === 'string' ? proposalMeta.endDate.trim() : ''
          if (DATE_KEY_RE.test(endDateRaw)) {
            baseMeta.endDate = endDateRaw
          }
          if (proposalMeta.isAllDay === true) baseMeta.isAllDay = true
          if (proposalMeta.multiDayAllDay === true) baseMeta.multiDayAllDay = true
          let clusterCleanupProgramDates: string[] = []
          if (isEmbeddedScheduleParentCalendarItem(item)) {
            const rows = embeddedScheduleReviewRowsByParentId[item.proposalId] ?? []
            let included = rows.filter((r) =>
              selectedIds.has(makeEmbeddedChildProposalId(item.proposalId, r.origIndex))
            )
            if (included.length === 0 && rows.length > 0) {
              included = rows
            }
            const parentTitleForSegments = normalizeEmbeddedScheduleParentDisplayTitle(draft.title.trim()).title
            const siblingBlobEmbedded = included.map((r) => r.segment.title.trim()).join('\n')
            baseMeta.embeddedSchedule = included.map((r) => ({
              ...r.segment,
              title: embeddedScheduleChildCalendarExportTitle(
                r.segment,
                parentTitleForSegments,
                siblingBlobEmbedded
              ),
            }))
            clusterCleanupProgramDates = included
              .map((r) => r.segment.date.trim())
              .filter((d) => DATE_KEY_RE.test(d))
          }

          const metadata: Record<string, unknown> = {
            ...baseMeta,
            sourceId: item.sourceId,
            integration,
          }
          const transportMeta: Record<string, unknown> = {}
          if (draft.dropoffBy.trim()) transportMeta.dropoffBy = draft.dropoffBy.trim()
          if (draft.pickupBy.trim()) transportMeta.pickupBy = draft.pickupBy.trim()
          if (Object.keys(transportMeta).length > 0) {
            metadata.transport = {
              ...(baseMeta.transport && typeof baseMeta.transport === 'object' && !Array.isArray(baseMeta.transport)
                ? (baseMeta.transport as Record<string, unknown>)
                : {}),
              ...transportMeta,
            }
          } else if (baseMeta.transport && typeof baseMeta.transport === 'object') {
            const prevT = { ...(baseMeta.transport as Record<string, unknown>) }
            delete prevT.dropoffBy
            delete prevT.pickupBy
            if (Object.keys(prevT).length > 0) metadata.transport = prevT
            else delete metadata.transport
          }
          mergeEventParticipantsIntoMetadata(metadata, draft, validPersonIds)
          applyEventTimingMetadataForPersist(metadata, draft)
          const proposalDetails = readTankestromScheduleDetailsFromMetadata(
            proposalMeta as EventMetadata
          )
          attachTankestromDetailsToMetadata(metadata, proposalDetails)

          const incomingStableForPatch = readArrangementStableKey(ev.metadata)
          if (incomingStableForPatch && !readArrangementStableKey(baseMeta)) {
            metadata.arrangementStableKey = incomingStableForPatch
            if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
              console.debug('[tankestrom approve existing event stable key]', {
                existingEventStableKeyLearned: true,
                existingEventStableKeyBackfilled: true,
                proposalId: id,
                arrangementStableKey: incomingStableForPatch,
              })
            }
          }
          const incomingCoreTitle = readArrangementCoreTitle(ev.metadata)
          if (incomingCoreTitle && !readArrangementCoreTitle(metadata)) {
            metadata.arrangementCoreTitle = incomingCoreTitle
          }
          const incomingBlockGroup = readArrangementBlockGroupId(ev.metadata)
          if (incomingBlockGroup && !readArrangementBlockGroupId(metadata)) {
            metadata.arrangementBlockGroupId = incomingBlockGroup
          }

          const updates: Partial<Event> = {
            metadata,
            personId: normalizePersistedPersonId(draft.personId),
            ...buildPersistTimes(draft),
          }
          updates.notes = buildPersistNotes(draft)
          if (draft.location.length > 0) updates.location = draft.location
          const updatePreflight = preflightEventValidationErrors(id, undefined, draft, validPersonIds)
          if (updatePreflight.length > 0) {
            for (const v of updatePreflight) {
              recordFailure(id, 'event', 'editEventPrecheck', 'validation', v.message, {
                title: v.title,
                date: v.date,
                field: v.field,
              })
            }
            continue
          }

          try {
            attemptedPersistOps += 1
            await editEvent(anchorDate, existingEvent, updates)
            recordSuccess(id, 'event', 'editEvent')
            pushUpdatedEvent({
              id: existingEvent.id,
              title: existingEvent.title,
              date: anchorDate,
              start: existingEvent.start,
              end: existingEvent.end,
            })
            if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
              console.debug('[tankestrom approve selected]', {
                tankestromApproveSelectedEditEventChosen: true,
                proposalId: id,
                existingEventUpdateTargetResolved: target,
                existingEventUpdateFlowBrokeAt: null,
              })
            }
            if (deleteEvent && clusterCleanupProgramDates.length > 0) {
              await cleanupParallelClusterDayRowsAfterEmbeddedParentUpdate({
                deleteEvent,
                getAnchoredForegroundEventsForMatching: getAnchoredForegroundEventsForMatching!,
                anchorEventId: target.eventId,
                importParentTitleRaw: draft.title.trim(),
                importPersonId: normalizePersistedPersonId(draft.personId) ?? '',
                programDates: clusterCleanupProgramDates,
              })
            }
            if (item.originalSourceType === MANUAL_REVIEW_SOURCE_TYPE) {
              logEvent('manualReviewItemImported', { proposalId: id, kind: 'event' })
            }
          } catch (e) {
            const { kind, message, supabaseCode, supabaseMessage, supabaseDetails, supabaseHint } =
              classifyTankestromPersistThrownError(e, 'editEvent')
            recordFailure(id, 'event', 'editEvent', kind, message, {
              title: draft.title,
              date: draft.date,
              field: 'database',
              supabaseCode,
              supabaseMessage,
              supabaseDetails,
              supabaseHint,
            })
          }
          continue
        }

        const isEmbeddedParentCreate =
          item.kind === 'event' &&
          unified.importKind === 'event' &&
          isEmbeddedScheduleParentCalendarItem(item)

        if (isEmbeddedParentCreate) {
          if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
            console.debug('[tankestrom approve selected]', {
              tankestromApproveSelectedCreateEventChosen: true,
              proposalId: id,
              existingEventUpdateFlowBrokeAt:
                persistPlan.mode === 'new' ? persistPlan.reason : 'edit_branch_not_chosen_for_embedded_parent',
            })
          }
          const rows = embeddedScheduleReviewRowsByParentId[item.proposalId] ?? []
          if (rows.length > 0) {
            const included = rows.filter((r) =>
              selectedIds.has(makeEmbeddedChildProposalId(item.proposalId, r.origIndex))
            )
            const baseSegments = included.length > 0 ? included : rows
            const segmentsToExport = baseSegments.filter(
              (r) => !detachedEmbeddedChildIds.has(makeEmbeddedChildProposalId(item.proposalId, r.origIndex))
            )
            const embeddedScheduleExportPolicyUsed =
              included.length > 0 ? 'selected_child_rows' : 'fallback_all_rows_no_child_selection'

            if (TANKESTROM_IMPORT_PERSIST_DEBUG) {
              console.debug('[tankestrom embedded schedule export]', {
                embeddedScheduleExportPolicyUsed,
                embeddedScheduleParentExportIntercepted: true,
                embeddedScheduleChildExportCount: segmentsToExport.length,
                embeddedScheduleParentExportSuppressedAsSingleAllDay: segmentsToExport.length > 0,
                parentProposalId: item.proposalId,
              })
            }

            if (segmentsToExport.length === 0) {
              recordFailure(
                id,
                'event',
                'createEvent',
                'validation',
                'Arrangementet har program, men ingen kalenderhendelser ble bygget fra programmet.',
                { title: draft.title, date: draft.date, field: 'unknown' }
              )
              continue
            }

            const parentProposal = item
            let templateEvMeta: Record<string, unknown> = {}
            if (parentProposal.kind === 'event') {
              const ev = parentProposal.event
              templateEvMeta =
                ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata)
                  ? { ...ev.metadata }
                  : {}
            }

            const parentIntegration = {
              proposalId: parentProposal.proposalId,
              importRunId: bundle.provenance.importRunId,
              confidence: parentProposal.confidence,
              originalSourceType: parentProposal.originalSourceType,
              externalRef: parentProposal.externalRef,
              sourceSystem: bundle.provenance.sourceSystem,
            }

            const childEventsBuiltForExport: Array<{ proposalId: string; date: string; title: string }> = []
            let allSegmentCreatesOk = true

            const siblingTitlesBlobForExport = segmentsToExport
              .map((r) => r.segment.title.trim())
              .join('\n')
            for (const row of segmentsToExport) {
              const childProposalId = makeEmbeddedChildProposalId(parentProposal.proposalId, row.origIndex)
              const slice = buildEmbeddedChildEventDraft(draft, row.segment, {
                childProposalId,
                siblingTitlesBlob: siblingTitlesBlobForExport,
              })
              const draftEv: TankestromEventDraft = {
                ...slice,
                title: slice.title.trim(),
                date: slice.date.trim(),
                start: normalizeTimeInput(slice.start),
                end: normalizeTimeInput(slice.end),
                personId: slice.personId,
                location: slice.location.trim(),
                notes: slice.notes.trim(),
              }
              const childPreflight = preflightEventValidationErrors(
                childProposalId,
                childProposalId,
                draftEv,
                validPersonIds
              )
              if (childPreflight.length > 0) {
                allSegmentCreatesOk = false
                for (const v of childPreflight) {
                  recordFailure(childProposalId, 'event', 'createEvent', 'validation', v.message, {
                    childId: childProposalId,
                    title: v.title,
                    date: v.date,
                    field: v.field,
                  })
                }
                continue
              }

              let baseMeta: Record<string, unknown> = { ...templateEvMeta }
              delete baseMeta.embeddedSchedule
              delete baseMeta.endDate
              delete baseMeta.multiDayAllDay
              baseMeta.isAllDay = false
              baseMeta.detachedFromEmbeddedParentId = parentProposal.proposalId
              baseMeta.detachedEmbeddedOrigIndex = row.origIndex

              const metadata: Record<string, unknown> = {
                ...baseMeta,
                sourceId: parentProposal.sourceId,
                integration: {
                  ...parentIntegration,
                  proposalId: childProposalId,
                },
              }
              const transportMeta: Record<string, unknown> = {}
              if (draftEv.dropoffBy.trim()) transportMeta.dropoffBy = draftEv.dropoffBy.trim()
              if (draftEv.pickupBy.trim()) transportMeta.pickupBy = draftEv.pickupBy.trim()
              if (Object.keys(transportMeta).length > 0) {
                metadata.transport = {
                  ...(baseMeta.transport && typeof baseMeta.transport === 'object' && !Array.isArray(baseMeta.transport)
                    ? (baseMeta.transport as Record<string, unknown>)
                    : {}),
                  ...transportMeta,
                }
              } else if (baseMeta.transport && typeof baseMeta.transport === 'object') {
                const prevT = { ...(baseMeta.transport as Record<string, unknown>) }
                delete prevT.dropoffBy
                delete prevT.pickupBy
                if (Object.keys(prevT).length > 0) metadata.transport = prevT
                else delete metadata.transport
              }
              mergeEventParticipantsIntoMetadata(metadata, draftEv, validPersonIds)
              sanitizeEmbeddedChildCalendarExportMetadata(metadata)
              applyEventTimingMetadataForPersist(metadata, draftEv)
              const scheduleDetails = structuredDetailsFromSegment(
                row.segment,
                normalizeEmbeddedScheduleParentDisplayTitle(draft.title.trim()).title,
                draftEv.title,
                childProposalId
              )
              attachTankestromDetailsToMetadata(metadata, scheduleDetails)

              const input: Omit<Event, 'id'> = {
                ...buildPersistTimes(draftEv),
                personId: normalizePersistedPersonId(draftEv.personId),
                title: draftEv.title,
                notes: buildPersistNotes(draftEv),
                location: draftEv.location.length > 0 ? draftEv.location : undefined,
                reminderMinutes: draftEv.reminderMinutes,
                recurrenceGroupId: undefined,
                metadata,
              }

              if (TANKESTROM_IMPORT_PERSIST_DEBUG) {
                console.debug('[tankestrom embedded child export]', {
                  embeddedScheduleChildExportPayloadBuilt: {
                    proposalId: childProposalId,
                    date: draftEv.date,
                    start: draftEv.start,
                    end: draftEv.end,
                    title: draftEv.title,
                  },
                  embeddedScheduleChildExportDateNormalized: draftEv.date,
                  embeddedScheduleChildExportEndDateRemoved: metadata.endDate === undefined,
                  embeddedScheduleChildExportMultiDayFlagsCleared: metadata.multiDayAllDay === undefined,
                  embeddedScheduleChildExportSingleDayConfirmed:
                    metadata.isAllDay === false && !metadata.endDate && metadata.embeddedSchedule === undefined,
                })
              }

              try {
                attemptedPersistOps += 1
                await persistCreateEvent(draftEv.date, input, childProposalId)
                recordSuccess(childProposalId, 'event', 'createEvent')
                const persisted = findCreatedEventByProposalId(childProposalId)
                if (persisted) {
                  pushCreatedEvent({
                    id: persisted.event.id,
                    title: persisted.event.title,
                    date: persisted.anchorDate,
                    start: persisted.event.start,
                    end: persisted.event.end,
                  })
                } else {
                  pushCreatedEvent({
                    id: childProposalId,
                    title: draftEv.title,
                    date: draftEv.date,
                    start: draftEv.start || null,
                    end: draftEv.end || null,
                  })
                }
                childEventsBuiltForExport.push({
                  proposalId: childProposalId,
                  date: draftEv.date,
                  title: draftEv.title,
                })
              } catch (e) {
                allSegmentCreatesOk = false
                const { kind, message, supabaseCode, supabaseMessage, supabaseDetails, supabaseHint } =
                  classifyTankestromPersistThrownError(e, 'createEvent')
                recordFailure(childProposalId, 'event', 'createEvent', kind, message, {
                  childId: childProposalId,
                  title: draftEv.title,
                  date: draftEv.date,
                  field: 'database',
                  supabaseCode,
                  supabaseMessage,
                  supabaseDetails,
                  supabaseHint,
                })
              }
            }

            if (TANKESTROM_IMPORT_PERSIST_DEBUG) {
              console.debug('[tankestrom embedded schedule export]', {
                embeddedScheduleChildEventsBuiltForExport: childEventsBuiltForExport,
                embeddedScheduleExportPolicyUsed,
              })
            }

            if (allSegmentCreatesOk) {
              recordSuccess(id, 'event', 'createEvent')
              if (item.originalSourceType === MANUAL_REVIEW_SOURCE_TYPE) {
                logEvent('manualReviewItemImported', { proposalId: id, kind: 'event' })
              }
            }
            continue
          }
        }

        const integration = {
          proposalId: item.proposalId,
          importRunId: bundle.provenance.importRunId,
          confidence: item.confidence,
          originalSourceType: item.originalSourceType,
          externalRef: item.externalRef,
          sourceSystem: bundle.provenance.sourceSystem,
        }

        let baseMeta: Record<string, unknown> = {}
        let recurrenceGroupId: string | undefined
        if (item.kind === 'event') {
          const ev = item.event
          recurrenceGroupId = draft.includeRecurrence ? ev.recurrenceGroupId : undefined
          baseMeta =
            ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata)
              ? { ...ev.metadata }
              : {}
          if (isEmbeddedScheduleParentCalendarItem(item)) {
            const rows = embeddedScheduleReviewRowsByParentId[item.proposalId] ?? []
            const included = rows.filter((r) =>
              selectedIds.has(makeEmbeddedChildProposalId(item.proposalId, r.origIndex))
            )
            const parentTitleForSegments = normalizeEmbeddedScheduleParentDisplayTitle(draft.title.trim()).title
            const siblingBlobEmbedded = included.map((r) => r.segment.title.trim()).join('\n')
            baseMeta.embeddedSchedule = included.map((r) => ({
              ...r.segment,
              title: embeddedScheduleChildCalendarExportTitle(
                r.segment,
                parentTitleForSegments,
                siblingBlobEmbedded
              ),
            }))
          }
        }

        const metadata: Record<string, unknown> = {
          ...baseMeta,
          sourceId: item.sourceId,
          integration,
        }
        const transportMeta: Record<string, unknown> = {}
        if (draft.dropoffBy.trim()) transportMeta.dropoffBy = draft.dropoffBy.trim()
        if (draft.pickupBy.trim()) transportMeta.pickupBy = draft.pickupBy.trim()
        if (Object.keys(transportMeta).length > 0) {
          metadata.transport = {
            ...(baseMeta.transport && typeof baseMeta.transport === 'object' && !Array.isArray(baseMeta.transport)
              ? (baseMeta.transport as Record<string, unknown>)
              : {}),
            ...transportMeta,
          }
        } else if (baseMeta.transport && typeof baseMeta.transport === 'object') {
          const prev = { ...(baseMeta.transport as Record<string, unknown>) }
          delete prev.dropoffBy
          delete prev.pickupBy
          if (Object.keys(prev).length > 0) metadata.transport = prev
          else delete metadata.transport
        }
        mergeEventParticipantsIntoMetadata(metadata, draft, validPersonIds)
        applyEventTimingMetadataForPersist(metadata, draft)
        if (item.kind === 'event') {
          const details = readTankestromScheduleDetailsFromMetadata(item.event.metadata as EventMetadata)
          attachTankestromDetailsToMetadata(metadata, details)
        }
        const calendarTitle =
          item.kind === 'event' && isEmbeddedScheduleParentCalendarItem(item)
            ? normalizeEmbeddedScheduleParentDisplayTitle(draft.title.trim()).title
            : draft.title.trim()
        const input: Omit<Event, 'id'> = {
          ...buildPersistTimes(draft),
          personId: normalizePersistedPersonId(draft.personId),
          title: calendarTitle,
          notes: buildPersistNotes(draft),
          location: draft.location.length > 0 ? draft.location : undefined,
          reminderMinutes: draft.reminderMinutes,
          recurrenceGroupId,
          metadata,
        }
        const preflight = preflightEventValidationErrors(id, undefined, draft, validPersonIds)
        if (preflight.length > 0) {
          for (const v of preflight) {
            recordFailure(id, 'event', 'createEvent', 'validation', v.message, {
              title: v.title,
              date: v.date,
              field: v.field,
            })
          }
          continue
        }
        try {
          attemptedPersistOps += 1
          await persistCreateEvent(draft.date, input, id)
          recordSuccess(id, 'event', 'createEvent')
          const persisted = findCreatedEventByProposalId(id)
          if (persisted) {
            pushCreatedEvent({
              id: persisted.event.id,
              title: persisted.event.title,
              date: persisted.anchorDate,
              start: persisted.event.start,
              end: persisted.event.end,
            })
          } else {
            pushCreatedEvent({
              id,
              title: calendarTitle,
              date: draft.date,
              start: draft.start || null,
              end: draft.end || null,
            })
          }
          if (item.originalSourceType === MANUAL_REVIEW_SOURCE_TYPE) {
            logEvent('manualReviewItemImported', { proposalId: id, kind: 'event' })
          }
        } catch (e) {
          const { kind, message, supabaseCode, supabaseMessage, supabaseDetails, supabaseHint } =
            classifyTankestromPersistThrownError(e, 'createEvent')
          recordFailure(id, 'event', 'createEvent', kind, message, {
            title: draft.title,
            date: draft.date,
            field: 'database',
            supabaseCode,
            supabaseMessage,
            supabaseDetails,
            supabaseHint,
          })
        }
      }
      const taskPersistFailures = failureRecords.filter(
        (f) => f.proposalSurfaceType === 'task' && f.operation === 'createTask'
      )
      if (taskPersistFailures.length > 0 && TANKESTROM_IMPORT_PERSIST_DEBUG) {
        const kinds = [...new Set(taskPersistFailures.map((f) => f.kind))]
        const messages = taskPersistFailures.map((f) => f.message)
        console.debug('[tankestrom task persist]', {
          tankestromTaskPersistFailureSharedPattern: {
            failureCount: taskPersistFailures.length,
            distinctKinds: kinds,
            allSameKind: kinds.length === 1,
            distinctMessages: [...new Set(messages)],
            proposalIds: taskPersistFailures.map((f) => f.proposalId),
            taskPersistLoopSequentialAwait: true,
            tankestromTaskPersistLikelyConcurrencyIssue: false,
            tankestromTaskPersistLikelyValidationIssue: taskPersistFailures.some(
              (f) =>
                f.kind === 'validation' ||
                (f.taskPersistContext?.title?.trim() ?? '') === '' ||
                !/^\d{4}-\d{2}-\d{2}$/.test((f.taskPersistContext?.date ?? '').trim())
            ),
            tankestromTaskPersistSharedRootCauseDetected:
              taskPersistFailures.length >= 2 &&
              new Set(taskPersistFailures.map(taskPersistFailureCanonicalBucket)).size === 1,
            distinctSupabaseCodes: [...new Set(taskPersistFailures.map((f) => f.supabaseCode ?? '(ingen kode)'))],
            tankestromTaskPersistPayloadFingerprints: taskPersistFailures.map((f) =>
              f.taskPersistContext
                ? buildTankestromTaskPersistPayloadFingerprint({
                    title: f.taskPersistContext.title,
                    date: f.taskPersistContext.date,
                    notes: undefined,
                    dueTime: f.taskPersistContext.dueTime,
                    childPersonId: f.taskPersistContext.childPersonId ?? undefined,
                    assignedToPersonId: f.taskPersistContext.assignedToPersonId ?? undefined,
                    showInMonthView: undefined,
                    taskIntent: f.taskPersistContext.taskIntent as Task['taskIntent'],
                  })
                : '(no snapshot)'
            ),
            failedTasksDiagnostic: taskPersistFailures.map((f) => ({
              proposalId: f.proposalId,
              kind: f.kind,
              message: f.message,
              canonicalBucket: taskPersistFailureCanonicalBucket(f),
              ...buildTaskPersistFailureSupabaseDebugPayload(f),
              ...f.taskPersistContext,
            })),
          },
        })
      }

      const actualCalendarRows = createdEvents.length + updatedEvents.length
      if (
        promisedForeground > actualCalendarRows &&
        createdTasks.length > 0 &&
        failed === 0 &&
        failureRecords.length === 0
      ) {
        const missing = promisedForeground - actualCalendarRows
        const shortfallMsg = `Gjøremål ble importert, men ${missing} kalenderhendelse(r) ble ikke opprettet.`
        setError(shortfallMsg)
        setLastImportAttempt({
          status: 'partial_success',
          id: importAttemptId,
          startedAt: attemptStartedAt,
          debug: buildDebug('calendar_shortfall_without_recorded_failures'),
          createdEvents,
          updatedEvents,
          createdTasks,
          failures: [],
        })
        await postImportPrefetchCalendar()
        return {
          ok: true,
          partial: true,
          failureMessage: shortfallMsg,
          success: {
            createdEvents,
            updatedEvents,
            createdTasks,
            arrangementTitle: selectedArrangementTitle,
            promisedForegroundEventCount: promisedForeground,
          },
          importAttemptId,
          terminalStatus: 'partial_success',
        }
      }

      if (failed > 0) {
        const bullets = buildTankestromImportFailureBulletBlock(failureRecords)
        const userFacingFailure = buildTankestromImportFailureUserMessage(failureRecords, ids.length)
        const composed = `Kunne ikke importere:\n${bullets}\n\n${userFacingFailure}`
        setError(composed)
        logTankestromImportPersist({
          tankestromImportFailureSummaryBuilt: true,
          tankestromImportFailedProposalIds: [...failedIds],
          tankestromImportSucceededProposalIds: ids.filter((i) => !failedIds.has(i)),
          tankestromImportFailureKindCounts: aggregatePersistFailureKinds(failureRecords),
          tankestromImportUserFacingFailureMessageBuilt: composed,
          tankestromImportTaskFailureUserMessageRefined: composed,
        })
        const hasAnySuccess = createdEvents.length > 0 || updatedEvents.length > 0 || createdTasks.length > 0
        if (hasAnySuccess) {
          setLastImportAttempt({
            status: 'partial_success',
            id: importAttemptId,
            startedAt: attemptStartedAt,
            debug: buildDebug(),
            createdEvents,
            updatedEvents,
            createdTasks,
            failures: failureRecords,
          })
          await postImportPrefetchCalendar()
          return {
            ok: true,
            partial: true,
            failureMessage: composed,
            success: {
              createdEvents,
              updatedEvents,
              createdTasks,
              arrangementTitle: selectedArrangementTitle,
              promisedForegroundEventCount: promisedForeground,
            },
            importAttemptId,
            terminalStatus: 'partial_success',
          }
        }
        setLastImportAttempt({
          status: 'failed',
          id: importAttemptId,
          startedAt: attemptStartedAt,
          debug: buildDebug(),
          failures: failureRecords,
        })
        return {
          ok: false,
          partial: false,
          failureMessage: composed,
          importAttemptId,
          terminalStatus: 'failed',
        }
      }
      if (
        attemptedPersistOps === 0 &&
        createdEvents.length === 0 &&
        updatedEvents.length === 0 &&
        createdTasks.length === 0
      ) {
        const noopMessage = 'Importen ga ingen resultat. Ingen hendelser eller gjøremål ble lagret.'
        const noopHint =
          ids.length > 0
            ? '\n\nIngen kalenderhendelser eller gjøremål kunne bygges fra valget. Åpne Rediger og sjekk dato, tid og type.'
            : ''
        const fullNoop = noopMessage + noopHint
        console.error('[Tankestrom import noop_bug]', {
          importAttemptId,
          message: fullNoop,
          selectedProposalIds: ids,
          selectedActions,
          persistPlan: persistPlanPreview,
          attemptedPersistOps,
          selectedRowsByParent: Object.fromEntries(
            Object.entries(embeddedScheduleReviewRowsByParentId).map(([pid, rows]) => [
              pid,
              rows.filter((r) => selectedIds.has(makeEmbeddedChildProposalId(pid, r.origIndex))).length,
            ])
          ),
        })
        setLastImportAttempt({
          status: 'noop_bug',
          id: importAttemptId,
          startedAt: attemptStartedAt,
          debug: buildDebug('zero_persist_ops'),
        })
        setError(fullNoop)
        return {
          ok: false,
          partial: false,
          failureMessage: fullNoop,
          importAttemptId,
          terminalStatus: 'noop_bug',
        }
      }

      const hasEmptyOutcome =
        createdEvents.length === 0 &&
        updatedEvents.length === 0 &&
        createdTasks.length === 0 &&
        failureRecords.length === 0

      if (hasEmptyOutcome && attemptedPersistOps > 0) {
        const noopMessage = 'Importen ga ingen resultat. Ingen hendelser eller gjøremål ble lagret.'
        console.error('[Tankestrom import noop_bug]', {
          importAttemptId,
          reason: 'persist_ops_without_tracked_outcome',
          attemptedPersistOps,
          selectedProposalIds: ids,
        })
        setLastImportAttempt({
          status: 'noop_bug',
          id: importAttemptId,
          startedAt: attemptStartedAt,
          debug: buildDebug('persist_ops_without_tracked_outcome'),
        })
        setError(noopMessage)
        return {
          ok: false,
          partial: false,
          failureMessage: noopMessage,
          importAttemptId,
          terminalStatus: 'noop_bug',
        }
      }

      console.info('[Tankestrom import result]', {
        createdEvents,
        updatedEvents,
        createdTasks,
        failures: failureRecords,
      })
      logTankestromImportPersist({
        tankestromImportFailureSummaryBuilt: true,
        tankestromImportFailedProposalIds: [],
        tankestromImportSucceededProposalIds: ids,
        tankestromImportPersistBatchComplete: true,
      })
      await postImportPrefetchCalendar()
      setLastImportAttempt({
        status: 'success',
        id: importAttemptId,
        startedAt: attemptStartedAt,
        debug: buildDebug(),
        createdEvents,
        updatedEvents,
        createdTasks,
      })
      return {
        ok: true,
        partial: false,
        success: {
          createdEvents,
          updatedEvents,
          createdTasks,
          arrangementTitle: selectedArrangementTitle,
          promisedForegroundEventCount: promisedForeground,
        },
        importAttemptId,
        terminalStatus: 'success',
      }
    } catch (error) {
      console.error('[Tankestrom import fatal error]', error)
      const message = error instanceof Error ? error.message : 'Importen feilet uventet. Prøv igjen.'
      setError(message)
      setLastImportAttempt({
        status: 'failed',
        id: importAttemptId,
        startedAt: attemptStartedAt,
        debug: {
          selectedProposalIds: [...ids],
          selectedActions: selectedActions.map((a) => ({ ...a })),
          persistPlan: [],
          persistPlanLength: 0,
          attemptedPersistOps: 0,
          createdEventsCount: 0,
          updatedEventsCount: 0,
          createdTasksCount: 0,
          failuresCount: 1,
          noopReason: 'fatal_exception',
        },
        failures: [preflightImportFailureRecord(message)],
      })
      return {
        ok: false,
        partial: false,
        failureMessage: message,
        importAttemptId,
        terminalStatus: 'failed',
      }
    } finally {
      setSaveLoading(false)
    }
  }, [
    bundle,
    proposalItems,
    selectedIds,
    draftByProposalId,
    validPersonIds,
    createEvent,
    createTask,
    schoolReview,
    embeddedScheduleReviewRowsByParentId,
    detachedEmbeddedChildIds,
    detachedEmbeddedChildren,
    editEvent,
    getAnchoredForegroundEventsForMatching,
    deleteEvent,
    existingEventLinkByProposalId,
    existingEventUpdateTarget,
    existingEventMatchesByProposalId,
  ])

  /**
   * Lagrer uke-overlay (hvis den finnes), deretter importerer avkryssede hendelser/gjøremål.
   * Brukes i «general review» når overlay og items kan komme samtidig fra A-plan.
   */
  const saveSchoolWeekOverlayThenCalendarSelection = useCallback(async (): Promise<TankestromImportResult> => {
    if (schoolReview) return { ok: false, partial: false }
    const overlay = bundle?.schoolWeekOverlayProposal
    if (overlay) {
      const okOverlay = await saveSchoolWeekOverlay()
      if (!okOverlay) return { ok: false, partial: false }
    }
    if (selectedIds.size === 0) return { ok: true, partial: false }
    return approveSelected()
  }, [schoolReview, bundle?.schoolWeekOverlayProposal, saveSchoolWeekOverlay, selectedIds, approveSelected])

  const promoteSecondaryImportCandidate = useCallback(
    (c: PortalSecondaryImportCandidate, targetKind: 'event' | 'task') => {
      const defaultPersonId = people[0]?.id ?? ''
      const hint = bundle ? humanImportSourceLabelForBundle(bundle) : undefined

      if (c.sourceProposalId) {
        const pid = c.sourceProposalId
        const item = bundle?.items.find((i) => i.proposalId === pid)
        if (item && (item.kind === 'event' || item.kind === 'task')) {
          if (
            (targetKind === 'task' && item.kind !== 'task') ||
            (targetKind === 'event' && item.kind !== 'event')
          ) {
            setProposalImportKind(pid, targetKind)
          }
        }
        setSecondaryPromotedProposalIds((prev) => new Set(prev).add(pid))
        setSelectedIds((prev) => new Set(prev).add(pid))
        logEvent(targetKind === 'task' ? 'secondaryCandidatePromotedToTask' : 'secondaryCandidatePromotedToEvent', {
          candidateId: c.candidateId,
          sourceProposalId: pid,
          confidence: c.confidence,
          suggestedKind: c.suggestedKind,
        })
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
          console.debug(
            targetKind === 'task' ? 'secondaryCandidatePromotedToTask' : 'secondaryCandidatePromotedToEvent',
            { candidateId: c.candidateId, sourceProposalId: pid }
          )
        }
        return
      }

      if (!bundle) return
      const newItem: PortalProposalItem =
        targetKind === 'task'
          ? buildTaskProposalFromSecondaryCandidate(c, bundle.provenance)
          : buildEventProposalFromSecondaryCandidate(c, bundle.provenance)

      setBundle((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : null))
      setDraftByProposalId((prev) => ({
        ...prev,
        [newItem.proposalId]: importDraftFromProposal(
          newItem,
          validPersonIds,
          defaultPersonId,
          people,
          hint
        ),
      }))
      setSelectedIds((prev) => new Set(prev).add(newItem.proposalId))
      setSecondaryDismissedCandidateIds((prev) => new Set(prev).add(c.candidateId))
      logEvent(targetKind === 'task' ? 'secondaryCandidatePromotedToTask' : 'secondaryCandidatePromotedToEvent', {
        candidateId: c.candidateId,
        newProposalId: newItem.proposalId,
        confidence: c.confidence,
        suggestedKind: c.suggestedKind,
        apiOnly: true,
      })
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
        console.debug(
          targetKind === 'task' ? 'secondaryCandidatePromotedToTask' : 'secondaryCandidatePromotedToEvent',
          { candidateId: c.candidateId, newProposalId: newItem.proposalId, apiOnly: true }
        )
      }
    },
    [bundle, people, validPersonIds, setProposalImportKind]
  )

  const dismissSecondaryImportCandidate = useCallback((c: PortalSecondaryImportCandidate, reason: 'ignore' | 'noise') => {
    setSecondaryDismissedCandidateIds((prev) => new Set(prev).add(c.candidateId))
    if (reason === 'noise') {
      logEvent('secondaryCandidateSuppressedAsNoise', {
        candidateId: c.candidateId,
        titleSnippet: c.title.slice(0, 120),
      })
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
        console.debug('secondaryCandidateSuppressedAsNoise', { candidateId: c.candidateId })
      }
    } else {
      logEvent('secondaryCandidateIgnored', {
        candidateId: c.candidateId,
        confidence: c.confidence,
        suggestedKind: c.suggestedKind,
      })
    }
  }, [])

  return {
    step,
    inputMode,
    setInputMode: setInputModeSafe,
    file,
    pendingFiles,
    addFilesFromList,
    removePendingFile,
    textInput,
    setTextInput: setTextInputSafe,
    bundle,
    proposalItems,
    calendarProposalItems,
    primaryCalendarProposalItems,
    visibleSecondaryImportCandidates,
    promoteSecondaryImportCandidate,
    dismissSecondaryImportCandidate,
    eventProposals,
    selectedIds,
    toggleProposal,
    draftByProposalId,
    updateEventDraft,
    updateTaskDraft,
    setProposalImportKind,
    analyzeLoading,
    saveLoading,
    error,
    lastImportAttempt,
    analyzeWarning,
    runAnalyze,
    reanalyzeFromSameInput,
    addManualReviewTask,
    addManualReviewEvent,
    approveSelected,
    saveSchoolProfile,
    people,
    canApproveSelection,
    canSaveSchoolProfile,
    canSaveSchoolWeekOverlay,
    schoolReview,
    schoolProfileChildId,
    setSchoolProfileChildId,
    setSchoolProfileDraft,
    saveSchoolWeekOverlay,
    saveSchoolWeekOverlayThenCalendarSelection,
    setSchoolWeekOverlayProposalDraft,
    embeddedScheduleReviewRowsByParentId,
    detachedEmbeddedChildren,
    detachEmbeddedScheduleChild,
    updateEmbeddedScheduleSegment,
    applyReviewBulkPersonTargets,
    existingEventMatchesByProposalId,
    existingEventLinkByProposalId,
    setExistingEventImportLink,
  }
}
