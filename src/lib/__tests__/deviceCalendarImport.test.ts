import { describe, expect, it } from 'vitest'
import type { Event } from '../../types'
import type { DeviceCalendarEvent } from '../deviceCalendar'
import {
  mapDeviceEventToSynka,
  collectImportedDeviceEventKeys,
  deviceEventDedupeKey,
  DEVICE_CALENDAR_SOURCE_ID,
} from '../deviceCalendarImport'

const OPTIONS = {
  defaultPersonId: 'p1' as Event['personId'],
  calendarTitleById: new Map([['cal1', 'Jobb']]),
  importedAtISO: '2025-06-01T00:00:00.000Z',
}

function devEvent(partial: Partial<DeviceCalendarEvent>): DeviceCalendarEvent {
  return {
    id: 'evt',
    title: 'Avtale',
    calendarId: 'cal1',
    startDate: Date.UTC(2025, 5, 10, 6, 30, 0),
    endDate: Date.UTC(2025, 5, 10, 8, 0, 0),
    isAllDay: false,
    location: null,
    notes: null,
    timezone: null,
    ...partial,
  }
}

describe('mapDeviceEventToSynka — timed events', () => {
  it('converts the instant to Oslo wall-clock HH:mm and anchors on the Oslo date', () => {
    // 06:30Z / 08:00Z in June → 08:30 / 10:00 Oslo (UTC+2)
    const m = mapDeviceEventToSynka(devEvent({}), OPTIONS)
    expect(m.dateKey).toBe('2025-06-10')
    expect(m.input.start).toBe('08:30')
    expect(m.input.end).toBe('10:00')
    expect(m.input.personId).toBe('p1')
    expect(m.input.metadata?.sourceId).toBe(DEVICE_CALENDAR_SOURCE_ID)
    expect(m.input.metadata?.isAllDay).toBeUndefined()
  })

  it('clamps a multi-day timed event to the start day and records the real end as a trace', () => {
    const m = mapDeviceEventToSynka(
      devEvent({
        startDate: Date.UTC(2025, 5, 10, 20, 0, 0), // 22:00 Oslo Jun10
        endDate: Date.UTC(2025, 5, 11, 5, 0, 0), // 07:00 Oslo Jun11
      }),
      OPTIONS
    )
    expect(m.dateKey).toBe('2025-06-10')
    expect(m.input.start).toBe('22:00')
    expect(m.input.end).toBe('23:59')
    expect(m.input.metadata?.deviceCalendar?.truncatedEndDate).toBe('2025-06-11')
    expect(m.input.metadata?.deviceCalendar?.truncatedEndTime).toBe('07:00')
  })
})

describe('mapDeviceEventToSynka — all-day events (cross-platform boundaries)', () => {
  it('Android/ICS UTC-midnight single-day all-day → single day, no multiDay', () => {
    const m = mapDeviceEventToSynka(
      devEvent({
        isAllDay: true,
        startDate: Date.UTC(2025, 5, 10, 0, 0, 0),
        endDate: Date.UTC(2025, 5, 11, 0, 0, 0), // exclusive next-midnight (UTC)
      }),
      OPTIONS
    )
    expect(m.dateKey).toBe('2025-06-10')
    expect(m.input.start).toBe('00:00')
    expect(m.input.end).toBe('23:59')
    expect(m.input.metadata?.isAllDay).toBe(true)
    expect(m.input.metadata?.multiDayAllDay).toBeUndefined()
    expect(m.input.metadata?.endDate).toBeUndefined()
  })

  it('Android/ICS UTC-midnight 3-day all-day → inclusive endDate is the last visible day', () => {
    const m = mapDeviceEventToSynka(
      devEvent({
        isAllDay: true,
        startDate: Date.UTC(2025, 5, 10, 0, 0, 0),
        endDate: Date.UTC(2025, 5, 13, 0, 0, 0), // exclusive: covers Jun10,11,12
      }),
      OPTIONS
    )
    expect(m.dateKey).toBe('2025-06-10')
    expect(m.input.metadata?.multiDayAllDay).toBe(true)
    expect(m.input.metadata?.endDate).toBe('2025-06-12')
  })

  it('iOS local-midnight single-day all-day → single day', () => {
    const m = mapDeviceEventToSynka(
      devEvent({
        isAllDay: true,
        startDate: Date.UTC(2025, 5, 9, 22, 0, 0), // Oslo midnight Jun10
        endDate: Date.UTC(2025, 5, 10, 22, 0, 0), // Oslo midnight Jun11
      }),
      OPTIONS
    )
    expect(m.dateKey).toBe('2025-06-10')
    expect(m.input.metadata?.multiDayAllDay).toBeUndefined()
  })

  it('inclusive 23:59:59 end (ICS-style) single-day all-day → single day', () => {
    const m = mapDeviceEventToSynka(
      devEvent({
        isAllDay: true,
        startDate: Date.UTC(2025, 5, 10, 0, 0, 0),
        endDate: Date.UTC(2025, 5, 10, 23, 59, 59), // inclusive last moment
      }),
      OPTIONS
    )
    expect(m.dateKey).toBe('2025-06-10')
    expect(m.input.metadata?.multiDayAllDay).toBeUndefined()
  })

  it('winter UTC-midnight single-day all-day → single day (DST-independent)', () => {
    const m = mapDeviceEventToSynka(
      devEvent({
        isAllDay: true,
        startDate: Date.UTC(2025, 0, 10, 0, 0, 0),
        endDate: Date.UTC(2025, 0, 11, 0, 0, 0),
      }),
      OPTIONS
    )
    expect(m.dateKey).toBe('2025-01-10')
    expect(m.input.metadata?.multiDayAllDay).toBeUndefined()
  })
})

describe('dedupe keys (recurring-safe re-import)', () => {
  it('combines device id with occurrence start so series occurrences are distinct', () => {
    expect(deviceEventDedupeKey('series', 1000)).toBe('series@1000')
    expect(deviceEventDedupeKey('series', 2000)).toBe('series@2000')
    expect(deviceEventDedupeKey('series', undefined)).toBe('series')
  })

  it('two occurrences sharing one device id get distinct dedupe keys', () => {
    const a = mapDeviceEventToSynka(devEvent({ id: 'series', startDate: Date.UTC(2025, 5, 10, 6, 0) }), OPTIONS)
    const b = mapDeviceEventToSynka(devEvent({ id: 'series', startDate: Date.UTC(2025, 5, 17, 6, 0) }), OPTIONS)
    expect(a.dedupeKey).not.toBe(b.dedupeKey)
  })

  it('round-trips: a mapped event’s dedupeKey is recovered from its stored metadata', () => {
    const m = mapDeviceEventToSynka(devEvent({ id: 'series', startDate: Date.UTC(2025, 5, 10, 6, 0) }), OPTIONS)
    const stored: Event = { id: 'x', ...m.input } as Event
    const keys = collectImportedDeviceEventKeys({ [m.dateKey]: [stored] })
    expect(keys.has(m.dedupeKey)).toBe(true)
  })

  it('collectImportedDeviceEventKeys ignores events without the device-calendar marker', () => {
    const plain: Event = { id: 'x', personId: 'p1', title: 't', start: '09:00', end: '10:00' }
    expect(collectImportedDeviceEventKeys({ '2025-06-10': [plain] }).size).toBe(0)
  })
})
