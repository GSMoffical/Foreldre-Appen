import type { TankestromScheduleHighlight, TankestromTimeWindowSummary } from '../types'
import {
  normalizeTankestromScheduleDetails,
  type NormalizedTankestromScheduleDetails,
} from '../lib/tankestromScheduleDetails'

type TankestromScheduleDetailsProps = {
  highlights: TankestromScheduleHighlight[]
  notes: string[]
  bringItems?: string[]
  titleContext?: string[]
  compact?: boolean
  /** Når UI allerede har lest metadata (persistert vindu), ikke gjenberegn vindu på nytt. */
  precomputedTimeWindowSummaries?: TankestromTimeWindowSummary[]
  /**
   * Når true: `highlights`/`notes`/`bringItems`/`precomputedTimeWindowSummaries` er allerede
   * output fra `normalizeTankestromScheduleDetails` (eller tilsvarende). Unngår dobbel-kjøring
   * uten `sourceTextForValidation`, som ellers kan kollapse f.eks. «Oppmøte før første kamp» → «Oppmøte»
   * når notatene ikke inneholder klokkeslett (Tankestrøm import-modal / hendelsesdetaljer).
   */
  useNormalizedInput?: boolean
  /** E2E: stabil selector for «Høydepunkter»-blokken (f.eks. per dag). */
  highlightsTestId?: string
  /** E2E: stabil selector for notatlisten under detaljer. */
  notesTestId?: string
}

function normalizedDetailsFromProps(
  highlights: TankestromScheduleHighlight[],
  notes: string[],
  bringItems: string[],
  timeWindowSummaries: TankestromTimeWindowSummary[]
): NormalizedTankestromScheduleDetails {
  return {
    highlights: [...highlights],
    notes: [...notes],
    bringItems: [...bringItems],
    timeWindowSummaries: [...timeWindowSummaries],
    removedFragments: [],
    removedDuplicateHighlights: 0,
    removedHighlights: [],
    liftedBringItems: [],
  }
}

export function TankestromScheduleDetails({
  highlights,
  notes,
  bringItems = [],
  titleContext = [],
  compact = false,
  precomputedTimeWindowSummaries,
  useNormalizedInput = false,
  highlightsTestId,
  notesTestId,
}: TankestromScheduleDetailsProps) {
  const normalized = useNormalizedInput
    ? normalizedDetailsFromProps(highlights, notes, bringItems, precomputedTimeWindowSummaries ?? [])
    : normalizeTankestromScheduleDetails({
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
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {hasHighlightSection ? (
        <div data-testid={highlightsTestId}>
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
        <div data-testid={notesTestId}>
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
