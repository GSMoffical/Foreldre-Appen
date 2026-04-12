/**
 * Lightweight in-memory event logger for usage tracking and debugging.
 *
 * - Stores the last BUFFER_MAX events in a module-level ring buffer.
 * - Prints each event to the console with a consistent [APP] prefix.
 * - Notifies all subscribers synchronously so the DebugOverlay stays live.
 * - No external services, no persistence. Entirely removable.
 *
 * Usage:
 *   import { logEvent } from '../lib/appLogger'
 *   logEvent('task_created', { title: 'Buy milk', date: '2024-04-09' })
 */

export interface AppLogEntry {
  name: string
  payload: Record<string, unknown>
  ts: string
}

const BUFFER_MAX = 100
const buffer: AppLogEntry[] = []
const listeners = new Set<() => void>()

/** Log a named event with optional structured payload. */
export function logEvent(name: string, payload?: Record<string, unknown>): void {
  const entry: AppLogEntry = {
    name,
    payload: payload ?? {},
    ts: new Date().toISOString(),
  }
  buffer.push(entry)
  if (buffer.length > BUFFER_MAX) buffer.shift()
  // eslint-disable-next-line no-console
  console.log('[APP]', name, Object.keys(entry.payload).length ? entry.payload : '')
  listeners.forEach((cb) => cb())
}

/** Return the last N entries (default 20), newest last. */
export function getRecentEvents(n = 20): AppLogEntry[] {
  return buffer.slice(-n)
}

/** Wipe the in-memory buffer (e.g. from the debug overlay). */
export function clearEventLog(): void {
  buffer.splice(0, buffer.length)
  listeners.forEach((cb) => cb())
}

/**
 * Subscribe to buffer mutations.
 * Returns an unsubscribe function — call it in a useEffect cleanup.
 */
export function subscribeToLog(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
