/**
 * Oppdager overlappende skoletimer i en `ChildSchoolProfile` (typisk parallelle spor: D1/D2, språkvalg).
 * Brukes kun i Tankestrøm-review for fast timeplan — ikke A-plan eller dag-overrides.
 */
import type { ChildSchoolProfile, NorwegianGradeBand, SchoolLessonSlot, WeekdayMonFri } from '../types'
import { subjectLabelForKey } from '../data/norwegianSubjects'

export interface LessonConflictGroup {
  weekday: WeekdayMonFri
  /** Min start og max slutt i gruppen (for overskrift) */
  displayStart: string
  displayEnd: string
  /** Alternative timer brukeren må velge én av */
  candidates: SchoolLessonSlot[]
}

/** Stabil nøkkel for én konfliktgruppe (React key, logging). */
export function lessonConflictGroupId(g: LessonConflictGroup): string {
  return `${g.weekday}:${g.candidates.map(lessonFingerprint).sort().join('¦')}`
}

export function lessonFingerprint(l: SchoolLessonSlot): string {
  return `${l.start}|${l.end}|${l.subjectKey}|${(l.customLabel ?? '').trim()}`
}

function minTime(a: string, b: string): string {
  return a <= b ? a : b
}

function maxTime(a: string, b: string): string {
  return a >= b ? a : b
}

/**
 * Finn klynger av overlappende timer på én ukedag (transitiv overlapp).
 * Forutsetter at `lessons` er sortert på start.
 */
function clusterOverlappingLessons(lessons: SchoolLessonSlot[]): SchoolLessonSlot[][] {
  if (lessons.length < 2) return []
  const sorted = [...lessons].sort((a, b) => a.start.localeCompare(b.start))
  const clusters: SchoolLessonSlot[][] = []
  let cluster: SchoolLessonSlot[] = [sorted[0]!]
  let clusterMaxEnd = sorted[0]!.end

  for (let i = 1; i < sorted.length; i++) {
    const L = sorted[i]!
    // Sortert på start: ny time tilhører klynga hvis den starter før forrige klynges slutt (ekte overlapp eller «inne i»).
    if (L.start < clusterMaxEnd) {
      cluster.push(L)
      clusterMaxEnd = maxTime(clusterMaxEnd, L.end)
    } else {
      if (cluster.length > 1) clusters.push(cluster)
      cluster = [L]
      clusterMaxEnd = L.end
    }
  }
  if (cluster.length > 1) clusters.push(cluster)
  return clusters
}

/**
 * Alle konfliktgrupper (minst to overlappende timer) i profilen.
 */
export function detectLessonConflicts(profile: ChildSchoolProfile): LessonConflictGroup[] {
  const out: LessonConflictGroup[] = []
  for (let wd = 0; wd <= 4; wd++) {
    const plan = profile.weekdays[wd as WeekdayMonFri]
    if (!plan || plan.useSimpleDay || !plan.lessons?.length) continue
    const groups = clusterOverlappingLessons(plan.lessons)
    for (const candidates of groups) {
      let displayStart = candidates[0]!.start
      let displayEnd = candidates[0]!.end
      for (const c of candidates) {
        displayStart = minTime(displayStart, c.start)
        displayEnd = maxTime(displayEnd, c.end)
      }
      out.push({
        weekday: wd as WeekdayMonFri,
        displayStart,
        displayEnd,
        candidates,
      })
    }
  }
  return out
}

export function lessonDisplayLabel(band: NorwegianGradeBand, l: SchoolLessonSlot): string {
  return subjectLabelForKey(band, l.subjectKey, l.customLabel)
}

/**
 * Erstatter alle kandidater i gruppen med én valgt `SchoolLessonSlot`, på plass til første kandidat i listen.
 */
export function applyLessonConflictChoice(
  profile: ChildSchoolProfile,
  group: LessonConflictGroup,
  choiceIndex: number
): ChildSchoolProfile {
  const chosen = group.candidates[choiceIndex]
  if (!chosen) return profile
  const wd = group.weekday
  const plan = profile.weekdays[wd]
  if (!plan?.lessons) return profile

  const drop = new Set(group.candidates.map(lessonFingerprint))
  const firstIdx = plan.lessons.findIndex((l) => drop.has(lessonFingerprint(l)))
  const filtered = plan.lessons.filter((l) => !drop.has(lessonFingerprint(l)))
  const insertAt = firstIdx < 0 ? filtered.length : Math.min(firstIdx, filtered.length)
  const newLessons = [...filtered.slice(0, insertAt), { ...chosen }, ...filtered.slice(insertAt)]

  return {
    ...profile,
    weekdays: {
      ...profile.weekdays,
      [wd]: { ...plan, useSimpleDay: false, lessons: newLessons },
    },
  }
}
