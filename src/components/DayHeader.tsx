import type { DaySummary } from '../types'

interface DayHeaderProps {
  date: string
  summary: DaySummary
}

const MONTHS = 'januar,februar,mars,april,mai,juni,juli,august,september,oktober,november,desember'.split(',')

function formatHeaderDate(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const weekday = d.toLocaleDateString('nb-NO', { weekday: 'long' })
  const month = MONTHS[d.getMonth()]
  const day = d.getDate()
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}. ${month}`
}

export function DayHeader({ date, summary }: DayHeaderProps) {
  const freeH = Math.floor(summary.freeTimeMinutes / 60)
  const freeM = summary.freeTimeMinutes % 60
  const freeStr = freeM ? `${freeH} t ${freeM} min` : `${freeH} t`

  return (
    <header className="px-5 pb-3 pt-1">
      <h1 className="text-[28px] font-bold tracking-tight text-zinc-900">
        {formatHeaderDate(date)}
      </h1>
      <p className="mt-1 text-[13px] text-zinc-500">
        {summary.activityCount} {summary.activityCount === 1 ? 'aktivitet' : 'aktiviteter'} · {freeStr} fri tid
      </p>
    </header>
  )
}
