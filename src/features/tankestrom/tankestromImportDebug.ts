/**
 * Dev-only helpers for Tankestrøm import pipeline inspection (ingen funksjonell importlogikk).
 */
import type { EmbeddedScheduleSegment, EventMetadata } from '../../types'
import { normalizeEmbeddedSegmentScheduleDetails, parseEmbeddedScheduleFromMetadata } from '../../lib/embeddedSchedule'
import {
  embeddedScheduleChildCalendarExportTitle,
  embeddedScheduleChildTitleForReview,
  normalizeEmbeddedScheduleParentDisplayTitle,
} from '../../lib/tankestromCupEmbeddedScheduleMerge'
import {
  embeddedScheduleChildReviewListTimeClock,
  tryDeriveOppmoteStartFromSegmentNotes,
} from '../../lib/tankestromEmbeddedChildNotesPresentation'
import { readTankestromScheduleDetailsFromMetadata } from '../../lib/tankestromScheduleDetails'
import { normalizeNotesDedupeKey } from '../../lib/tankestromReviewNotesDisplay'
import { semanticTitleCore } from '../../lib/tankestromImportDedupe'
import type { PortalImportProposalBundle, PortalProposalItem } from './types'

export const TANKESTROM_IMPORT_DEBUG_MAX_STRING = 400

export function isTankestromImportDebugVisible(): boolean {
  return (
    import.meta.env.DEV === true ||
    import.meta.env.VITE_SHOW_TANKESTROM_DEBUG === 'true'
  )
}

export function truncateDebugString(value: string, maxLen = TANKESTROM_IMPORT_DEBUG_MAX_STRING): string {
  if (value.length <= maxLen) return value
  return `${value.slice(0, maxLen)}…[truncated]`
}

const SENSITIVE_KEY = /(apikey|api_key|secret|token|password|authorization|bearer|anon|supabase|privatekey|openai|anthropic)/i

const BASE64_LIKE = /^[A-Za-z0-9+/=\s]{120,}$/

function sanitizeDebugValueInner(value: unknown, maxLen: number, depth: number): unknown {
  if (depth > 12) return '[max-depth]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    const t = value.trim()
    if (BASE64_LIKE.test(t.replace(/\s/g, ''))) return '[base64-like omitted]'
    return truncateDebugString(value, maxLen)
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value.slice(0, 200).map((v) => sanitizeDebugValueInner(v, maxLen, depth + 1))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) continue
      out[k] = sanitizeDebugValueInner(v, maxLen, depth + 1)
    }
    return out
  }
  return String(value)
}

/** Saniterer snapshot før clipboard — ingen API-nøkler, korte strenger, ingen lange base64-lignende felt. */
export function sanitizeForDebugClipboard(value: unknown, maxLen = TANKESTROM_IMPORT_DEBUG_MAX_STRING): unknown {
  return sanitizeDebugValueInner(value, maxLen, 0)
}

export type RawItemSummary = {
  kind: string
  proposalId: string
  title?: string
  date?: string
  start?: string
  end?: string
  metadataKeys: string[]
  embeddedScheduleCount?: number
  isArrangementParent?: boolean
  isArrangementChild?: boolean
  exportAsCalendarEvent?: boolean
}

export type RawBundleSection = {
  itemCount: number
  eventCount: number
  taskCount: number
  parentCount: number
  childCount: number
  embeddedScheduleCount: number
  fileErrorsCount: number
  importRunId: string
  sourceType?: string
  items: RawItemSummary[]
}

export type PipelineSegmentSummary = {
  parentProposalId: string
  parentTitle: string
  date: string
  title: string
  start?: string
  end?: string
  timePrecision?: string
  isConditional?: boolean
  highlights: Array<{ time: string; label: string }>
  notes: string[]
  bringItems: string[]
  dayContentHighlights?: unknown
}

export type DefensiveSegmentSummary = PipelineSegmentSummary & {
  normalizedHighlights: Array<{ time: string; label: string }>
  normalizedNotes: string[]
  normalizedBringItems: string[]
  removedFragments: string[]
  removedDuplicateHighlights: number
  removedHighlights: string[]
}

export type PipelineSection = {
  itemCount: number
  parentCount: number
  childCount: number
  embeddedScheduleRawCount: number
  embeddedScheduleDedupedCount: number
  segments: PipelineSegmentSummary[]
}

