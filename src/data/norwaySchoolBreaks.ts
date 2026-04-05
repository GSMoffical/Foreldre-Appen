/**
 * Norwegian school-year breaks (skoleferier) — approximate **Oslo** dates.
 * Fylke/kommune varies; replace with UD API or kommune picker when available.
 * @see https://www.udir.no/ — national framework; local dates differ.
 */
export type SchoolBreakEntry = {
  /** Inclusive ISO date */
  start: string
  /** Inclusive ISO date */
  end: string
  /** Norwegian label for UI */
  label: string
}

export const DEFAULT_SCHOOL_REGION_LABEL = 'Oslo (standard)'

/** Multi-day periods when schools are typically closed (in addition to public holidays). */
export const NORWAY_SCHOOL_BREAKS: readonly SchoolBreakEntry[] = [
  { start: '2025-02-17', end: '2025-02-21', label: 'Vinterferie' },
  { start: '2025-04-14', end: '2025-04-21', label: 'Påskeferie' },
  { start: '2025-05-29', end: '2025-05-30', label: 'Fridager rundt 2. pinsedag' },
  { start: '2025-06-20', end: '2025-08-15', label: 'Sommerferie' },
  { start: '2025-10-06', end: '2025-10-10', label: 'Høstferie' },
  { start: '2025-12-22', end: '2026-01-02', label: 'Juleferie' },

  { start: '2026-02-23', end: '2026-02-27', label: 'Vinterferie' },
  { start: '2026-03-30', end: '2026-04-06', label: 'Påskeferie' },
  { start: '2026-06-22', end: '2026-08-14', label: 'Sommerferie' },
  { start: '2026-10-05', end: '2026-10-09', label: 'Høstferie' },
  { start: '2026-12-21', end: '2027-01-01', label: 'Juleferie' },
]
