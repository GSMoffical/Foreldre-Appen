/**
 * Timeline layout math. Documented scale: 1 hour = PIXELS_PER_HOUR px.
 * All times in "HH:mm" 24h; full day 00:00–24:00 (labels 00–23).
 */

export const TIMELINE_START_HOUR = 0
/** Exclusive end hour for span math: timeline covers [0, 24) i.e. midnight through end of 23:xx */
export const TIMELINE_END_HOUR = 24
/** Last hour row label (23:00) */
export const TIMELINE_LAST_LABELED_HOUR = 23
/** 1 hour = 80px (spacious on iPhone 13). 30 min = 40px, 15 min = 20px. */
export const PIXELS_PER_HOUR = 80

/** Parse "HH:mm" to minutes since midnight (0–1439). */
export function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Minutes from timeline day start (e.g. 00:00 = 0). */
export function minutesSinceStart(
  time: string,
  dayStartHour: number = TIMELINE_START_HOUR
): number {
  const min = parseTime(time)
  const startMin = dayStartHour * 60
  return Math.max(0, min - startMin)
}

/** Y position (px) for a time in the timeline. */
export function timeToY(
  time: string,
  dayStartHour: number = TIMELINE_START_HOUR,
  pixelsPerHour: number = PIXELS_PER_HOUR
): number {
  const minutes = minutesSinceStart(time, dayStartHour)
  return (minutes / 60) * pixelsPerHour
}

/** Height in px for a duration in minutes. */
export function durationToHeight(
  durationMinutes: number,
  pixelsPerHour: number = PIXELS_PER_HOUR
): number {
  return (durationMinutes / 60) * pixelsPerHour
}

/** Format time for display in 24h Norwegian style (e.g. "15:30"). */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  if (h === undefined) return time
  return `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`
}

/** Format range "15:30–17:00". */
export function formatTimeRange(start: string, end: string): string {
  const nextDay = parseTime(end) <= parseTime(start)
  return `${formatTime(start)} – ${formatTime(end)}${nextDay ? ' (+1)' : ''}`
}

/** Total height of the timeline in px. */
export function timelineTotalHeight(
  pixelsPerHour: number = PIXELS_PER_HOUR
): number {
  return (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * pixelsPerHour
}

/** Duration in minutes between start and end. */
export function durationMinutes(start: string, end: string): number {
  const s = parseTime(start)
  const e = parseTime(end)
  if (e > s) return e - s
  return 24 * 60 - s + e
}

/** Shift a "HH:mm" time by deltaMins, clamped to 00:00–23:59. */
export function shiftTime(time: string, deltaMins: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 59, parseTime(time) + deltaMins))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