export type DefensivePipelineSection = Omit<PipelineSection, 'segments'> & {
  segments: DefensiveSegmentSummary[]
}

export type RenderInputDebugRow = {
  parentProposalId: string
  childProposalId: string
  title: string
  date: string
  displayedTime: string
  status: string
  highlightsForScheduleDetails: Array<{ time: string; label: string; type?: string }>
  notesForScheduleDetails: string[]
  bringItems: string[]
  timeWindowSummaries: Array<{ timeRange: string; label: string; tentative?: boolean }>
}

export type PersistPlanDebugRow = {
  planSurface: 'event' | 'task'
  proposalId: string
  childId?: string
  mode: string
  title: string
  date: string
  start: string
  end: string
  personId: string
  timePrecision?: string
  validationErrors: string[]
}

export type TankestromImportPipelineAnalyzeSnapshot = {
  capturedAt: string
  raw: RawBundleSection
  /** Alle innebygde programpunkt før legacy fold (også når isArrangementParent ikke er satt ennå). */
  rawEmbeddedSegments: PipelineSegmentSummary[]
  afterLegacyFold: PipelineSection
  afterDefensive: DefensivePipelineSection
  itemCountBeforeFold: number
  itemCountAfterFold: number
}

export type TankestromImportFullDebugSnapshot = {
  generatedAt: string
  analyze: TankestromImportPipelineAnalyzeSnapshot | null
  renderInput: RenderInputDebugRow[]
  persistPlan: PersistPlanDebugRow[]
  lastImportAttemptStatus?: string
  analyzeWarning: string | null
  warnings: string[]
}

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null
}

function metadataKeys(meta: unknown): string[] {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return []
  return Object.keys(meta as Record<string, unknown>).sort()
}

function summarizeRawItem(it: PortalProposalItem): RawItemSummary {
  if (it.kind === 'event') {
    const meta = asRecord(it.event.metadata)
    const emb = meta && Array.isArray(meta.embeddedSchedule) ? meta.embeddedSchedule.length : 0
    return {
      kind: 'event',
      proposalId: it.proposalId,
      title: it.event.title,
      date: it.event.date,
      start: it.event.start,
      end: it.event.end,
      metadataKeys: metadataKeys(it.event.metadata),
      embeddedScheduleCount: emb,
      isArrangementParent: meta?.isArrangementParent === true,
      isArrangementChild: meta?.isArrangementChild === true || typeof meta?.parentArrangementStableKey === 'string',
      exportAsCalendarEvent: meta?.exportAsCalendarEvent === true,
    }
  }
  if (it.kind === 'task') {
    return {
      kind: 'task',
      proposalId: it.proposalId,
      title: it.task.title,
      date: it.task.date,
      metadataKeys: [],
    }
  }
  if (it.kind === 'school_profile') {
    return {
      kind: 'school_profile',
      proposalId: it.proposalId,
      metadataKeys: metadataKeys(it.schoolProfile),
    }
  }
  return {
    kind: (it as { kind: string }).kind ?? 'unknown',
    proposalId: (it as { proposalId: string }).proposalId,
    metadataKeys: [],
  }
}

function countParentsChildrenEmbedded(items: PortalProposalItem[]): {
  parentCount: number
  childCount: number
  embeddedScheduleCount: number
} {
  let parentCount = 0
  let childCount = 0
  let embeddedScheduleCount = 0
  for (const it of items) {
    if (it.kind !== 'event') continue
    const meta = asRecord(it.event.metadata)
    if (!meta) continue
    if (meta.isArrangementParent === true) parentCount += 1
    if (meta.isArrangementChild === true || typeof meta.parentArrangementStableKey === 'string') childCount += 1
    const emb = Array.isArray(meta.embeddedSchedule) ? meta.embeddedSchedule : []
    embeddedScheduleCount += emb.length
  }
  return { parentCount, childCount, embeddedScheduleCount }
}

function countEmbeddedRows(items: PortalProposalItem[]): number {
  let n = 0
  for (const it of items) {
    if (it.kind !== 'event') continue
    const meta = asRecord(it.event.metadata)
    const emb = Array.isArray(meta?.embeddedSchedule) ? (meta!.embeddedSchedule as unknown[]) : []
    n += emb.length
  }
  return n
}

