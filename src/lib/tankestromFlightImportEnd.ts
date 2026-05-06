/**
 * Tankestrøm flyimport: forsvar mot kunstig sluttid når ankomst/varighet ikke er kjent.
 */

const RELIABLE_END_SOURCES = new Set(['explicit_arrival_time', 'computed_from_duration'])

export function tankestromFlightHasReliableEndSignal(meta: Record<string, unknown>): boolean {
  const ets = typeof meta.endTimeSource === 'string' ? meta.endTimeSource.trim().toLowerCase() : ''
  if (RELIABLE_END_SOURCES.has(ets)) return true
  const travel = meta.travel
  if (travel && typeof travel === 'object' && !Array.isArray(travel)) {
    const t = travel as Record<string, unknown>
    const arrival = typeof t.arrivalTime === 'string' ? t.arrivalTime.trim() : ''
    if (arrival.length > 0) return true
    const dm = t.durationMinutes
    if (typeof dm === 'number' && Number.isFinite(dm) && dm > 0) return true
  }
  return false
}

/** Upålitelig slutt-kilde: fallback, manglende endTimeSource, eller utledet slutt uten pålitelig signal. */
export function tankestromFlightHasUnreliableEndSource(meta: Record<string, unknown>): boolean {
  const ets = typeof meta.endTimeSource === 'string' ? meta.endTimeSource.trim().toLowerCase() : ''
  if (ets === 'fallback_duration') return true
  if (!ets) return true
  if (meta.inferredEndTime === true) return true
  return false
}

export function tankestromShouldStripSyntheticFlightEnd(
  travelType: string | undefined,
  meta: Record<string, unknown>
): boolean {
  if (String(travelType ?? '').trim().toLowerCase() !== 'flight') return false
  if (tankestromFlightHasReliableEndSignal(meta)) return false
  return tankestromFlightHasUnreliableEndSource(meta)
}

export const TANKESTROM_FLIGHT_MISSING_END_LABEL = 'Sluttid ikke oppgitt'

export function tankestromApplyStrippedFlightEndMetadata(meta: Record<string, unknown>): void {
  meta.endTimeSource = 'missing_or_unreadable'
  meta.requiresManualTimeReview = true
  meta.inferredEndTime = false
  meta.displayTimeLabel = TANKESTROM_FLIGHT_MISSING_END_LABEL
}
