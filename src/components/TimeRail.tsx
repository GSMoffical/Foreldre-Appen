import {
  TIMELINE_START_HOUR,
  TIMELINE_LAST_LABELED_HOUR,
  timelineTotalHeight,
  PIXELS_PER_HOUR,
} from '../lib/time'

interface TimeRailProps {
  pixelsPerHour?: number
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export function TimeRail({ pixelsPerHour = PIXELS_PER_HOUR }: TimeRailProps) {
  const totalHeight = timelineTotalHeight(pixelsPerHour)
  const hours: number[] = []
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_LAST_LABELED_HOUR; h++) {
    hours.push(h)
  }

  return (
    <div
      className="sticky left-0 z-10 w-14 shrink-0 bg-surface pr-2 pt-0.5"
      style={{ height: totalHeight }}
      aria-hidden
    >
      {hours.map((h) => (
        <div
          key={h}
          className="flex items-start justify-end font-mono tabular-nums text-rail text-zinc-400"
          style={{ height: pixelsPerHour, marginTop: h === TIMELINE_START_HOUR ? 0 : undefined }}
        >
          {formatHour(h)}
        </div>
      ))}
    </div>
  )
}