function shapeEmbeddedSegmentForScheduleDetails(seg: EmbeddedScheduleSegment): EventMetadata {
  const normalized = normalizeEmbeddedSegmentScheduleDetails(seg as unknown as Record<string, unknown>)
  return {
    tankestromHighlights: normalized.tankestromHighlights,
    tankestromNotes: normalized.tankestromNotes,
    bringItems: normalized.bringItems,
    packingItems: normalized.packingItems,
    timeWindow: seg.timeWindow,
    tankestromTimeWindowSummaries: seg.tankestromTimeWindowSummaries,
    timeWindowCandidates: normalized.timeWindowCandidates,
  }
}

function readTimePrecisionFromSegment(seg: EmbeddedScheduleSegment): string | undefined {
  const r = seg as unknown as Record<string, unknown>
  const tp = r.timePrecision
  return typeof tp === 'string' ? tp : undefined
}

function readDayContentHighlights(seg: EmbeddedScheduleSegment): unknown {
  const r = seg as unknown as Record<string, unknown>
  const dc = r.dayContent
  if (!dc || typeof dc !== 'object' || Array.isArray(dc)) return undefined
  return (dc as Record<string, unknown>).highlights
}

/** Rå uttrekk for debug: alle hendelser med embeddedSchedule (uavhengig av parent-flagg). */
function buildRawEmbeddedSegmentSummaries(items: PortalProposalItem[]): PipelineSegmentSummary[] {
  const out: PipelineSegmentSummary[] = []
  for (const it of items) {
    if (it.kind !== 'event') continue
    const meta = asRecord(it.event.metadata)
    if (!meta || !Array.isArray(meta.embeddedSchedule) || meta.embeddedSchedule.length === 0) continue
    const parentProposalId = it.proposalId
    const parentTitle = it.event.title
    const parsed = parseEmbeddedScheduleFromMetadata(meta as EventMetadata)
    for (const seg of parsed) {
      const normEmb = normalizeEmbeddedSegmentScheduleDetails(seg as unknown as Record<string, unknown>)
      out.push({
        parentProposalId,
        parentTitle,
        date: seg.date,
        title: seg.title,
        start: seg.start,
        end: seg.end,
        timePrecision: readTimePrecisionFromSegment(seg),
        isConditional: seg.isConditional === true,
        highlights: normEmb.tankestromHighlights.map((h) => ({ time: h.time, label: h.label })),
        notes: [...normEmb.tankestromNotes],
        bringItems: [...normEmb.bringItems],
        dayContentHighlights: readDayContentHighlights(seg),
      })
    }
  }
  return out
}

function buildPipelineSegmentsForFold(items: PortalProposalItem[]): PipelineSegmentSummary[] {
  const out: PipelineSegmentSummary[] = []
  for (const it of items) {
    if (it.kind !== 'event') continue
    const meta = asRecord(it.event.metadata)
    if (!meta || meta.isArrangementParent !== true) continue
    const parentProposalId = it.proposalId
    const parentTitle = it.event.title
    const parsed = parseEmbeddedScheduleFromMetadata(meta as EventMetadata)
    for (const seg of parsed) {
      const normEmb = normalizeEmbeddedSegmentScheduleDetails(seg as unknown as Record<string, unknown>)
      const base: PipelineSegmentSummary = {
        parentProposalId,
        parentTitle,
        date: seg.date,
        title: seg.title,
        start: seg.start,
        end: seg.end,
        timePrecision: readTimePrecisionFromSegment(seg),
        isConditional: seg.isConditional === true,
        highlights: normEmb.tankestromHighlights.map((h) => ({ time: h.time, label: h.label })),
        notes: [...normEmb.tankestromNotes],
        bringItems: [...normEmb.bringItems],
        dayContentHighlights: readDayContentHighlights(seg),
      }
      out.push(base)
    }
  }
  return out
}

