import type { TankestromScheduleHighlight } from '../types'

type TankestromScheduleDetailsProps = {
  highlights: TankestromScheduleHighlight[]
  notes: string[]
  compact?: boolean
}
export function TankestromScheduleDetails({ highlights, notes, compact = false }: TankestromScheduleDetailsProps) {
  if (highlights.length === 0 && notes.length === 0) return null
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {highlights.length > 0 ? (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[10px]">Høydepunkter</p>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-4 marker:text-zinc-400 sm:space-y-2 sm:pl-[1.125rem]">
            {highlights.map((h, i) => (
              <li key={`${h.time}-${h.label}-${i}`} className="pl-0.5 text-[11px] leading-snug sm:text-[12px]">
                <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="inline-flex shrink-0 rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-orange-900 ring-1 ring-orange-200/90 sm:text-[12px]">
                    {h.time}
                  </span>
                  <span className="min-w-0 font-medium text-zinc-800">{h.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {notes.length > 0 ? (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[10px]">Notater</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-snug text-zinc-800 sm:text-[12px]">
            {notes.map((n, i) => (
              <li key={`${n}-${i}`} className="break-words pl-0.5">
                {n}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
