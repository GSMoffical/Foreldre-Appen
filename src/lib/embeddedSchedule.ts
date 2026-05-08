import type { EmbeddedScheduleSegment, EventMetadata } from '../types'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

type NormalizedEmbeddedSegmentDetails = {
  tankestromHighlights: NonNullable<EmbeddedScheduleSegment['tankestromHighlights']>
  tankestromNotes: NonNullable<EmbeddedScheduleSegment['tankestromNotes']>
  bringItems: NonNullable<EmbeddedScheduleSegment['bringItems']>
  packingItems: NonNullable<EmbeddedScheduleSegment['packingItems']>
  timeWindowCandidates: NonNullable<EmbeddedScheduleSegment['timeWindowCandidates']>
}

function trimHHmm(v: string): string | undefined {
  const t = v.trim()
  return HHMM.test(t) ? t : undefined
}

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null
}

function normalizeTextKey(value: string): string {
  return value
    .toLocaleLowerCase('nb-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cleanHighlightLabel(label: string): string {
  return label
    .trim()
    .replace(/^[,;:.!?()\-\s]+/g, '')
    .replace(/\s+kl\.?\s*$/i, '')
    .replace(/[;:.,\s]+$/g, '')
    .trim()
}

function parseHighlightStringRow(raw: string): { time: string; label: string } | null {
  const text = raw.trim()
  if (!text) return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?:\s*[–-]\s*([01]\d|2[0-3]):([0-5]\d))?\s*(.+)$/u.exec(text)
  if (!m) return null
  const time = `${m[1]}:${m[2]}`
  const label = cleanHighlightLabel(m[5] ?? '')
  if (!label) return null
  return { time, label }
}

function readHighlightRows(input: unknown): Array<{ time: string; label: string; type?: NonNullable<EmbeddedScheduleSegment['tankestromHighlights']>[number]['type'] }> {
  if (!Array.isArray(input)) return []
  const out: Array<{ time: string; label: string; type?: NonNullable<EmbeddedScheduleSegment['tankestromHighlights']>[number]['type'] }> = []
  for (const row of input) {
    if (typeof row === 'string') {
      const parsed = parseHighlightStringRow(row)
      if (parsed) out.push(parsed)
      continue
    }
    const rec = asRecord(row)
    if (!rec) continue
    const timeRaw = typeof rec.time === 'string' ? rec.time.trim() : ''
    const labelRaw = typeof rec.label === 'string' ? cleanHighlightLabel(rec.label) : ''
    const time = trimHHmm(timeRaw.slice(0, 5))
    if (!time || !labelRaw) continue
    const typeRaw = typeof rec.type === 'string' ? rec.type : ''
    const type =
      typeRaw === 'match' || typeRaw === 'meeting' || typeRaw === 'deadline' || typeRaw === 'note' || typeRaw === 'other'
        ? (typeRaw as NonNullable<EmbeddedScheduleSegment['tankestromHighlights']>[number]['type'])
        : undefined
    out.push({ time, label: labelRaw, type })
  }
  return out
}

function readStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
}

function readTimeWindowCandidates(input: unknown): Array<{ start?: string; end?: string; label?: string; tentative?: boolean }> {
  if (!Array.isArray(input)) return []
  return input
    .map((x) => asRecord(x))
    .filter((x): x is Record<string, unknown> => !!x)
    .map((x) => ({
      start: typeof x.start === 'string' ? x.start : undefined,
      end: typeof x.end === 'string' ? x.end : undefined,
      label: typeof x.label === 'string' ? x.label : undefined,
      tentative: x.tentative === true,
    }))
}

/**
 * Samler Tankestrøm-felter for ett embedded-segment (ny + legacy struktur)
 * til appens standardfelt.
 */
