/**
 * Overlap detection and layout.
 * - layoutOverlappingEvents: column-based (side-by-side) blocks.
 * - layoutTimelineWithOverlapGroups: wrapper that returns TimelineLayoutItems using that layout.
 */

import type { Event, EventLayoutBlock, TimelineLayoutItem } from '../types'
import {
  parseTime,
  timeToY,
  durationToHeight,
  TIMELINE_START_HOUR,
  PIXELS_PER_HOUR,
} from './time'

function overlaps(a: Event, b: Event): boolean {
  const aStart = parseTime(a.start)
  const aEnd = parseTime(a.end)
  const bStart = parseTime(b.start)
  const bEnd = parseTime(b.end)
  return aStart < bEnd && bStart < aEnd
}

/**
 * Group events into columns so overlapping events sit side-by-side.
 * This is the single source of truth for block layout.
 */
export function layoutOverlappingEvents(
  events: Event[],
  pixelsPerHour: number = PIXELS_PER_HOUR
): EventLayoutBlock[] {
  const sorted = [...events].sort((a, b) => parseTime(a.start) - parseTime(b.start))

  // First, break the day into "overlap groups" – contiguous clusters where
  // intervals overlap in time. Groups do not overlap each other.
  const groups: Event[][] = []
  let currentGroup: Event[] = []
  let groupEnd = -Infinity

  for (const ev of sorted) {
    const s = parseTime(ev.start)
    const e = parseTime(ev.end)
    if (currentGroup.length === 0) {
      currentGroup.push(ev)
      groupEnd = e
      continue
    }
    if (s < groupEnd) {
      // Still within the current overlap cluster.
      currentGroup.push(ev)
      groupEnd = Math.max(groupEnd, e)
    } else {
      // No overlap with current cluster; start a new group.
      groups.push(currentGroup)
      currentGroup = [ev]
      groupEnd = e
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  const result: EventLayoutBlock[] = []

  // Within each group, do the column layout. totalColumns is per-group,
  // so blocks expand horizontally when there is room (i.e., group has 1 event).
  for (const group of groups) {
    const columns: Event[][] = []

    for (const ev of group) {
      let placed = false
      for (let c = 0; c < columns.length; c++) {
        const last = columns[c][columns[c].length - 1]
        if (!overlaps(last, ev)) {
          columns[c].push(ev)
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([ev])
      }
    }

    const totalColumns = columns.length || 1

    columns.forEach((col, columnIndex) => {
      for (const ev of col) {
        const start = parseTime(ev.start)
        const end = parseTime(ev.end)
        result.push({
          ...ev,
          topPx: timeToY(ev.start, TIMELINE_START_HOUR, pixelsPerHour),
          heightPx: durationToHeight(end - start, pixelsPerHour),
          columnIndex,
          totalColumns,
        })
      }
    })
  }

  return result
}

/**
 * Wrapper: return TimelineLayoutItems using the column layout for overlaps.
 */
export function layoutTimelineWithOverlapGroups(
  events: Event[],
  pixelsPerHour: number = PIXELS_PER_HOUR
): TimelineLayoutItem[] {
  const blocks = layoutOverlappingEvents(events, pixelsPerHour)
  return blocks
    .map((block): TimelineLayoutItem => ({ type: 'single', block }))
    .sort((a, b) => a.block.topPx - b.block.topPx)
}

