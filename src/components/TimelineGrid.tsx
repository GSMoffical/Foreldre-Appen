import type { DragReschedulePayload, GapInfo, TimelineLayoutItem } from '../types'
import type { Event } from '../types'
import { ActivityBlock } from './ActivityBlock'
import { BackgroundBlock } from './BackgroundBlock'
import { GapLabel } from './GapLabel'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'
import {
  timelineTotalHeight,
  PIXELS_PER_HOUR,
  TIMELINE_START_HOUR,
  TIMELINE_END_HOUR,
} from '../lib/time'
import { getNowMinutes } from '../lib/schedule'
import { todayKeyOslo } from '../lib/osloCalendar'

interface TimelineGridProps {
  layoutItems: TimelineLayoutItem[]
  backgroundLayoutItems?: TimelineLayoutItem[]
  gaps: GapInfo[]
  showCurrentTime: boolean
  selectedDate: string
  pixelsPerHour?: number
  onSelectEvent: (event: Event) => void
  onSelectBackgroundEvent?: (event: Event) => void
  onDragReschedule?: (eventId: string, payload: DragReschedulePayload) => void | Promise<void>
  variant?: 'day' | 'week'
}

function nowTimeString(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TimelineGrid({
  layoutItems,
  backgroundLayoutItems = [],
  gaps,
  showCurrentTime,
  selectedDate,
  pixelsPerHour = PIXELS_PER_HOUR,
  onSelectEvent,
  onSelectBackgroundEvent,
  onDragReschedule,
  variant = 'day',
}: TimelineGridProps) {
  const totalHeight = timelineTotalHeight(pixelsPerHour)
  const isToday = (() => {
    const today = todayKeyOslo()
    return selectedDate === today
  })()
  const nowStr = nowTimeString()
  const nowMin = getNowMinutes()
  const dayStartMin = TIMELINE_START_HOUR * 60
  const dayEndMin = TIMELINE_END_HOUR * 60
  const showLine = showCurrentTime && isToday && nowMin >= dayStartMin && nowMin < dayEndMin
  const isWeek = variant === 'week'
  const hourLineClass = isWeek ? 'border-zinc-50' : 'border-zinc-100'

  return (
    <div
      className="relative w-full"
      style={{ height: totalHeight, minHeight: totalHeight }}
    >
      {Array.from(
        { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR },
        (_, i) => TIMELINE_START_HOUR + i
      ).map((h) => (
        <div
          key={h}
          className={`absolute left-0 right-0 border-t ${hourLineClass}`}
          style={{
            top: (h - TIMELINE_START_HOUR) * pixelsPerHour,
          }}
        />
      ))}

      {!isWeek && gaps.map((gap) => (
        <GapLabel key={`${gap.startMinutes}-${gap.endMinutes}`} gap={gap} />
      ))}

      {backgroundLayoutItems.map((item) => (
        <BackgroundBlock
          key={item.block.id}
          block={item.block}
          onSelect={onSelectBackgroundEvent ? () => onSelectBackgroundEvent(item.block) : undefined}
        />
      ))}

      {layoutItems.map((item, index) => (
        <ActivityBlock
          key={item.block.id}
          block={item.block}
          staggerIndex={index}
          onSelect={() => onSelectEvent(item.block)}
          onDragReschedule={onDragReschedule}
          pixelsPerHour={pixelsPerHour}
        />
      ))}

      {showLine && (
        <CurrentTimeIndicator currentTime={nowStr} pixelsPerHour={pixelsPerHour} />
      )}
    </div>
  )
}
