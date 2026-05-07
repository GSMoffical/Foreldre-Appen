import type { KeyboardEvent, MouseEvent } from 'react'
import type { DragReschedulePayload, GapInfo, TimelineLayoutItem, Task } from '../types'
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
  dayTasks?: Task[]
  onSelectTask?: (task: Task) => void
  highlightedEventIds?: Set<string>
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
  dayTasks,
  onSelectTask,
  highlightedEventIds,
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

      {dayTasks
        ?.filter((t) => !t.completedAt && !!t.dueTime)
        .map((task) => {
          const parts = task.dueTime!.split(':').map(Number)
          const topPx = (((parts[0] ?? 0) * 60 + (parts[1] ?? 0) - TIMELINE_START_HOUR * 60) / 60) * pixelsPerHour
          if (topPx < 0 || topPx > totalHeight) return null
          const label = task.title.length > 16 ? task.title.slice(0, 15) + '…' : task.title
          const rowClass =
            'absolute left-0 right-2 flex items-center gap-1'
          const inner = (
            <>
              <span className="h-2 w-2 shrink-0 rounded-sm bg-amber-400" />
              <div className="flex-1 border-t border-dashed border-amber-300" />
              <span className="whitespace-nowrap rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                {label}
              </span>
            </>
          )
          if (onSelectTask) {
            return (
              <button
                key={`dl-${task.id}`}
                type="button"
                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation()
                  onSelectTask(task)
                }}
                onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelectTask(task)
                  }
                }}
                aria-label={`Åpne gjøremål: ${task.title}${task.dueTime ? `, frist ${task.dueTime}` : ''}`}
                className={`${rowClass} cursor-pointer pointer-events-auto rounded-md py-0.5 text-left transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:ring-offset-0 touch-manipulation`}
                style={{ top: topPx, zIndex: 1 }}
              >
                {inner}
              </button>
            )
          }
          return (
            <div
              key={`dl-${task.id}`}
              className={`${rowClass} pointer-events-none`}
              style={{ top: topPx, zIndex: 1 }}
            >
              {inner}
            </div>
          )
        })}

      {layoutItems.map((item, index) => (
        <ActivityBlock
          key={item.block.id}
          block={item.block}
          staggerIndex={index}
          onSelect={() => onSelectEvent(item.block)}
          onDragReschedule={onDragReschedule}
          pixelsPerHour={pixelsPerHour}
          isHighlighted={highlightedEventIds?.has(item.block.id) === true}
        />
      ))}

      {showLine && (
        <CurrentTimeIndicator currentTime={nowStr} pixelsPerHour={pixelsPerHour} />
      )}
    </div>
  )
}
