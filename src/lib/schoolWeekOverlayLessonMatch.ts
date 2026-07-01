import type { SchoolLessonSlot, SchoolWeekOverlaySubjectUpdate } from '../types'
import { resolveSubjectKey } from './schoolContext'

/**
 * Fiks 2: normaliser en subjectKey for matching mellom uke-overlay og lagret timeplan.
 *
 * Overlayen lagrer subjectKey RÅTT fra serveren (parseOverlaySubjectUpdate → asString,
 * f.eks. «Naturfag»), mens lesson leser NORMALISERT (parseLessonSlot → resolveSubjectKey,
 * f.eks. «naturfag»). Streng likhet ga derfor aldri match. Vi normaliserer BEGGE sider
 * likt her — samme normalisering lesson bruker (resolveSubjectKey), med case-insensitiv
 * trim som fallback for ukjente fag. Dekker også allerede-lagrede overlays uten re-import.
 */
export function normalizeSubjectKeyForMatch(subjectKey: string): string {
  return resolveSubjectKey(subjectKey).subjectKey ?? subjectKey.trim().toLocaleLowerCase('nb-NO')
}

/**
 * Overlay-subjectUpdates som hører til en gitt lagret time (matches på normalisert
 * subjectKey, + valgfri customLabel). Tom liste når `lesson` er udefinert.
 */
export function overlayUpdatesForLesson(
  lesson: SchoolLessonSlot | undefined,
  updates: SchoolWeekOverlaySubjectUpdate[]
): Array<{ update: SchoolWeekOverlaySubjectUpdate; updateIndex: number }> {
  if (!lesson) return []
  const lessonCustom = (lesson.customLabel ?? lesson.lessonSubcategory ?? '')
    .trim()
    .toLocaleLowerCase('nb-NO')
  const lessonKey = normalizeSubjectKeyForMatch(lesson.subjectKey)
  return updates
    .map((u, idx) => ({ update: u, updateIndex: idx }))
    .filter(({ update: u }) => {
      // Fiks 2: normaliser begge sider (symmetrisk) før sammenligning.
      if (normalizeSubjectKeyForMatch(u.subjectKey) !== lessonKey) return false
      const custom = (u.customLabel ?? '').trim().toLocaleLowerCase('nb-NO')
      if (!custom || !lessonCustom) return true
      return custom === lessonCustom
    })
}

/** Overlay-subjectUpdates som IKKE matcher noen lagret time (vises i fallback-seksjonen). */
export function overlaySubjectUpdatesUnmatchedByLessons(
  updates: SchoolWeekOverlaySubjectUpdate[],
  lessons: SchoolLessonSlot[]
): SchoolWeekOverlaySubjectUpdate[] {
  if (lessons.length === 0) return updates
  return updates.filter((u) => !lessons.some((L) => overlayUpdatesForLesson(L, [u]).length > 0))
}
