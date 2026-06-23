import type { Event, EventMetadata, PersonId } from '../types'
import type { DeviceCalendarEvent } from './deviceCalendar'
import { formatDateKeyInTimeZone } from './osloCalendar'

/**
 * Pure mapping + dedupe logic for the «Koble til kalender» device-calendar import.
 *
 * Kept free of any plugin import so it is trivially testable (see
 * `src/lib/__tests__/deviceCalendarImport.test.ts`): it turns the clean
 * {@link DeviceCalendarEvent} shape into Synka's `createEvent(dateKey, input)` input,
 * handling Oslo-timezone conversion, all-day events and the source/dedupe metadata.
 */

const OSLO_TIME_ZONE = 'Europe/Oslo'

/** Half a day in ms — used to anchor all-day boundary instants to mid-day (see below). */
const HALF_DAY_MS = 12 * 60 * 60 * 1000

/** Value stored in `EventMetadata.sourceId` for events imported from the device calendar. */
export const DEVICE_CALENDAR_SOURCE_ID = 'device-calendar'

/** One device event mapped to Synka's create-event call shape. */
export interface MappedDeviceEvent {
  /** YYYY-MM-DD anchor date (first argument to `controller.createEvent`). */
  dateKey: string
  /** The event payload (second argument to `controller.createEvent`). */
  input: Omit<Event, 'id'>
  /** Occurrence-unique dedupe key — see {@link deviceEventDedupeKey}. */
  dedupeKey: string
}

export interface MapDeviceEventOptions {
  /** Person the imported events are assigned to (the importing parent, or null = unassigned). */
  defaultPersonId: PersonId | null
  /** Calendar id → title, for storing a readable source label in metadata. */
  calendarTitleById: Map<string, string>
  /** ISO timestamp stamped onto each imported event's metadata. */
  importedAtISO: string
}

/**
 * Occurrence-unique dedupe key.
 *
 * A recurring device event returns one {@link DeviceCalendarEvent} per occurrence in the
 * range, but every occurrence of a series shares the same `deviceEventId` (iOS
 * `EKEvent.eventIdentifier` is identical across instances). Keying dedupe on the bare id
 * would import only the first occurrence and skip the rest. We therefore combine the id
 * with the occurrence's start instant.
 */
export function deviceEventDedupeKey(deviceEventId: string, occurrenceStart: number | null | undefined): string {
  return typeof occurrenceStart === 'number' ? `${deviceEventId}@${occurrenceStart}` : deviceEventId
}

/**
 * Wall-clock "HH:mm" (24h) of an instant in the Oslo timezone.
 *
 * Synka stores event times as Oslo local clock strings, so we convert the device
 * event's absolute instant (epoch ms) into the time a Norwegian parent actually sees.
 * Uses `formatToParts` (not a formatted string) so a locale's separator can't leak in.
 */
function osloClockHHmm(epochMs: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: OSLO_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(epochMs))
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

