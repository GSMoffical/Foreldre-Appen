import { isNative, isIOS } from './capacitor'

/**
 * Native device-calendar access for the «Koble til kalender» feature.
 *
 * This is the ONLY module that talks to `@ebarooni/capacitor-calendar` directly —
 * the rest of the app imports the clean shapes/functions below so the plugin stays
 * encapsulated (same pattern as {@link ./nativeCamera} and {@link ./push}).
 *
 * The feature is strictly READ-ONLY: we never call any create/modify/delete method
 * on the plugin. On web every function is a safe no-op (returns `[]` / `'denied'`),
 * and callers should gate on {@link isCalendarSupported} first.
 *
 * Installed plugin: `@ebarooni/capacitor-calendar@7.2.0` (latest version compatible
 * with this project's Capacitor 7; the 8.x line requires Capacitor 8).
 */

/** A device calendar the user can choose to import from (decoupled from the plugin's `Calendar`). */
export interface DeviceCalendar {
  id: string
  title: string
  /** Hex color of the calendar, when the platform exposes one. */
  color: string | null
}

/** A raw device-calendar event in a date range (decoupled from the plugin's `CalendarEvent`). */
export interface DeviceCalendarEvent {
  /** Stable id of the event on the device — used as the dedupe key on re-import. */
  id: string
  title: string
  /** Id of the calendar this event belongs to (used for client-side filtering). */
  calendarId: string | null
  /** Start instant, epoch milliseconds. */
  startDate: number
  /** End instant, epoch milliseconds. */
  endDate: number
  isAllDay: boolean
  location: string | null
  /** The event's description/notes (plugin field `description`). */
  notes: string | null
  /** IANA timezone reported by the source event, when available. */
  timezone: string | null
}

/** Normalised permission result, collapsing the plugin's `PermissionState` variants. */
export type CalendarPermissionResult = 'granted' | 'denied' | 'prompt'

/** `true` only on a native (iOS/Android) build — the device calendar does not exist on web. */
export function isCalendarSupported(): boolean {
  return isNative()
}

function normalizePermission(state: string | undefined): CalendarPermissionResult {
  if (state === 'granted') return 'granted'
  if (state === 'denied') return 'denied'
  // 'prompt' | 'prompt-with-rationale' | undefined
  return 'prompt'
}

/**
 * Current read-permission state for the calendar, without prompting the user.
 * Returns `'denied'` on web or on any failure.
 */
export async function checkCalendarPermission(): Promise<CalendarPermissionResult> {
  if (!isNative()) return 'denied'
  try {
    const { CapacitorCalendar, CalendarPermissionScope } = await import('@ebarooni/capacitor-calendar')
    const { result } = await CapacitorCalendar.checkPermission({ scope: CalendarPermissionScope.READ_CALENDAR })
    return normalizePermission(result)
  } catch (err) {
    console.info('[deviceCalendar] checkCalendarPermission failed:', err)
    return 'denied'
  }
}

/**
 * Request read access to the device calendar.
 *
 * Platform note: Apple's EventKit has no read-only calendar scope — reading events on
 * iOS requires *full* calendar access (`requestFullCalendarAccess`, gated behind
 * `NSCalendarsFullAccessUsageDescription`). We still never call any write API.
 * Android has a true read-only scope (`READ_CALENDAR`), used via `requestReadOnlyCalendarAccess`.
 *
 * Returns `'denied'` on web or on any failure.
 */
export async function requestCalendarPermission(): Promise<CalendarPermissionResult> {
  if (!isNative()) return 'denied'
  try {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar')
    const { result } = isIOS()
      ? await CapacitorCalendar.requestFullCalendarAccess()
      : await CapacitorCalendar.requestReadOnlyCalendarAccess()
    return normalizePermission(result)
  } catch (err) {
    console.info('[deviceCalendar] requestCalendarPermission failed:', err)
    return 'denied'
  }
}

/**
 * List the calendars available on the device so the user can choose which to import.
 * Returns `[]` on web or on any failure.
 */
export async function listDeviceCalendars(): Promise<DeviceCalendar[]> {
  if (!isNative()) return []
  try {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar')
    const { result } = await CapacitorCalendar.listCalendars()
    return result.map((c) => ({
      id: c.id,
      title: c.title,
      color: c.color ?? null,
    }))
  } catch (err) {
    console.error('[deviceCalendar] listDeviceCalendars failed:', err)
    return []
  }
}

/**
 * Read raw device-calendar events between two ISO datetimes, optionally restricted to a
 * set of calendar ids. The plugin returns every event in the range (it does not filter by
 * calendar), so we filter on `calendarId` here. Returns `[]` on web or on any failure.
 */
export async function readDeviceEvents(
  startISO: string,
  endISO: string,
  calendarIds?: string[]
): Promise<DeviceCalendarEvent[]> {
  if (!isNative()) return []
  try {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar')
    const from = new Date(startISO).getTime()
    const to = new Date(endISO).getTime()
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      console.error('[deviceCalendar] readDeviceEvents got invalid range:', startISO, endISO)
      return []
    }
    const { result } = await CapacitorCalendar.listEventsInRange({ from, to })
    const allow = calendarIds && calendarIds.length ? new Set(calendarIds) : null
    return result
      .filter((e) => (allow ? e.calendarId != null && allow.has(e.calendarId) : true))
      .map((e) => {
        // The plugin's iOS native layer emits the JS key `allDay`, while Android (and the
        // TS type) use `isAllDay`. Read both so iOS all-day events are detected correctly.
        const flags = e as { isAllDay?: boolean; allDay?: boolean }
        return {
          id: e.id,
          title: e.title,
          calendarId: e.calendarId ?? null,
          startDate: e.startDate,
          endDate: e.endDate,
          isAllDay: Boolean(flags.isAllDay ?? flags.allDay),
          location: e.location ?? null,
          notes: e.description ?? null,
          timezone: e.timezone ?? null,
        }
      })
  } catch (err) {
    console.error('[deviceCalendar] readDeviceEvents failed:', err)
    return []
  }
}
