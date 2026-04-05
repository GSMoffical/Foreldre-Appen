import type { Event } from '../types'
import { useFamily } from '../context/FamilyContext'
import { formatParticipantNamesLine } from '../lib/eventParticipants'

interface HeaderSummaryCardProps {
  nextEvent: Event | null
  minutesUntilNext: number | null
}

export function HeaderSummaryCard({ nextEvent, minutesUntilNext }: HeaderSummaryCardProps) {
  const { people } = useFamily()
  if (!nextEvent || minutesUntilNext == null) return null
  const who = formatParticipantNamesLine(nextEvent, people)
  if (who === 'Ukjent') return null

  const str =
    minutesUntilNext < 60
      ? `Starter om ${minutesUntilNext} min`
      : `Starter om ${Math.floor(minutesUntilNext / 60)} t ${minutesUntilNext % 60} min`

  return (
    <div className="mx-4 mb-2 rounded-card bg-white py-2.5 pl-4 pr-4 shadow-soft">
      <p className="text-micro font-semibold uppercase tracking-wider text-zinc-500">
        Neste
      </p>
      <p className="mt-0.5 text-[15px] font-semibold text-zinc-900">
        {who} · {nextEvent.title}
      </p>
      <p className="mt-0.5 text-[12px] text-zinc-500">{str}</p>
    </div>
  )
}
