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
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    if (!DATE_KEY.test(date) || !title) continue
    const seg: EmbeddedScheduleSegment = { date, title }
    if (typeof o.start === 'string') {
      const s = trimHHmm(o.start)
      if (s) seg.start = s
    }
    if (typeof o.end === 'string') {
      const e = trimHHmm(o.end)
      if (e) seg.end = e
    }
    if (typeof o.notes === 'string' && o.notes.trim()) seg.notes = o.notes.trim()
    if (typeof o.kind === 'string' && o.kind.trim()) seg.kind = o.kind.trim()
    if (o.isConditional === true) seg.isConditional = true
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