export function normalizeEmbeddedSegmentScheduleDetails(input: unknown): NormalizedEmbeddedSegmentDetails {
  const src = asRecord(input)
  const dayContent = asRecord(src?.dayContent)
  const rawHighlights = [
    ...readHighlightRows(dayContent?.highlights),
    ...readHighlightRows(src?.tankestromHighlights),
    ...readHighlightRows(src?.scheduleHighlights),
    ...readHighlightRows(src?.highlights),
  ]
  const highlightByKey = new Map<string, { time: string; label: string; type?: NonNullable<EmbeddedScheduleSegment['tankestromHighlights']>[number]['type'] }>()
  for (const h of rawHighlights) {
    const key = `${h.time}__${normalizeTextKey(h.label)}`
    const prev = highlightByKey.get(key)
    if (!prev || h.label.length < prev.label.length) {
      highlightByKey.set(key, h)
    }
  }
  const tankestromHighlights: NonNullable<EmbeddedScheduleSegment['tankestromHighlights']> = [...highlightByKey.values()]

  const rawNotes = [
    ...readStringList(dayContent?.generalNotes),
    ...readStringList(dayContent?.logisticsNotes),
    ...readStringList(dayContent?.uncertaintyNotes),
    ...readStringList(src?.tankestromNotes),
    ...readStringList(src?.notes),
    ...readStringList(src?.logisticsNotes),
    ...readStringList(src?.parentTasks),
    ...readStringList(src?.uncertaintyNotes),
  ]
  const noteSet = new Set<string>()
  const tankestromNotes: NonNullable<EmbeddedScheduleSegment['tankestromNotes']> = []
  for (const n of rawNotes) {
    const k = normalizeTextKey(n)
    if (!k || noteSet.has(k)) continue
    noteSet.add(k)
    tankestromNotes.push(n)
  }

  const rawBring = [
    ...readStringList(dayContent?.bringItems),
    ...readStringList(src?.bringItems),
    ...readStringList(src?.packingItems),
  ]
  const bringSet = new Set<string>()
  const bringItems: NonNullable<EmbeddedScheduleSegment['bringItems']> = []
  for (const b of rawBring) {
    const k = normalizeTextKey(b)
    if (!k || bringSet.has(k)) continue
    bringSet.add(k)
    bringItems.push(b)
  }

  const rawWindows = [
    ...readTimeWindowCandidates(dayContent?.timeWindowCandidates),
    ...readTimeWindowCandidates(src?.timeWindowCandidates),
  ]
  const windowSet = new Set<string>()
  const timeWindowCandidates: NonNullable<EmbeddedScheduleSegment['timeWindowCandidates']> = []
  for (const w of rawWindows) {
    const key = `${w.start ?? ''}|${w.end ?? ''}|${normalizeTextKey(w.label ?? '')}|${w.tentative ? '1' : '0'}`
    if (windowSet.has(key)) continue
    windowSet.add(key)
    timeWindowCandidates.push(w)
  }

  return {
    tankestromHighlights,
    tankestromNotes,
    bringItems,
    packingItems: bringItems,
    timeWindowCandidates,
  }
}

/**
 * Tolker `metadata.embeddedSchedule` til gyldige segmenter (streng validering, ignorerer ugyldige elementer).
 * Nyttig når metadata kommer fra API/import med løs typing.
 */
