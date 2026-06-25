import type { ChildSchoolDayPlan, ChildSchoolProfile, WeekdayMonFri } from '../types'
import type {
  PortalImportProposalBundle,
  PortalSchoolProfileProposal,
} from '../features/tankestrom/types'

export type TimetableImportConfidence = 'low' | 'medium' | 'high'

export type TimetableSuggestionDay = {
  weekday: WeekdayMonFri
  label: string
  startTime?: string
  endTime?: string
  /** Antall fag/timer når dagen har detaljert timeplan (vises i forhåndsvisningen). */
  lessonCount?: number
}

export type TimetableSuggestion = {
  /** Forslag i appens egen timeplanform — klart til å settes direkte i wizard-state. */
  profile: ChildSchoolProfile
  /** Forenklet dagsliste for visning i forslagspanelet. */
  days: TimetableSuggestionDay[]
  confidence: TimetableImportConfidence
  warnings: string[]
}

const WEEKDAY_LABELS: Record<WeekdayMonFri, string> = {
  0: 'Mandag',
  1: 'Tirsdag',
  2: 'Onsdag',
  3: 'Torsdag',
  4: 'Fredag',
}
const WEEKDAYS: WeekdayMonFri[] = [0, 1, 2, 3, 4]

/**
 * Dag-spennet brukt i forhåndsvisningen: avledet fra lessons (tidligste start / seneste slutt)
 * når dagen har detaljert timeplan, ellers fra schoolStart/schoolEnd. Endrer ikke selve planen —
 * fag/timer bevares uavkortet i profilen som lagres.
 */
function dayDisplayRange(plan: ChildSchoolDayPlan): { start?: string; end?: string } {
  if (!plan.useSimpleDay && plan.lessons && plan.lessons.length > 0) {
    const starts = plan.lessons.map((l) => l.start).filter((s): s is string => !!s).sort()
    const ends = plan.lessons.map((l) => l.end).filter((s): s is string => !!s).sort()
    return { start: starts[0], end: ends[ends.length - 1] }
  }
  return { start: plan.schoolStart, end: plan.schoolEnd }
}

function confidenceLabel(value: number): TimetableImportConfidence {
  if (value >= 0.66) return 'high'
  if (value >= 0.4) return 'medium'
  return 'low'
}

/**
 * Bygger et timeplanforslag fra en analyse-bundle. Bruker KUN strukturerte `school_profile`-forslag
 * (samme form som `ChildSchoolProfile`) — gjetter ikke timeplan fra løse hendelser. Returnerer
 * `null` når bildet ikke gir nok struktur, så UI kan falle tilbake til manuell redigering.
 */
export function buildTimetableSuggestionFromBundle(
  bundle: PortalImportProposalBundle
): TimetableSuggestion | null {
  const schoolItems = bundle.items.filter(
    (i): i is PortalSchoolProfileProposal => i.kind === 'school_profile'
  )
  if (schoolItems.length === 0) return null
  const primary = schoolItems[0]!
  const source = primary.schoolProfile

  const weekdays: ChildSchoolProfile['weekdays'] = {}
  const days: TimetableSuggestionDay[] = []
  let anyMissingTime = false

  for (const wd of WEEKDAYS) {
    const plan = source.weekdays[wd]
    if (!plan) continue
    const hasLessons = !plan.useSimpleDay && !!plan.lessons?.length
    const { start, end } = dayDisplayRange(plan)
    if (!start || !end) anyMissingTime = true
    if (hasLessons) {
      // Bevar fag/timer — detaljvisningen for «Skole»-blokken viser dem som egne fag-rader.
      weekdays[wd] = { useSimpleDay: false, lessons: [...plan.lessons!] }
    } else {
      weekdays[wd] = { useSimpleDay: true, schoolStart: start, schoolEnd: end }
    }
    const day: TimetableSuggestionDay = { weekday: wd, label: WEEKDAY_LABELS[wd], startTime: start, endTime: end }
    if (hasLessons) day.lessonCount = plan.lessons!.length
    days.push(day)
  }

  // Ingen tolkbare skoledager → ikke nok struktur.
  if (days.length === 0) return null

  const warnings: string[] = []
  if (anyMissingTime) warnings.push('Noen dager mangler tydelig start-/sluttid — sjekk dem manuelt.')

  return {
    profile: { gradeBand: source.gradeBand, weekdays },
    days,
    confidence: confidenceLabel(primary.confidence),
    warnings,
  }
}

const CONFIDENCE_RANK: Record<TimetableImportConfidence, number> = { low: 0, medium: 1, high: 2 }
const CONFIDENCE_BY_RANK: TimetableImportConfidence[] = ['low', 'medium', 'high']

function dayTimeLabel(plan: ChildSchoolDayPlan): string {
  const { start, end } = dayDisplayRange(plan)
  return start && end ? `${start}–${end}` : 'ukjent tid'
}

/**
 * Slår sammen flere timeplanforslag (ett per fil) til ett. Konservativt:
 *  - `gradeBand` fra første forslag,
 *  - ukedager slås sammen; samme dag med ulike tider → behold første + konfliktadvarsel,
 *  - warnings slås sammen (deduplisert),
 *  - confidence blir laveste blant forslagene.
 * Forutsetter minst ett forslag (kaller filtrerer bort filer uten forslag først).
 */
export function mergeTimetableSuggestions(suggestions: TimetableSuggestion[]): TimetableSuggestion {
  if (suggestions.length === 1) return suggestions[0]!

  const gradeBand = suggestions[0]!.profile.gradeBand
  const weekdays: ChildSchoolProfile['weekdays'] = {}
  const warnings: string[] = []
  const seen = new Set<string>()
  const pushWarning = (w: string) => {
    if (!seen.has(w)) {
      seen.add(w)
      warnings.push(w)
    }
  }
  for (const s of suggestions) for (const w of s.warnings) pushWarning(w)

  let minRank = CONFIDENCE_RANK.high
  for (const s of suggestions) minRank = Math.min(minRank, CONFIDENCE_RANK[s.confidence])

  for (const wd of WEEKDAYS) {
    for (const s of suggestions) {
      const plan = s.profile.weekdays[wd]
      if (!plan) continue
      const existing = weekdays[wd]
      if (!existing) {
        weekdays[wd] = plan
      } else {
        const a = dayDisplayRange(existing)
        const b = dayDisplayRange(plan)
        if (a.start !== b.start || a.end !== b.end) {
          pushWarning(
            `Ulike tider for ${WEEKDAY_LABELS[wd]} i flere filer — beholdt ${dayTimeLabel(existing)}.`
          )
        }
      }
    }
  }

  const days: TimetableSuggestionDay[] = WEEKDAYS.filter((wd) => weekdays[wd]).map((wd) => {
    const plan = weekdays[wd]!
    const { start, end } = dayDisplayRange(plan)
    const day: TimetableSuggestionDay = { weekday: wd, label: WEEKDAY_LABELS[wd], startTime: start, endTime: end }
    if (!plan.useSimpleDay && plan.lessons?.length) day.lessonCount = plan.lessons.length
    return day
  })

  return { profile: { gradeBand, weekdays }, days, confidence: CONFIDENCE_BY_RANK[minRank]!, warnings }
}
