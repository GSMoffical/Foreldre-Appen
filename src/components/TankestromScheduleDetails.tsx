import type { TankestromScheduleHighlight, TankestromTimeWindowSummary } from '../types'
import { normalizeTankestromScheduleDetails } from '../lib/tankestromScheduleDetails'

type TankestromScheduleDetailsProps = {
  highlights: TankestromScheduleHighlight[]
  notes: string[]
  bringItems?: string[]
  titleContext?: string[]
  compact?: boolean
  /** Når UI allerede har lest metadata (persistert vindu), ikke gjenberegn vindu på nytt. */
  precomputedTimeWindowSummaries?: TankestromTimeWindowSummary[]
}
export function TankestromScheduleDetails({
  highlights,
  notes,
  bringItems = [],
  titleContext = [],
  compact = false,
  precomputedTimeWindowSummaries,
}: TankestromScheduleDetailsProps) {
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true') {
    const title = titleContext[0] ?? ''
    const t = title.toLocaleLowerCase('nb-NO')
    if (t.includes('vårcup') || t.includes('varcup')) {
      console.info('[Vårcup schedule details render input]', {
        title,
        highlights,
        notes,
        bringItems,
        timeWindowSummaries: precomputedTimeWindowSummaries ?? [],
      })
    }
  }
  const normalized = normalizeTankestromScheduleDetails({
    highlights,
    notes,
    bringItems,
    titleContext,
    precomputedTimeWindowSummaries,
  })
  const hasHighlightSection =
    normalized.timeWindowSummaries.length > 0 || normalized.highlights.length > 0
  if (
    !hasHighlightSection &&
    normalized.notes.length === 0 &&
    normalized.bringItems.length === 0
  ) {
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
      {hasHighlightSection ? (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[10px]">Høydepunkter</p>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-4 marker:text-zinc-400 sm:space-y-2 sm:pl-[1.125rem]">
            {normalized.timeWindowSummaries.map((s, i) => (
              <li key={`tw-${s.timeRange}-${i}`} className="pl-0.5 text-[11px] leading-snug sm:text-[12px]">
                <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-orange-900 ring-1 ring-orange-200/90 sm:text-[12px]">
                    {s.timeRange}
                    {s.tentative ? (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-orange-700/90 sm:text-[10px]">
                        Foreløpig
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 font-medium text-zinc-800">{s.label}</span>
                </span>
              </li>
            ))}
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