function cleanText(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

/**
 * Convert a single device calendar event into Synka's `createEvent` input.
 *
 * Timezone: the date key and clock times are computed from the event's absolute
 * instant in Europe/Oslo, matching how the rest of Synka anchors events.
 *
 * All-day: stored the Synka way — `start='00:00'`, `end='23:59'`, `metadata.isAllDay`,
 * and `metadata.endDate` (INCLUSIVE) for multi-day spans. Device all-day boundaries are
 * unreliable across platforms — Android/ICS feeds anchor them at UTC midnight while iOS
 * EventKit uses local-midnight (and some feeds use 23:59:59 inclusive ends). Rather than
 * test for an exact midnight, we anchor each boundary to mid-day before taking its Oslo
 * date: the start day is the Oslo date of `start + 12h` and the last visible day is the
 * Oslo date of `end - 12h`. Shifting toward the event's interior collapses exclusive ends
 * (UTC- or Oslo-midnight) and inclusive 23:59:59 ends onto the correct last day.
 *
 * Multi-day *timed* events are clamped to the start day (Synka events are single-day);
 * the true end day/time is preserved in `metadata.deviceCalendar` for reference.
 */
export function mapDeviceEventToSynka(
  event: DeviceCalendarEvent,
  options: MapDeviceEventOptions
): MappedDeviceEvent {
  const title = cleanText(event.title) ?? 'Uten tittel'

  const deviceCalendarMeta: NonNullable<EventMetadata['deviceCalendar']> = {
    deviceEventId: event.id,
    occurrenceStart: event.startDate,
    deviceCalendarId: event.calendarId,
    calendarTitle: event.calendarId ? options.calendarTitleById.get(event.calendarId) ?? null : null,
    importedAt: options.importedAtISO,
  }
  const dedupeKey = deviceEventDedupeKey(event.id, event.startDate)

  if (event.isAllDay) {
    // Mid-day anchoring (see doc comment) makes the day derivation robust to the boundary's
    // wall clock regardless of whether the source anchors all-day events in UTC or local time.
    const startKey = formatDateKeyInTimeZone(new Date(event.startDate + HALF_DAY_MS), OSLO_TIME_ZONE)
    let inclusiveEndKey = formatDateKeyInTimeZone(new Date(event.endDate - HALF_DAY_MS), OSLO_TIME_ZONE)
    if (inclusiveEndKey < startKey) inclusiveEndKey = startKey

    const metadata: EventMetadata = {
      sourceId: DEVICE_CALENDAR_SOURCE_ID,
      deviceCalendar: deviceCalendarMeta,
      isAllDay: true,
    }
    if (inclusiveEndKey > startKey) {
      metadata.multiDayAllDay = true
      metadata.endDate = inclusiveEndKey
    }

    return {
      dateKey: startKey,
      dedupeKey,
      input: {
        personId: options.defaultPersonId,
        title,
        start: '00:00',
        end: '23:59',
        notes: cleanText(event.notes),
        location: cleanText(event.location),
        metadata,
      },
    }
  }

  // Timed event.
  const startKey = formatDateKeyInTimeZone(new Date(event.startDate), OSLO_TIME_ZONE)
  const start = osloClockHHmm(event.startDate)
  let end = osloClockHHmm(event.endDate)
  const endKey = formatDateKeyInTimeZone(new Date(event.endDate), OSLO_TIME_ZONE)

  const meta: EventMetadata = {
    sourceId: DEVICE_CALENDAR_SOURCE_ID,
    deviceCalendar: deviceCalendarMeta,
  }
  if (endKey !== startKey) {
    // Multi-day timed event — clamp to the end of the start day, but keep a trace of the
    // real end so the truncation is not silent (Synka timed events are single-day).
    meta.deviceCalendar = { ...deviceCalendarMeta, truncatedEndDate: endKey, truncatedEndTime: end }
    end = '23:59'
  } else if (end < start) {
    end = start
  }

  return {
    dateKey: startKey,
    dedupeKey,
    input: {
      personId: options.defaultPersonId,
      title,
      start,
      end,
      notes: cleanText(event.notes),
      location: cleanText(event.location),
      metadata: meta,
    },
  }
}

/**
 * Collect the occurrence dedupe keys already imported into Synka, from a date→events map
 * (e.g. the result of `prefetchEventsForDateRange`). Used to skip duplicates so that
 * re-importing never creates a second copy of an event.
 */
export function collectImportedDeviceEventKeys(byDate: Record<string, Event[]> | undefined): Set<string> {
  const keys = new Set<string>()
  if (!byDate) return keys
  for (const list of Object.values(byDate)) {
    for (const event of list) {
      const marker = event.metadata?.deviceCalendar
      if (marker && typeof marker.deviceEventId === 'string') {
        keys.add(deviceEventDedupeKey(marker.deviceEventId, marker.occurrenceStart))
      }
    }
  }
  return keys
}
