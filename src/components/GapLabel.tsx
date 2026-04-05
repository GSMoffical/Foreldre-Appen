import { formatGapLabel } from '../lib/schedule'
import type { GapInfo } from '../types'

interface GapLabelProps {
  gap: GapInfo
}

export function GapLabel({ gap }: GapLabelProps) {
  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-center"
      style={{
        top: gap.topPx,
        height: gap.heightPx,
      }}
      aria-hidden
    >
      <span className="rounded-full bg-zinc-100/80 px-2 py-1 text-[11px] font-medium text-zinc-500">
        {formatGapLabel(gap.durationMinutes)}
      </span>
    </div>
  )
}
