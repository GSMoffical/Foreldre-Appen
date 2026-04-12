import { timeToY, TIMELINE_START_HOUR, PIXELS_PER_HOUR } from '../lib/time'

interface CurrentTimeIndicatorProps {
  /** Current time as "HH:mm" */
  currentTime: string
  pixelsPerHour?: number
}

export function CurrentTimeIndicator({
  currentTime,
  pixelsPerHour = PIXELS_PER_HOUR,
}: CurrentTimeIndicatorProps) {
  const y = timeToY(currentTime, TIMELINE_START_HOUR, pixelsPerHour)

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
      style={{ top: y, transform: 'translateY(-50%)' }}
      aria-hidden
    >
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: 'rgb(239 68 68 / 0.80)' }}
      />
      <div
        className="h-[1.5px] flex-1"
        style={{ backgroundColor: 'rgb(239 68 68 / 0.40)' }}
      />
    </div>
  )
}
