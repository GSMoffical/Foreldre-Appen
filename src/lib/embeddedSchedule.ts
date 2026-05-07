import type { EmbeddedScheduleSegment, EventMetadata } from '../types'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function trimHHmm(v: string): string | undefined {
  const t = v.trim()
  return HHMM.test(t) ? t : undefined
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
    if (Array.isArray(o.tankestromHighlights)) {
      seg.tankestromHighlights = o.tankestromHighlights
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => {
          const time = typeof x.time === 'string' ? x.time.trim().slice(0, 5) : ''
          const label = typeof x.label === 'string' ? x.label.trim() : ''
          const typeRaw = typeof x.type === 'string' ? x.type : ''
          if (!time || !label) return null
          if (
            typeRaw === 'match' ||
            typeRaw === 'meeting' ||
            typeRaw === 'deadline' ||
            typeRaw === 'note' ||
            typeRaw === 'other'
          ) {
            return { time, label, type: typeRaw as 'match' | 'meeting' | 'deadline' | 'note' | 'other' }
          }
          return { time, label }
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
    }
    if (Array.isArray(o.tankestromNotes)) {
      seg.tankestromNotes = o.tankestromNotes
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim())
    }
    if (Array.isArray(o.bringItems)) {
      seg.bringItems = o.bringItems
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim())
    }
    if (Array.isArray(o.packingItems)) {
      seg.packingItems = o.packingItems
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim())
    }
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
    if (Array.isArray(o.timeWindowCandidates)) {
      seg.timeWindowCandidates = o.timeWindowCandidates
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({
          start: typeof x.start === 'string' ? x.start : undefined,
          end: typeof x.end === 'string' ? x.end : undefined,
          label: typeof x.label === 'string' ? x.label : undefined,
          tentative: x.tentative === true,
        }))
    }
    if (typeof o.kind === 'string' && o.kind.trim()) seg.kind = o.kind.trim()
    if (o.isConditional === true) seg.isConditional = true
    if (o.userEditedTitle === true) seg.userEditedTitle = true
    if (typeof o.titleOverride === 'string' && o.titleOverride.trim()) {
      seg.titleOverride = o.titleOverride.trim()
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