function buildPipelineSegmentsForDefensive(items: PortalProposalItem[]): DefensiveSegmentSummary[] {
  const out: DefensiveSegmentSummary[] = []
  for (const it of items) {
    if (it.kind !== 'event') continue
    const meta = asRecord(it.event.metadata)
    if (!meta || meta.isArrangementParent !== true) continue
    const parentProposalId = it.proposalId
    const parentTitle = it.event.title
    const parsed = parseEmbeddedScheduleFromMetadata(meta as EventMetadata)
    const siblingBlob = parsed.map((s) => s.title.trim()).join('\n')
    for (const seg of parsed) {
      const normEmb = normalizeEmbeddedSegmentScheduleDetails(seg as unknown as Record<string, unknown>)
      const base: PipelineSegmentSummary = {
        parentProposalId,
        parentTitle,
        date: seg.date,
        title: seg.title,
        start: seg.start,
        end: seg.end,
        timePrecision: readTimePrecisionFromSegment(seg),
        isConditional: seg.isConditional === true,
        highlights: normEmb.tankestromHighlights.map((h) => ({ time: h.time, label: h.label })),
        notes: [...normEmb.tankestromNotes],
        bringItems: [...normEmb.bringItems],
        dayContentHighlights: readDayContentHighlights(seg),
      }
      const exportTitle = embeddedScheduleChildCalendarExportTitle(seg, parentTitle, siblingBlob)
      const shaped = shapeEmbeddedSegmentForScheduleDetails(seg)
      const normalized = readTankestromScheduleDetailsFromMetadata(shaped, [exportTitle, parentTitle], {
        fallbackStartTime: seg.start,
      })
      out.push({
        ...base,
        normalizedHighlights: normalized.highlights.map((h) => ({ time: h.time, label: h.label })),
        normalizedNotes: [...normalized.notes],
        normalizedBringItems: [...normalized.bringItems],
        removedFragments: [...normalized.removedFragments],
        removedDuplicateHighlights: normalized.removedDuplicateHighlights,
        removedHighlights: [...normalized.removedHighlights],
      })
    }
  }
  return out
}

function buildRawSection(
  items: PortalProposalItem[],
  provenance: PortalImportProposalBundle['provenance'],
  fileErrorsCount: number
): RawBundleSection {
  const eventCount = items.filter((i) => i.kind === 'event').length
  const taskCount = items.filter((i) => i.kind === 'task').length
  const { parentCount, childCount, embeddedScheduleCount } = countParentsChildrenEmbedded(items)
  return {
    itemCount: items.length,
    eventCount,
    taskCount,
    parentCount,
    childCount,
    embeddedScheduleCount,
    fileErrorsCount,
    importRunId: provenance.importRunId ?? '',
    sourceType: provenance.sourceType,
    items: items.map(summarizeRawItem),
  }
}

function buildFoldPipelineSection(items: PortalProposalItem[]): PipelineSection {
  const { parentCount, childCount } = countParentsChildrenEmbedded(items)
  const embeddedScheduleRawCount = countEmbeddedRows(items)
  const segments = buildPipelineSegmentsForFold(items)
  return {
    itemCount: items.length,
    parentCount,
    childCount,
    embeddedScheduleRawCount,
    embeddedScheduleDedupedCount: embeddedScheduleRawCount,
    segments,
  }
}

function buildDefensivePipelineSection(items: PortalProposalItem[]): DefensivePipelineSection {
  const { parentCount, childCount } = countParentsChildrenEmbedded(items)
  const embeddedScheduleRawCount = countEmbeddedRows(items)
  const segments = buildPipelineSegmentsForDefensive(items)
  return {
    itemCount: items.length,
    parentCount,
    childCount,
    embeddedScheduleRawCount,
    embeddedScheduleDedupedCount: embeddedScheduleRawCount,
    segments,
  }
}

export function captureImportPipelineAnalyzeSnapshot(input: {
  rawItems: PortalProposalItem[]
  afterLegacyFoldItems: PortalProposalItem[]
  afterDefensiveItems: PortalProposalItem[]
  provenance: PortalImportProposalBundle['provenance']
  fileErrorsCount: number
}): TankestromImportPipelineAnalyzeSnapshot {
  const foldSection = buildFoldPipelineSection(input.afterLegacyFoldItems)
  const defSection = buildDefensivePipelineSection(input.afterDefensiveItems)
  const embeddedAfterFold = countEmbeddedRows(input.afterLegacyFoldItems)
  const embeddedAfterDefensive = countEmbeddedRows(input.afterDefensiveItems)
  foldSection.embeddedScheduleRawCount = embeddedAfterFold
  foldSection.embeddedScheduleDedupedCount = embeddedAfterDefensive
  defSection.embeddedScheduleRawCount = embeddedAfterFold
  defSection.embeddedScheduleDedupedCount = embeddedAfterDefensive
  return {
    capturedAt: new Date().toISOString(),
    raw: buildRawSection(input.rawItems, input.provenance, input.fileErrorsCount),
    rawEmbeddedSegments: buildRawEmbeddedSegmentSummaries(input.rawItems),
    afterLegacyFold: foldSection,
    afterDefensive: defSection,
    itemCountBeforeFold: input.rawItems.length,
    itemCountAfterFold: input.afterLegacyFoldItems.length,
  }
}