export function parseEmbeddedScheduleFromMetadata(
  metadata: EventMetadata | undefined | null
): EmbeddedScheduleSegment[] {
  const raw = metadata?.embeddedSchedule
  if (!Array.isArray(raw)) return []
  const out: EmbeddedScheduleSegment[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as unknown as Record<string, unknown>
    const date = typeof o.date === 'string' ? o.date.trim() : ''
    const titleRaw = typeof o.title === 'string' ? o.title.trim() : ''
    const title = titleRaw || 'Program'
    if (!DATE_KEY.test(date)) continue
    const seg: EmbeddedScheduleSegment = { date, title }
    const startFromField = typeof o.start === 'string' ? trimHHmm(o.start) : undefined
    const startFromAlt = typeof o.startTime === 'string' ? trimHHmm(o.startTime) : undefined
    const startPick = startFromField ?? startFromAlt
    if (startPick) seg.start = startPick
    if (typeof o.end === 'string') {
      const e = trimHHmm(o.end)
      if (e) seg.end = e
    } else if (typeof o.endTime === 'string') {
      const e = trimHHmm(o.endTime)
      if (e) seg.end = e
    }
    if (typeof o.notes === 'string' && o.notes.trim()) seg.notes = o.notes.trim()
    const details = normalizeEmbeddedSegmentScheduleDetails(o)
    if (details.tankestromHighlights.length > 0) seg.tankestromHighlights = details.tankestromHighlights
    if (details.tankestromNotes.length > 0) seg.tankestromNotes = details.tankestromNotes
    if (details.bringItems.length > 0) seg.bringItems = details.bringItems
    if (details.packingItems.length > 0) seg.packingItems = details.packingItems
    if (typeof o.tankestromDescriptionFallback === 'string' && o.tankestromDescriptionFallback.trim()) {
      seg.tankestromDescriptionFallback = o.tankestromDescriptionFallback.trim()
    }
    if (
      typeof o.timeWindow === 'string' ||
      (o.timeWindow && typeof o.timeWindow === 'object' && !Array.isArray(o.timeWindow))
    ) {
      seg.timeWindow = o.timeWindow as EmbeddedScheduleSegment['timeWindow']
    }
    if (Array.isArray(o.tankestromTimeWindowSummaries)) {
      seg.tankestromTimeWindowSummaries = o.tankestromTimeWindowSummaries
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => {
          const timeRange = typeof x.timeRange === 'string' ? x.timeRange.trim() : ''
          const label = typeof x.label === 'string' ? x.label.trim() : ''
          if (!timeRange || !label) return null
          return {
            timeRange,
            label,
            tentative: x.tentative === true,
          }
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
    }
    if (details.timeWindowCandidates.length > 0) seg.timeWindowCandidates = details.timeWindowCandidates
    if (typeof o.kind === 'string' && o.kind.trim()) seg.kind = o.kind.trim()
    if (o.isConditional === true) seg.isConditional = true
    if (o.userEditedTitle === true) seg.userEditedTitle = true
    if (typeof o.titleOverride === 'string' && o.titleOverride.trim()) {
      seg.titleOverride = o.titleOverride.trim()
    }
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
      const lower = seg.title.toLocaleLowerCase('nb-NO')
      if (lower.includes('vårcup') || lower.includes('varcup')) {
        const dayContent =
          o.dayContent && typeof o.dayContent === 'object' && !Array.isArray(o.dayContent)
            ? (o.dayContent as Record<string, unknown>)
            : null
        console.info('[Vårcup parsed embedded schedule]', {
          date: seg.date,
          title: seg.title,
          start: seg.start,
          isConditional: seg.isConditional === true,
          timePrecision: typeof o.timePrecision === 'string' ? o.timePrecision : undefined,
          dayContentHighlights: dayContent?.highlights,
          tankestromHighlights: seg.tankestromHighlights,
          notes: seg.notes,
        })
      }
    }
    out.push(seg)
  }
  return out
}

function compareSegments(a: EmbeddedScheduleSegment, b: EmbeddedScheduleSegment): number {
  const ta = a.start ?? '\uFFFF'
  const tb = b.start ?? '\uFFFF'
  if (ta !== tb) return ta.localeCompare(tb)
  return a.title.localeCompare(b.title, 'nb-NO')
}

export function groupEmbeddedScheduleByDate(
  segments: EmbeddedScheduleSegment[]
): { date: string; items: EmbeddedScheduleSegment[] }[] {
  const byDate = new Map<string, EmbeddedScheduleSegment[]>()
  for (const s of segments) {
    const list = byDate.get(s.date) ?? []
    list.push(s)
    byDate.set(s.date, list)
  }
  return [...byDate.entries()]
    .sort(([da], [db]) => da.localeCompare(db))
    .map(([date, items]) => ({ date, items: [...items].sort(compareSegments) }))
}

/** Flat rekkefølge som i import-review (per dag, sortert klokkeslett). */
export function flattenEmbeddedScheduleOrdered(metadata: EventMetadata | undefined | null): EmbeddedScheduleSegment[] {
  const parsed = parseEmbeddedScheduleFromMetadata(metadata)
  return groupEmbeddedScheduleByDate(parsed).flatMap((g) => g.items)
}

