import { describe, it, expect } from 'vitest'
import {
  calculateVisibleEvents,
  calculateGaps,
  formatGapLabel,
  buildDaySummary,
  formatCalendarEventTimeLabel,
  dedupeTimelineEventsById,
} from '../schedule'
import type { Event } from '../../types'

function makeEvent(id: string, personId: string, start: string, end: string): Event {
  return { id, personId, title: `Event ${id}`, start, end }
}

describe('calculateVisibleEvents', () => {
  const events = [
    makeEvent('a', 'emma', '09:00', '10:00'),
    makeEvent('b', 'leo', '10:00', '11:00'),
    makeEvent('c', 'emma', '11:00', '12:00'),
  ]

  it('returns all events when filter is empty', () => {
    expect(calculateVisibleEvents(events, [])).toEqual(events)
  })

  it('filters by person ID', () => {
    const result = calculateVisibleEvents(events, ['emma'])
    expect(result).toHaveLength(2)
    expect(result.every((e) => e.personId === 'emma')).toBe(true)
  })

  it('viser hendelser uten person (personId null) selv når filter er aktivt', () => {
    const withUnassigned: Event[] = [
      ...events,
      {
        id: 'u',
        personId: null,
        title: 'Uten person',
        start: '14:00',
        end: '15:00',
      },
    ]
    const result = calculateVisibleEvents(withUnassigned, ['emma'])
    expect(result.some((e) => e.id === 'u')).toBe(true)
  })

  it('viser date_only-hendelser (timePrecision) selv uten varighet i klokkeslett', () => {
    const dateOnly: Event[] = [
      {
        id: 'd',
        personId: 'emma',
        title: 'Tid ikke avklart',
        start: '09:00',
        end: '09:00',
        metadata: { timePrecision: 'date_only' as const },
      },
    ]
    const result = calculateVisibleEvents(dateOnly, ['emma'])
    expect(result).toHaveLength(1)
  })

  it('formatCalendarEventTimeLabel: start_only viser eksplisitt manglende slutt', () => {
    const ev: Event = {
      id: 'x',
      personId: 'emma',
      title: 'Cup',
      start: '08:35',
      end: '09:35',
      metadata: {
        timePrecision: 'start_only',
        displayTimeLabel: 'Sluttid ikke oppgitt',
        endTimeSource: 'missing_or_unreadable',
        layoutEndOnly: true,
      },
    }
    expect(formatCalendarEventTimeLabel(ev)).toBe('08:35 · Sluttid ikke oppgitt')
  })

  it('formatCalendarEventTimeLabel: timeWindow overstyrer fast startvisning', () => {
    const ev: Event = {
      id: 'tw',
      personId: 'emma',
      title: 'Cup',
      start: '10:00',
      end: '10:30',
      metadata: {
        timeWindow: { start: '10:00', end: '12:00' },
      },
    }
    expect(formatCalendarEventTimeLabel(ev)).toBe('Mellom 10:00 og 12:00')
  })

  it('formatCalendarEventTimeLabel: ufullstendig timeWindow blir forelopig-label', () => {
    const ev: Event = {
      id: 'tw2',
      personId: 'emma',
      title: 'Cup',
      start: '10:00',
      end: '10:30',
      metadata: {
        timeWindow: { start: '10:00' },
      },
    }
    expect(formatCalendarEventTimeLabel(ev)).toBe('Tidspunkt ikke endelig')
  })

  it('dedupeTimelineEventsById beholder første rad per id', () => {
    const a = makeEvent('dup', 'emma', '08:00', '09:00')
    const b = { ...a, title: 'Annen tittel' }
    expect(dedupeTimelineEventsById([a, b])).toEqual([a])
  })

  it('viser start_only-hendelser med start === end (fly uten sluttid)', () => {
    const startOnly: Event[] = [
      {
        id: 'f',
        personId: 'emma',
        title: 'Fly',
        start: '06:05',
        end: '06:05',
        metadata: { timePrecision: 'start_only' as const },
      },
    ]
    const result = calculateVisibleEvents(startOnly, ['emma'])
    expect(result).toHaveLength(1)
  })
})

describe('calculateGaps', () => {
  it('finds gaps between events', () => {
    const events = [
      makeEvent('a', 'x', '09:00', '10:00'),
      makeEvent('b', 'x', '12:00', '13:00'),
    ]
    const gaps = calculateGaps(events, 80, 45)
    expect(gaps.length).toBeGreaterThan(0)
    const gap = gaps.find((g) => g.startMinutes === 10 * 60)
    expect(gap).toBeDefined()
    expect(gap!.durationMinutes).toBe(120)
  })

  it('returns no gaps shorter than threshold', () => {
    const events = [
      makeEvent('a', 'x', '09:00', '09:40'),
      makeEvent('b', 'x', '10:00', '11:00'),
    ]
    const gaps = calculateGaps(events, 80, 45)
    const shortGap = gaps.find((g) => g.durationMinutes < 45)
    expect(shortGap).toBeUndefined()
  })
})

describe('formatGapLabel', () => {
  it('formats minutes only', () => {
    expect(formatGapLabel(45)).toBe('45 min ledig')
  })
  it('formats hours only', () => {
    expect(formatGapLabel(120)).toBe('2 t ledig')
  })
  it('formats hours and minutes', () => {
    expect(formatGapLabel(90)).toBe('1 t 30 min ledig')
  })
})

describe('buildDaySummary', () => {
  it('counts activities', () => {
    const events = [
      makeEvent('a', 'x', '09:00', '10:00'),
      makeEvent('b', 'x', '11:00', '12:00'),
    ]
    const summary = buildDaySummary(events, '2024-01-15')
    expect(summary.activityCount).toBe(2)
  })

  it('finds next upcoming event', () => {
    const events = [
      makeEvent('a', 'x', '09:00', '10:00'),
      makeEvent('b', 'x', '14:00', '15:00'),
    ]
    const summary = buildDaySummary(events, '2024-01-15', 12 * 60)
    expect(summary.nextEvent?.id).toBe('b')
    expect(summary.minutesUntilNext).toBe(120)
  })
})