/** Matcher visningslogikken i import-dialogen (delprogram-rad). */
export function buildRenderInputDebugRows(input: {
  bundle: PortalImportProposalBundle | null
  embeddedScheduleReviewRowsByParentId: Record<string, Array<{ origIndex: number; segment: EmbeddedScheduleSegment }>>
  draftByProposalId: Record<string, { importKind: string; event?: { title: string } }>
  makeChildProposalId: (parentProposalId: string, origIndex: number) => string
}): RenderInputDebugRow[] {
  const { bundle, embeddedScheduleReviewRowsByParentId, draftByProposalId, makeChildProposalId } = input
  if (!bundle) return []
  const rows: RenderInputDebugRow[] = []
  for (const [parentProposalId, embRows] of Object.entries(embeddedScheduleReviewRowsByParentId)) {
    const item = bundle.items.find((i) => i.proposalId === parentProposalId)
    if (!item || item.kind !== 'event') continue
    const draft = draftByProposalId[parentProposalId]
    if (!draft || draft.importKind !== 'event') continue
    const cardTitleRaw = draft.event?.title?.trim() || 'Uten tittel'
    const parentCalendarCore = normalizeEmbeddedScheduleParentDisplayTitle(cardTitleRaw).title
    const siblingTitlesBlob = embRows.map((r) => r.segment.title.trim()).join('\n')
    for (const row of embRows) {
      const seg = row.segment
      const childProposalId = makeChildProposalId(parentProposalId, row.origIndex)
      const displayTitle =
        parentCalendarCore.trim().length > 0
          ? embeddedScheduleChildTitleForReview(cardTitleRaw, seg, siblingTitlesBlob)
          : normalizeEmbeddedScheduleParentDisplayTitle(seg.title).title
      const reviewListClock = embeddedScheduleChildReviewListTimeClock(seg)
      const derivedOppmote = tryDeriveOppmoteStartFromSegmentNotes(seg, { childProposalId })
      const timeLabel = derivedOppmote?.displayClock
        ? derivedOppmote.displayClock
        : reviewListClock.clock
          ? reviewListClock.clock
          : seg.isConditional
            ? '–'
            : 'Tid ikke avklart'
      const detailTitle = debugEmbeddedDetailTitleForPanel(seg, parentCalendarCore, cardTitleRaw, displayTitle)
      const structured = readTankestromScheduleDetailsFromMetadata(
        shapeEmbeddedSegmentForScheduleDetails(seg),
        [detailTitle, cardTitleRaw, displayTitle],
        { fallbackStartTime: seg.start }
      )
      const status = seg.isConditional ? 'conditional' : 'normal'
      rows.push({
        parentProposalId,
        childProposalId,
        title: displayTitle,
        date: seg.date,
        displayedTime: timeLabel,
        status,
        highlightsForScheduleDetails: structured.highlights.map((h) => ({
          time: h.time,
          label: h.label,
          type: h.type,
        })),
        notesForScheduleDetails: [...structured.notes],
        bringItems: [...structured.bringItems],
        timeWindowSummaries: structured.timeWindowSummaries.map((t) => ({
          timeRange: t.timeRange,
          label: t.label,
          tentative: t.tentative,
        })),
      })
    }
  }
  return rows
}

