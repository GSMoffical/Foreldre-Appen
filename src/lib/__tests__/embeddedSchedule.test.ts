import { describe, expect, it } from 'vitest'
import {
  evaluateEmbeddedScheduleParentCardHeuristic,
  groupEmbeddedScheduleByDate,
  parseEmbeddedScheduleFromMetadata,
} from '../embeddedSchedule'
import type { EventMetadata } from '../../types'

describe('parseEmbeddedScheduleFromMetadata', () => {
  it('returnerer tom liste uten metadata eller schedule', () => {
    expect(parseEmbeddedScheduleFromMetadata(undefined)).toEqual([])
    expect(parseEmbeddedScheduleFromMetadata({} as EventMetadata)).toEqual([])
  })

  it('beholder gyldige segmenter og dropper ugyldige', () => {
    const meta: EventMetadata = {
      embeddedSchedule: [
        { date: '2026-06-12', title: 'Oppmøte', start: '17:45' },
        { date: 'bad', title: 'X' },
        { date: '2026-06-12', title: 'Kamp', start: '18:40', end: '19:30', isConditional: false },
        { date: '2026-06-14', title: 'Sluttspill', notes: 'Ved avansement', isConditional: true },
      ],
    }
    const out = parseEmbeddedScheduleFromMetadata(meta)
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({ date: '2026-06-12', title: 'Oppmøte', start: '17:45' })
    expect(out[2]).toMatchObject({ isConditional: true, title: 'Sluttspill' })
  })
})

describe('evaluateEmbeddedScheduleParentCardHeuristic', () => {
  const baseEvent = {
    kind: 'event' as const,
    event: {
      date: '2026-06-12',
      start: '10:00',
      end: '11:00',
      title: 'X',
      personId: 'p1',
      metadata: {
        embeddedSchedule: [{ date: '2026-06-12', title: 'Kamp' }],
      } as EventMetadata,
    },
  }

  it('godtar multiDayAllDay uten isAllDay (Tankestrøm cup-container)', () => {
    const item = {
      ...baseEvent,
      event: {
        ...baseEvent.event,
        metadata: {
          ...baseEvent.event.metadata,
          multiDayAllDay: true,
        } as EventMetadata,
      },
    }
    const h = evaluateEmbeddedScheduleParentCardHeuristic(item)
    expect(h.ok).toBe(true)
    expect(h.matchedFields).toContain('multiDayAllDay')
  })

  it('godtar 00:00–23:59 uten isAllDay', () => {
    const item = {
      ...baseEvent,
      event: {
        ...baseEvent.event,
        start: '00:00',
        end: '23:59',
      },
    }
    const h = evaluateEmbeddedScheduleParentCardHeuristic(item)
    expect(h.ok).toBe(true)
    expect(h.reason).toBe('allDayClockRange')
  })

  it('godtar legacy-flagget isArrangementParent', () => {
    const item = {
      ...baseEvent,
      event: {
        ...baseEvent.event,
        metadata: {
          ...baseEvent.event.metadata,
          isArrangementParent: true,
        } as EventMetadata,
      },
    }
    const h = evaluateEmbeddedScheduleParentCardHeuristic(item)
    expect(h.ok).toBe(true)
    expect(h.reason).toBe('isArrangementParent')
  })

  it('godtar embeddedSchedule med minst to datoer uten heldagsflagg', () => {
    const item = {
      ...baseEvent,
      event: {
        ...baseEvent.event,
        metadata: {
          embeddedSchedule: [
            { date: '2026-06-12', title: 'Fredag' },
            { date: '2026-06-13', title: 'Lørdag' },
          ],
        } as EventMetadata,
      },
    }
    const h = evaluateEmbeddedScheduleParentCardHeuristic(item)
    expect(h.ok).toBe(true)
    expect(h.reason).toBe('embeddedScheduleMultiDay')
  })

  it('avviser innebygd program med vanlig klokkeslett og uten heldagssignal', () => {
    const h = evaluateEmbeddedScheduleParentCardHeuristic(baseEvent)
    expect(h.ok).toBe(false)
    expect(h.reason).toBe('not_all_day_container_signal')
  })
})

describe('groupEmbeddedScheduleByDate', () => {
  it('sorterer datoer og tider', () => {
    const items = parseEmbeddedScheduleFromMetadata({
      embeddedSchedule: [
        { date: '2026-06-13', title: 'B', start: '10:00' },
        { date: '2026-06-12', title: 'Sen', start: '18:00' },
        { date: '2026-06-12', title: 'Tidlig', start: '09:00' },
      ],
    })
    const g = groupEmbeddedScheduleByDate(items)
    expect(g.map((x) => x.date)).toEqual(['2026-06-12', '2026-06-13'])
    expect(g[0]!.items.map((i) => i.title)).toEqual(['Tidlig', 'Sen'])
  })
})
