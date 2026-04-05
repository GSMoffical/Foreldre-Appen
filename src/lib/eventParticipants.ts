import type { Event, Person } from '../types'
import { getEventParticipantIds } from './schedule'

/** Resolve family rows for everyone on this event (multi-person aware). */
export function getParticipantPeople(event: Event, people: Person[]): Person[] {
  const ids = getEventParticipantIds(event)
  const list: Person[] = []
  for (const id of ids) {
    const p = people.find((x) => x.id === id)
    if (p) list.push(p)
  }
  return list
}

/** Short label for list rows / logistics. */
export function formatParticipantNamesLine(event: Event, people: Person[]): string {
  const list = getParticipantPeople(event, people)
  if (list.length === 0) return 'Ukjent'
  if (list.length === 1) return list[0].name
  if (list.length === 2) return `${list[0].name} og ${list[1].name}`
  return `${list[0].name} +${list.length - 1}`
}

/** Search: title + all participant names. */
export function participantSearchHaystack(event: Event, people: Person[]): string {
  const names = getParticipantPeople(event, people)
    .map((p) => p.name)
    .join(' ')
  return `${event.title} ${names}`.toLowerCase()
}
