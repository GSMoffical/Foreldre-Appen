import { buildDailyStatusText } from '../lib/uxStatus'

interface DailyStatusLineProps {
  unresolvedCollisionCount: number
  remainingCount: number
  completedCount?: number
}

export function DailyStatusLine({ unresolvedCollisionCount, remainingCount, completedCount = 0 }: DailyStatusLineProps) {
  const text = buildDailyStatusText(unresolvedCollisionCount, remainingCount)

  return (
    <div className="mx-4 mt-2 rounded-full bg-brandNavy/5 px-3 py-1.5 text-[12px] font-medium text-brandNavy">
      {text}
      {completedCount > 0 ? ` · ${completedCount} ferdige` : ''}
    </div>
  )
}
