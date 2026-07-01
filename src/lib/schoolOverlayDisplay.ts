import type { ChildSchoolDayPlan, NorwegianGradeBand, SchoolLessonSlot } from '../types'
import { subjectLabelForKey } from '../data/norwegianSubjects'

/**
 * Delte, rene hjelpere for visning av uke-overlay under fag — brukes av BÅDE kalenderens
 * BackgroundDetailSheet og import-previewen (SchoolLessonOverlayRows), så visningen holdes
 * i synk. Ingen JSX, ingen edit/persist.
 */

export type OverlaySectionKey =
  | 'iTimen'
  | 'lekse'
  | 'huskTaMed'
  | 'proveVurdering'
  | 'ressurser'
  | 'ekstraBeskjed'

export const OVERLAY_SECTION_LABELS: Record<OverlaySectionKey, string> = {
  iTimen: 'I timen',
  lekse: 'Lekse',
  huskTaMed: 'Husk / ta med',
  proveVurdering: 'Prøve / vurdering',
  ressurser: 'Ressurser',
  ekstraBeskjed: 'Ekstra beskjed',
}

export const OVERLAY_SECTION_KEYS: OverlaySectionKey[] = [
  'iTimen',
  'lekse',
  'huskTaMed',
  'proveVurdering',
  'ressurser',
  'ekstraBeskjed',
]

/** Seksjoner (I timen / Lekse / …) med ikke-tomme linjer, i fast rekkefølge, for read-only-visning. */
export function sectionsForReadOnly(
  sections: Record<string, string[]> | undefined
): Array<{ key: OverlaySectionKey; lines: string[] }> {
  const out: Array<{ key: OverlaySectionKey; lines: string[] }> = []
  for (const key of OVERLAY_SECTION_KEYS) {
    const lines = (sections?.[key] ?? []).filter((line) => line.trim().length > 0)
    if (lines.length > 0) out.push({ key, lines })
  }
  return out
}

/** Én skole-time-rad (start/slutt/etikett) + valgfri lesson-referanse for overlay-matching. */
export type SchoolTimeRow = {
  start: string
  end: string
  label: string
  lesson?: SchoolLessonSlot
}

/**
 * Bygger skole-time-rader fra en dagsplan — uttrekk av kjernen i BackgroundDetailSheet.buildSchoolRows,
 * uavhengig av person/dateKey så previewen kan bruke den mot barnets lagrede timeplan (weekdays[wd]).
 * useSimpleDay / ingen lessons → én «Skole»-rad uten lesson (som kalenderen).
 */
export function buildSchoolRowsForPlan(
  gradeBand: NorwegianGradeBand,
  plan: ChildSchoolDayPlan | undefined
): SchoolTimeRow[] {
  if (!plan?.lessons?.length || plan.useSimpleDay) {
    return [{ start: plan?.schoolStart ?? '08:15', end: plan?.schoolEnd ?? '14:30', label: 'Skole' }]
  }
  const lessons = [...plan.lessons].sort((a, b) => a.start.localeCompare(b.start))
  return lessons.map((L) => ({
    start: L.start,
    end: L.end,
    label: subjectLabelForKey(gradeBand, L.subjectKey, L.customLabel, L.lessonSubcategory),
    lesson: L,
  }))
}
