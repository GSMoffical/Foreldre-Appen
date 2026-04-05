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
      className="pointer-events-none absolute left-0 right-0 z-20"
      style={{ top: y, transform: 'translateY(-50%)' }}
      aria-hidden
    >
      <div
        className="h-px w-full"
        style={{ backgroundColor: 'rgb(239 68 68 / 0.35)' }}
      />
    </div>
  )
}
