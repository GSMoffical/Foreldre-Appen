import { describe, it, expect } from 'vitest'
import { layoutOverlappingEvents, layoutTimelineWithOverlapGroups } from '../overlaps'
import type { Event } from '../../types'

function makeEvent(id: string, start: string, end: string): Event {
  return { id, personId: 'test', title: `Event ${id}`, start, end }
}

describe('layoutOverlappingEvents', () => {
  it('returns empty for no events', () => {
    expect(layoutOverlappingEvents([], 80)).toEqual([])
  })

  it('single event gets column 0 of 1', () => {
    const events = [makeEvent('a', '09:00', '10:00')]
    const result = layoutOverlappingEvents(events, 80)
    expect(result).toHaveLength(1)
    expect(result[0].columnIndex).toBe(0)
    expect(result[0].totalColumns).toBe(1)
  })

  it('non-overlapping events share a single column', () => {
    const events = [
      makeEvent('a', '09:00', '10:00'),
      makeEvent('b', '10:00', '11:00'),
    ]
    const result = layoutOverlappingEvents(events, 80)
    expect(result).toHaveLength(2)
    expect(result[0].totalColumns).toBe(1)
    expect(result[1].totalColumns).toBe(1)
  })

  it('overlapping events get different columns', () => {
    const events = [
      makeEvent('a', '09:00', '10:30'),
      makeEvent('b', '09:30', '11:00'),
    ]
    const result = layoutOverlappingEvents(events, 80)
    expect(result).toHaveLength(2)
    expect(result[0].totalColumns).toBe(2)
    expect(result[1].totalColumns).toBe(2)
    expect(result[0].columnIndex).not.toBe(result[1].columnIndex)
  })

  it('three overlapping events get three columns', () => {
    const events = [
      makeEvent('a', '09:00', '11:00'),
      makeEvent('b', '09:30', '10:30'),
      makeEvent('c', '10:00', '11:30'),
    ]
    const result = layoutOverlappingEvents(events, 80)
    expect(result).toHaveLength(3)
    expect(result[0].totalColumns).toBe(3)
  })

  it('computes correct topPx and heightPx', () => {
    const events = [makeEvent('a', '08:00', '09:00')]
    const result = layoutOverlappingEvents(events, 80)
    expect(result[0].topPx).toBe(8 * 80)
    expect(result[0].heightPx).toBe(80)
  })
})

describe('layoutTimelineWithOverlapGroups', () => {
  it('wraps events as single-type items', () => {
    const events = [makeEvent('a', '09:00', '10:00')]
    const result = layoutTimelineWithOverlapGroups(events, 80)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('single')
    expect(result[0].block.id).toBe('a')
  })

  it('sorts by topPx', () => {
    const events = [
      makeEvent('b', '11:00', '12:00'),
      makeEvent('a', '09:00', '10:00'),
    ]
    const result = layoutTimelineWithOverlapGroups(events, 80)
    expect(result[0].block.id).toBe('a')
    expect(result[1].block.id).toBe('b')
  })
})
