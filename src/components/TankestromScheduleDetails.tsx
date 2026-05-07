import type { TankestromScheduleHighlight } from '../types'
import { normalizeTankestromScheduleDetails } from '../lib/tankestromScheduleDetails'

type TankestromScheduleDetailsProps = {
  highlights: TankestromScheduleHighlight[]
  notes: string[]
  bringItems?: string[]
  titleContext?: string[]
  compact?: boolean
}
export function TankestromScheduleDetails({
  highlights,
  notes,
  bringItems = [],
  titleContext = [],
  compact = false,
}: TankestromScheduleDetailsProps) {
  const normalized = normalizeTankestromScheduleDetails({
    highlights,
    notes,
    bringItems,
    titleContext,
  })
  if (normalized.highlights.length === 0 && normalized.notes.length === 0 && normalized.bringItems.length === 0) {
    return null
  }
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
    console.info('[Tankestrom schedule details debug]', {
      rawMetadataDetails: null,
      normalizedDetails: normalized,
      renderedHighlights: normalized.highlights,
      renderedBringItems: normalized.bringItems,
      renderedNotes: normalized.notes,
      removedFragments: normalized.removedFragments,
      removedDuplicateHighlights: normalized.removedDuplicateHighlights,
    })
  }
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {normalized.highlights.length > 0 ? (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[10px]">Høydepunkter</p>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-4 marker:text-zinc-400 sm:space-y-2 sm:pl-[1.125rem]">
            {normalized.highlights.map((h, i) => (
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
      {normalized.bringItems.length > 0 ? (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-red-600 sm:text-[10px]">Husk / ta med</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-snug text-zinc-800 sm:text-[12px]">
            {normalized.bringItems.map((n, i) => (
              <li key={`${n}-${i}`} className="break-words pl-0.5">
                {n}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {normalized.notes.length > 0 ? (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[10px]">Notater</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-snug text-zinc-800 sm:text-[12px]">
            {normalized.notes.map((n, i) => (
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
