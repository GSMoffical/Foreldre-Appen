import { describe, expect, it } from 'vitest'
import type { Event } from '../../types'
import { countResolvableCollisions } from '../collisions'

function ev(input: Partial<Event> & Pick<Event, 'id' | 'personId' | 'title' | 'start' | 'end'>): Event {
  return {
    id: input.id,
    personId: input.personId,
    title: input.title,
    start: input.start,
    end: input.end,
    metadata: input.metadata,
  }
}

describe('countResolvableCollisions', () => {
  it('ignores school background collisions', () => {
    const background = [
      ev({
        id: 'bg-school',
        personId: 'p1',
        title: 'Skole',
        start: '09:00',
        end: '10:00',
        metadata: { backgroundKind: 'school' },
      }),
    ]
    const foreground = [
      ev({
        id: 'f1',
        personId: 'p1',
        title: 'Tannlege',
        start: '09:30',
        end: '10:00',
        metadata: { participants: ['p1'] },
      }),
    ]
    expect(countResolvableCollisions(background, foreground)).toBe(0)
  })

  it('counts work background collisions for same participant', () => {
    const background = [
      ev({
        id: 'bg-work',
        personId: 'p1',
        title: 'Jobb',
        start: '09:00',
        end: '10:00',
        metadata: { backgroundKind: 'work' },
      }),
    ]
    const foreground = [
      ev({
        id: 'f1',
        personId: 'p2',
        title: 'Møte',
        start: '09:30',
        end: '10:00',
        metadata: { participants: ['p1'] },
      }),
    ]
    expect(countResolvableCollisions(background, foreground)).toBe(1)
  })
})
