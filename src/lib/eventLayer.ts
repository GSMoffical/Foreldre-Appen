import type { Event } from '../types'

export function isForegroundEvent(e: Event): boolean {
  return e.metadata?.calendarLayer !== 'background'
}

export function filterForegroundEvents(events: Event[]): Event[] {
  return events.filter(isForegroundEvent)
}