/** Forenklet kopi av `embeddedScheduleChildDetailTitleForPanel` (uten logging). */
function debugEmbeddedDetailTitleForPanel(
  seg: EmbeddedScheduleSegment,
  parentCalendarCore: string | undefined,
  parentEventTitleFull: string | undefined,
  displayTitle: string
): string {
  const pt = parentCalendarCore?.trim()
  const dt = displayTitle.trim()
  if (!pt) return dt
  const sameBlob =
    normalizeNotesDedupeKey(dt) === normalizeNotesDedupeKey(pt) ||
    (semanticTitleCore(dt) === semanticTitleCore(pt) && semanticTitleCore(dt).length >= 8)
  const childIsOnlyParentPrefix =
    dt.length <= pt.length + 6 &&
    normalizeNotesDedupeKey(pt).startsWith(normalizeNotesDedupeKey(dt)) &&
    dt.length >= 12
  if (!sameBlob && !childIsOnlyParentPrefix) return dt
  const datePart = debugEmbeddedChildDateShort(seg.date)
  const parentForChildTitle = (parentEventTitleFull ?? pt).trim()
  const fromSeg = embeddedScheduleChildTitleForReview(parentForChildTitle, seg)
  if (
    fromSeg.trim().length >= 2 &&
    normalizeNotesDedupeKey(fromSeg) !== normalizeNotesDedupeKey(pt) &&
    semanticTitleCore(fromSeg) !== semanticTitleCore(pt)
  ) {
    return `${datePart} · ${fromSeg}`
  }
  const { clock } = embeddedScheduleChildReviewListTimeClock(seg)
  if (clock) return `${datePart} · ${clock}`
  return `${datePart} · Programpunkt`
}