function trimClockToHHmm(start: string, end: string): { s: string; e: string } {
  return {
    s: start.length > 5 ? start.slice(0, 5) : start,
    e: end.length > 5 ? end.slice(0, 5) : end,
  }
}

/** Samme signal som cup-merge: heldag lagret som 00:00–23:59 (eller 24:00). */
export function isEmbeddedScheduleParentAllDayClockRange(start: string, end: string): boolean {
  const { s, e } = trimClockToHHmm(start, end)
  return s === '00:00' && (e === '23:59' || e === '24:00')
}

export type EmbeddedScheduleParentCardHeuristicResult = {
  ok: boolean
  reason: string
  matchedFields: string[]
  expectedButMissing?: string[]
}

/**
 * Tankestrøm-review: når skal et event med `embeddedSchedule` vises som én forelderkort med delprogram?
 * Tidligere krevde vi kun `metadata.isAllDay`; Tankestrøm sender ofte `multiDayAllDay` og/eller 00:00–23:59 uten `isAllDay`.
 */
export function evaluateEmbeddedScheduleParentCardHeuristic(item: {
  kind: string
  event: { start: string; end: string; metadata?: Record<string, unknown> | EventMetadata | null | undefined }
}): EmbeddedScheduleParentCardHeuristicResult {
  if (item.kind !== 'event') {
    return {
      ok: false,
      reason: 'not_event',
      matchedFields: [],
      expectedButMissing: ['kind:event'],
    }
  }
  const m = item.event.metadata
  if (!m || typeof m !== 'object' || Array.isArray(m)) {
    return {
      ok: false,
      reason: 'no_metadata',
      matchedFields: [],
      expectedButMissing: ['metadata'],
    }
  }
  const sched = (m as { embeddedSchedule?: unknown }).embeddedSchedule
  if (!Array.isArray(sched) || sched.length === 0) {
    return {
      ok: false,
      reason: 'no_embedded_schedule',
      matchedFields: [],
      expectedButMissing: ['embeddedSchedule'],
    }
  }

  const matched: string[] = ['embeddedSchedule']
  const explicitArrangementParent = (m as { isArrangementParent?: unknown }).isArrangementParent === true
  const distinctScheduleDates = new Set(
    sched
      .map((x) => {
        if (!x || typeof x !== 'object') return ''
        const d = (x as Record<string, unknown>).date
        return typeof d === 'string' ? d.trim() : ''
      })
      .filter((d) => DATE_KEY.test(d))
  ).size
  const isAllDay = (m as { isAllDay?: boolean }).isAllDay === true
  const multiDayAllDay = (m as { multiDayAllDay?: boolean }).multiDayAllDay === true
  const allDayClock = isEmbeddedScheduleParentAllDayClockRange(item.event.start, item.event.end)

  if (explicitArrangementParent) {
    matched.push('isArrangementParent')
    return { ok: true, reason: 'isArrangementParent', matchedFields: matched }
  }
  if (distinctScheduleDates >= 2) {
    matched.push('embeddedScheduleMultiDay')
    return { ok: true, reason: 'embeddedScheduleMultiDay', matchedFields: matched }
  }

  if (isAllDay) {
    matched.push('isAllDay')
    return { ok: true, reason: 'isAllDay', matchedFields: matched }
  }
  if (multiDayAllDay) {
    matched.push('multiDayAllDay')
    return { ok: true, reason: 'multiDayAllDay', matchedFields: matched }
  }
  if (allDayClock) {
    matched.push('startEndAllDayPattern')
    return { ok: true, reason: 'allDayClockRange', matchedFields: matched }
  }

  return {
    ok: false,
    reason: 'not_all_day_container_signal',
    matchedFields: matched,
    expectedButMissing: [
      'isArrangementParent',
      'embeddedSchedule(>=2 datoer)',
      'isAllDay',
      'multiDayAllDay',
      'startEnd00:00-23:59',
    ],
  }
}

export function isEmbeddedScheduleParentProposalItem(item: {
  kind: string
  event: { start: string; end: string; metadata?: Record<string, unknown> | EventMetadata | null | undefined }
}): boolean {
  return evaluateEmbeddedScheduleParentCardHeuristic(item).ok
}
