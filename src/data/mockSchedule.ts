/**
 * Realistic weekly mock data for the parenting calendar.
 * Template by weekday (0=Sun..6=Sat); we map to actual dates so any week works.
 * Wednesday has the required set (School, Soccer, Homework Help, Dinner at Grandma's).
 * Includes overlaps for layout testing (e.g. Sat).
 */

import type { Event, Person } from '../types'
import { addCalendarDaysOslo, formatDateKeyInTimeZone } from '../lib/osloCalendar'

export const PEOPLE: Person[] = []

/** Template: events by weekday 0–6 (Sun–Sat). Same structure every week. */
const TEMPLATE_BY_WEEKDAY: Record<number, Omit<Event, 'id'>[]> = {
  1: [ // Mon
    { personId: 'emma', title: 'School', start: '08:00', end: '15:00' },
    { personId: 'leo', title: 'School', start: '08:00', end: '15:00' },
    { personId: 'mom', title: 'Work', start: '09:00', end: '17:00' },
    { personId: 'dad', title: 'Work', start: '08:30', end: '17:30' },
    { personId: 'dad', title: 'Commute', start: '17:30', end: '18:15' },
    { personId: 'mom', title: 'Grocery pickup', start: '17:15', end: '17:45' },
    { personId: 'emma', title: 'Homework', start: '16:00', end: '16:45' },
    { personId: 'leo', title: 'Playdate', start: '16:15', end: '17:30' },
    { personId: 'family', title: 'Dinner', start: '18:30', end: '19:30' },
    { personId: 'family', title: 'Bedtime routine', start: '20:15', end: '21:00' },
  ],
  2: [ // Tue
    { personId: 'emma', title: 'School', start: '08:00', end: '15:00' },
    { personId: 'leo', title: 'School', start: '08:00', end: '15:00' },
    { personId: 'dad', title: 'Early meeting', start: '07:30', end: '08:15' },
    { personId: 'dad', title: 'Work', start: '09:00', end: '17:00' },
    { personId: 'emma', title: 'Piano lesson', start: '16:00', end: '16:45' },
    { personId: 'leo', title: 'Library', start: '16:00', end: '16:40' },
    { personId: 'mom', title: 'Work', start: '09:00', end: '17:00' },
    { personId: 'dad', title: 'Dentist', start: '14:00', end: '15:00' },
    { personId: 'mom', title: 'Email catch-up', start: '21:00', end: '21:30' },
    { personId: 'family', title: 'Movie night', start: '19:00', end: '21:00' },
  ],
  3: [ // Wed – required day
    { personId: 'emma', title: 'School', start: '08:00', end: '15:00' },
    { personId: 'leo', title: 'School', start: '08:00', end: '15:00' },
    { personId: 'mom', title: 'Work', start: '09:00', end: '16:45' },
    { personId: 'leo', title: 'Soccer Practice', start: '16:30', end: '17:30' },
    { personId: 'emma', title: 'Art club', start: '15:30', end: '16:30' },
    { personId: 'mom', title: 'Homework Help', start: '17:30', end: '18:00' },
    { personId: 'family', title: "Dinner at Grandma's", start: '18:30', end: '19:30' },
    { personId: 'dad', title: 'Work', start: '08:30', end: '17:30' },
    { personId: 'family', title: 'Pack lunches', start: '19:45', end: '20:10' },
  ],
  4: [ // Thu – overlap example
    { personId: 'emma', title: 'School', start: '08:00', end: '15:00' },
    { personId: 'leo', title: 'School', start: '08:00', end: '15:00' },
    { personId: 'mom', title: 'Work', start: '09:00', end: '15:00' },
    { personId: 'mom', title: 'Doctor visit', start: '15:30', end: '16:30' },
    { personId: 'dad', title: 'School pickup Leo', start: '15:00', end: '15:45' },
    { personId: 'emma', title: 'Swim lesson', start: '17:00', end: '17:45' },
    { personId: 'leo', title: 'Karate', start: '17:15', end: '18:00' },
    { personId: 'family', title: 'Quiet time', start: '18:00', end: '19:00' },
    { personId: 'family', title: 'Laundry + reset', start: '19:15', end: '20:00' },
  ],
  5: [ // Fri
    { personId: 'emma', title: 'School', start: '08:00', end: '15:00' },
    { personId: 'leo', title: 'School', start: '08:00', end: '15:00' },
    { personId: 'mom', title: 'Work', start: '09:00', end: '17:00' },
    { personId: 'dad', title: 'Work', start: '08:30', end: '17:30' },
    { personId: 'emma', title: 'Dance class', start: '16:00', end: '17:00' },
    { personId: 'leo', title: 'Gaming club', start: '16:00', end: '17:15' },
    { personId: 'family', title: 'Family walk', start: '17:45', end: '18:20' },
    { personId: 'family', title: 'Pizza night', start: '18:30', end: '19:30' },
    { personId: 'mom', title: 'Call grandparents', start: '19:45', end: '20:10' },
    { personId: 'dad', title: 'Clean kitchen', start: '20:10', end: '20:35' },
  ],
  6: [ // Sat – overlapping
    { personId: 'family', title: 'Pancakes', start: '08:30', end: '09:00' },
    { personId: 'emma', title: 'Soccer game', start: '10:00', end: '11:30' },
    { personId: 'leo', title: 'Birthday party', start: '10:30', end: '12:30' },
    { personId: 'mom', title: 'Grocery run', start: '09:00', end: '10:30' },
    { personId: 'dad', title: 'Emma soccer', start: '10:00', end: '11:30' },
    { personId: 'family', title: 'Lunch out', start: '13:00', end: '14:00' },
    { personId: 'dad', title: 'Hardware store', start: '15:00', end: '15:40' },
    { personId: 'emma', title: 'Playground', start: '15:15', end: '16:15' },
    { personId: 'family', title: 'Family movie', start: '19:00', end: '20:30' },
  ],
  0: [ // Sun
    { personId: 'dad', title: 'Coffee run', start: '08:30', end: '09:00' },
    { personId: 'family', title: 'Brunch', start: '10:00', end: '11:30' },
    { personId: 'mom', title: 'Yoga', start: '09:00', end: '09:45' },
    { personId: 'emma', title: 'Weekend job', start: '11:30', end: '14:00' },
    { personId: 'dad', title: 'Fix bike', start: '14:00', end: '15:30' },
    { personId: 'emma', title: 'Homework', start: '16:00', end: '17:00' },
    { personId: 'leo', title: 'Free play', start: '15:00', end: '16:00' },
    { personId: 'family', title: 'Meal prep', start: '17:15', end: '18:15' },
    { personId: 'family', title: 'Early bedtime', start: '20:00', end: '20:30' },
  ],
}

let idCounter = 0
function makeEvent(date: string, e: Omit<Event, 'id'>): Event {
  return { ...e, id: `ev-${date}-${++idCounter}-${e.start}` }
}

/** All events for a given date (YYYY-MM-DD). Uses weekday template. */
export function getEventsForDate(date: string): Event[] {
  const d = new Date(date + 'T12:00:00')
  const weekday = d.getDay()
  const list = TEMPLATE_BY_WEEKDAY[weekday] ?? []
  return list.map((e) => makeEvent(date, e))
}

/** All events for the week containing the given date (Mon–Sun). */
export function getEventsForWeek(centerDate: Date): Event[] {
  const start = new Date(centerDate)
  const day = start.getDay()
  const diff = start.getDate() - day + (day === 0 ? -6 : 1)
  start.setDate(diff)
  const startKey = formatDateKeyInTimeZone(start, 'Europe/Oslo')
  const out: Event[] = []
  for (let i = 0; i < 7; i++) {
    const key = addCalendarDaysOslo(startKey, i)
    out.push(...getEventsForDate(key))
  }
  return out
}