function debugEmbeddedChildDateShort(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T12:00:00`)
    const day = d.toLocaleDateString('nb-NO', { weekday: 'short' }).replace(/\.$/, '').trim()
    const dayShort = day.length > 3 ? day.slice(0, 3) : day
    const dm = d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }).replace(/\.$/, '')
    return `${dayShort} ${dm}`.replace(/\s+/g, ' ').trim()
  } catch {
    return isoDate.slice(5)
  }
}

function pipelineSegRawHighlightCount(seg: PipelineSegmentSummary): number {
  if (Array.isArray(seg.dayContentHighlights)) return seg.dayContentHighlights.length
  return 0
}

function segmentMatchKey(s: { parentProposalId: string; date: string; title: string }): string {
  return `${s.parentProposalId}|${s.date}|${s.title}`
}

export function computeTankestromImportWarnings(snapshot: TankestromImportFullDebugSnapshot): string[] {
  const w: string[] = []
  const a = snapshot.analyze
  if (!a) return w

  const foldByKey = new Map<string, PipelineSegmentSummary>()
  for (const s of a.afterLegacyFold.segments) {
    foldByKey.set(segmentMatchKey(s), s)
  }
  for (const rawSeg of a.rawEmbeddedSegments) {
    const foldSeg = foldByKey.get(segmentMatchKey(rawSeg))
    if (foldSeg && rawSeg.highlights.length > foldSeg.highlights.length) {
      w.push(
        `[highlights] Færre highlights etter fold enn i rå embedded (${rawSeg.parentTitle} · ${rawSeg.date} · ${truncateDebugString(rawSeg.title, 60)})`
      )
    }
  }

  for (const foldSeg of a.afterLegacyFold.segments) {
    if (pipelineSegRawHighlightCount(foldSeg) > 0 && foldSeg.highlights.length === 0) {
      w.push(
        `[highlights] Rå dayContent/embedded har highlight-linjer men fold ga 0 highlights (${foldSeg.parentTitle} · ${foldSeg.date})`
      )
    }
    const dcHl = foldSeg.dayContentHighlights
    if (Array.isArray(dcHl) && dcHl.length > 0) {
      const defMatch = a.afterDefensive.segments.find(
        (s) =>
          s.parentProposalId === foldSeg.parentProposalId &&
          s.date === foldSeg.date &&
          s.title === foldSeg.title
      )
      if (defMatch && defMatch.normalizedHighlights.length === 0) {
        w.push(
          `[normalize] dayContent.highlights finnes men tankestromHighlights/normalisert tom etter normalize (${foldSeg.parentTitle} · ${foldSeg.date})`
        )
      }
    }
  }

  const datesByParent = new Map<string, Set<string>>()
  for (const s of a.afterDefensive.segments) {
    let set = datesByParent.get(s.parentProposalId)
    if (!set) {
      set = new Set()
      datesByParent.set(s.parentProposalId, set)
    }
    if (set.has(s.date)) {
      w.push(`[dedupe] Duplikat embeddedSchedule-dato ${s.date} under forelder ${s.parentProposalId}`)
    }
    set.add(s.date)
  }

  for (const it of a.raw.items) {
    if (it.kind !== 'event' || !it.title) continue
    for (const seg of a.afterDefensive.segments) {
      for (const h of seg.normalizedHighlights) {
        if (normalizeNotesDedupeKey(h.label) === normalizeNotesDedupeKey(it.title)) {
          w.push(`[highlight] Hendelsestittel «${truncateDebugString(it.title, 80)}» dukker opp som highlight-label`)
          break
        }
      }
    }
  }

  const yearTok = /\b20\d{2}\b/
  const dateTok = /\d{1,2}\.\d{1,2}|\d{4}-\d{2}-\d{2}/
  for (const s of a.afterDefensive.segments) {
    if (yearTok.test(s.title) || dateTok.test(s.title)) {
      w.push(`[title] Barn-tittel inneholder år/dato-token: ${truncateDebugString(s.title, 120)}`)
    }
  }

  for (const foldSeg of a.afterLegacyFold.segments) {
    const rawEv = a.raw.items.find((i) => i.proposalId === foldSeg.parentProposalId)
    if (!rawEv || rawEv.kind !== 'event') continue
    const defSeg = a.afterDefensive.segments.find(
      (s) =>
        s.parentProposalId === foldSeg.parentProposalId &&
        s.date === foldSeg.date &&
        s.title === foldSeg.title
    )
    if (foldSeg.start && (!defSeg || !defSeg.start)) {
      w.push(`[time] start forsvant etter fold/normalize (${foldSeg.parentTitle} · ${foldSeg.date})`)
    }
  }

  for (const foldSeg of a.afterLegacyFold.segments) {
    const defSeg = a.afterDefensive.segments.find(
      (s) =>
        s.parentProposalId === foldSeg.parentProposalId &&
        s.date === foldSeg.date &&
        s.title === foldSeg.title
    )
    if (defSeg && foldSeg.isConditional !== defSeg.isConditional) {
      w.push(
        `[conditional] isConditional endret fra ${foldSeg.isConditional} til ${defSeg.isConditional} (${foldSeg.date})`
      )
    }
  }

  const arrangementParentExport = a.raw.items.some(
    (it) => it.kind === 'event' && it.isArrangementParent && it.exportAsCalendarEvent
  )
  const arrangementChildExport = a.raw.items.some(
    (it) => it.kind === 'event' && it.isArrangementChild && it.exportAsCalendarEvent
  )
  if (arrangementParentExport && arrangementChildExport) {
    w.push('[export] Både programforelder og programbarn ser ut til å ha exportAsCalendarEvent — sjekk metadata.')
  }

  return w
}

export function buildFullImportDebugSnapshot(input: {
  analyze: TankestromImportPipelineAnalyzeSnapshot | null
  renderInput: RenderInputDebugRow[]
  persistPlan: PersistPlanDebugRow[]
  lastImportAttemptStatus?: string
  analyzeWarning: string | null
}): TankestromImportFullDebugSnapshot {
  const base: TankestromImportFullDebugSnapshot = {
    generatedAt: new Date().toISOString(),
    analyze: input.analyze,
    renderInput: input.renderInput,
    persistPlan: input.persistPlan,
    lastImportAttemptStatus: input.lastImportAttemptStatus,
    analyzeWarning: input.analyzeWarning,
    warnings: [],
  }
  base.warnings = computeTankestromImportWarnings(base)
  return base
}

export function enrichPersistPlanForDebug(
  plan: Array<{
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
  }>,
  bundle: PortalImportProposalBundle | null
): PersistPlanDebugRow[] {
  return plan.map((p) => {
    let timePrecision: string | undefined
    if (bundle && p.planSurface === 'event') {
      const it = bundle.items.find((i) => i.proposalId === p.proposalId)
      if (it?.kind === 'event') {
        const m = asRecord(it.event.metadata)
        const tp = m?.timePrecision
        timePrecision = typeof tp === 'string' ? tp : undefined
      }
    }
    return { ...p, timePrecision, validationErrors: [...p.validationErrors] }
  })
}
