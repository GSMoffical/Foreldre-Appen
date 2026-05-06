import type { EventMetadata } from '../types'

export const TANKESTROM_COMPUTED_END_HINT_NB = 'Sluttid beregnet fra varighet'
export const TANKESTROM_COMPUTED_START_HINT_NB = 'Starttid beregnet fra sluttid og varighet'

const COMPUTED_FROM_DURATION = 'computed_from_duration'

export function tankestromTimeSourceIsComputedFromDuration(source: unknown): boolean {
  return typeof source === 'string' && source.trim().toLowerCase() === COMPUTED_FROM_DURATION
}

/** Linje til detaljer (evt. dev): f.eks. «08:30 + 90 min = 10:00». */
export function formatTankestromTimeComputationDevLine(metadata: EventMetadata | undefined | null): string | null {
  const raw = metadata?.timeComputation
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.expression === 'string' && o.expression.trim()) return o.expression.trim()
  if (typeof o.summary === 'string' && o.summary.trim()) return o.summary.trim()
  const start =
    (typeof o.start === 'string' && o.start.trim()) ||
    (typeof o.startTime === 'string' && o.startTime.trim()) ||
    ''
  const end =
    (typeof o.end === 'string' && o.end.trim()) ||
    (typeof o.endTime === 'string' && o.endTime.trim()) ||
    ''
  const dur = o.durationMinutes
  const durN = typeof dur === 'number' && Number.isFinite(dur) ? dur : null
  if (start && durN != null && end) return `${start} + ${durN} min = ${end}`
  return null
}
