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
 * Forenkler en dag til start/slutt. Detaljerte timeplaner (lessons) reduseres til tidligste start
 * og seneste slutt — vi importerer ikke fag/rom/lærer i denne versjonen.
 */
function simplifyDay(plan: ChildSchoolDayPlan): { start?: string; end?: string; simplified: boolean } {
  if (plan.useSimpleDay || !plan.lessons || plan.lessons.length === 0) {
    return { start: plan.schoolStart, end: plan.schoolEnd, simplified: false }
  }
  const starts = plan.lessons.map((l) => l.start).filter((s): s is string => !!s).sort()
  const ends = plan.lessons.map((l) => l.end).filter((s): s is string => !!s).sort()
  return { start: starts[0], end: ends[ends.length - 1], simplified: true }
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
  let anySimplified = false
  let anyMissingTime = false

  for (const wd of WEEKDAYS) {
    const plan = source.weekdays[wd]
    if (!plan) continue
    const { start, end, simplified } = simplifyDay(plan)
    if (simplified) anySimplified = true
    if (!start || !end) anyMissingTime = true
    weekdays[wd] = { useSimpleDay: true, schoolStart: start, schoolEnd: end }
    days.push({ weekday: wd, label: WEEKDAY_LABELS[wd], startTime: start, endTime: end })
  }

  // Ingen tolkbare skoledager → ikke nok struktur.
  if (days.length === 0) return null

  const warnings: string[] = []
  if (anySimplified) warnings.push('Detaljert timeplan ble forenklet til start- og sluttid.')
  if (anyMissingTime) warnings.push('Noen dager mangler tydelig start-/sluttid — sjekk dem manuelt.')

  return {
    profile: { gradeBand: source.gradeBand, weekdays },
    days,
    confidence: confidenceLabel(primary.confidence),
    warnings,
  }
}
