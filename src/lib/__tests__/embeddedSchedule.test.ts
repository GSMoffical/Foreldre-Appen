import { describe, expect, it } from 'vitest'
import { groupEmbeddedScheduleByDate, parseEmbeddedScheduleFromMetadata } from '../embeddedSchedule'
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
