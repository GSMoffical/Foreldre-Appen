import type { ChildSchoolProfile, NorwegianGradeBand, SchoolLessonSlot, WeekdayMonFri } from '../types'
import { DEFAULT_SCHOOL_GATE_BY_BAND, SUBJECTS_BY_BAND } from '../data/norwegianSubjects'
import { shiftTime } from './time'

/**
 * Delt redigeringslogikk for skoletimer (lessons) på en `ChildSchoolProfile`.
 *
 * Rene funksjoner — tar en profil, returnerer en ny profil (muterer ikke input). Brukes BÅDE av den
 * fulle editoren (`SchoolProfileFields`) og av det kompakte forslags-panelet
 * (`TimetableSuggestionLessons`), slik at de to flatene aldri divergerer på «neste time foreslås fra
 * forrige sluttid»-semantikken. Standardvarighet og default-fag/-tider avledes fra `profile.gradeBand`,
 * akkurat som i den fulle editoren.
 */

/** Standard timelengde: 45 min på videregående, ellers 60 min (LK20-grunnskole). */
export function defaultLessonMinutesForBand(band: NorwegianGradeBand): number {
  return band.startsWith('vg') ? 45 : 60
}

/**
 * Oppdater én time. Når sluttid settes, foreslås neste times starttid fra den (samme flyt-semantikk
 * som den fulle editoren). Ugyldig indeks → profilen returneres uendret (samme referanse).
 */
export function updateLessonInProfile(
  profile: ChildSchoolProfile,
  wd: WeekdayMonFri,
  index: number,
  patch: Partial<SchoolLessonSlot>
): ChildSchoolProfile {
  const cur = profile.weekdays[wd]
  const lessons = (cur?.lessons ?? []).map((L) => ({ ...L }))
  if (!lessons[index]) return profile
  lessons[index] = { ...lessons[index]!, ...patch }
  // Hold flyten rask: når en sluttid velges, foreslå neste starttid fra den.
  if (patch.end && lessons[index + 1]) {
    lessons[index + 1] = { ...lessons[index + 1]!, start: patch.end }
  }
  return {
    ...profile,
    weekdays: { ...profile.weekdays, [wd]: { useSimpleDay: false, lessons } },
  }
}

/**
 * Legg til en ny time sist på dagen. Starttid = forrige times sluttid (ev. dagens schoolStart eller
 * trinnets standard-gate-start), sluttid = start + standardvarighet. Default-fag = trinnets første fag.
 */
export function addLessonToProfile(profile: ChildSchoolProfile, wd: WeekdayMonFri): ChildSchoolProfile {
  const band = profile.gradeBand
  const cur = profile.weekdays[wd]
  const existing = cur?.lessons ?? []
  const previous = existing[existing.length - 1]
  const gates = DEFAULT_SCHOOL_GATE_BY_BAND[band]
  const start = previous?.end ?? cur?.schoolStart ?? gates.start
  const lessons: SchoolLessonSlot[] = [
    ...existing,
    {
      subjectKey: SUBJECTS_BY_BAND[band][0]?.key ?? 'norsk',
      start,
      end: shiftTime(start, defaultLessonMinutesForBand(band)),
    },
  ]
  return {
    ...profile,
    weekdays: { ...profile.weekdays, [wd]: { useSimpleDay: false, lessons } },
  }
}

/**
 * Fjern time `index` fra dagen. Tom liste etter fjerning → `lessons: undefined` (dagen beholder
 * `useSimpleDay: false`, men uten timer), identisk med den fulle editoren.
 */
export function removeLessonFromProfile(
  profile: ChildSchoolProfile,
  wd: WeekdayMonFri,
  index: number
): ChildSchoolProfile {
  const cur = profile.weekdays[wd]
  const lessons = (cur?.lessons ?? []).filter((_, i) => i !== index)
  return {
    ...profile,
    weekdays: {
      ...profile.weekdays,
      [wd]: { useSimpleDay: false, lessons: lessons.length ? lessons : undefined },
    },
  }
}
