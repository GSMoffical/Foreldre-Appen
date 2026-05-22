/**
 * Strenge policy-invariants for Høstcup duration-matrisen.
 * Tider fra fixtures/tankestrom/hostcup_original (17:30/18:15, 08:20/09:00, …).
 */
import type { HostcupDayDurationSnapshot, HostcupVariantRunResult } from './hostcupDurationInferenceHarness'
import type { HostcupSegmentMutationKind } from './hostcupSegmentMutations'

export type HostcupDurationPolicyFailure = {
  caseId: string
  textVariantId: string
  segmentMutation: HostcupSegmentMutationKind
  date?: string
  code: string
  message: string
  expected?: string
  actual?: string
  detail?: Record<string, unknown>
}

/** Kjente policy-brudd — tom når produksjonsfix er på plass; strict feiler hvis noe gjenstår her. */
export const HOSTCUP_DURATION_KNOWN_FAILURES: Array<{
  caseIdSuffix: string
  code: string
  label: string
}> = []

/** Tider fra andre dager som ikke skal bekreftes på foreløpig søndag uten kilde. */
export const HOSTCUP_CROSS_DAY_PROGRAM_TIMES = [
  '17:30',
  '18:15',
  '08:20',
  '09:00',
  '13:55',
  '14:40',
  '17:45',
  '16:40',
  '08:30',
  '09:15',
] as const

export const HOSTCUP_FRI_DATE = '2026-09-18'
export const HOSTCUP_LOR_DATE = '2026-09-19'
export const HOSTCUP_SON_DATE = '2026-09-20'

/** Kanoniske tider fra hostcup_original (fixture). */
export const HOSTCUP_BASELINE_FRIDAY = {
  oppmote: '17:30',
  kamp: '18:15',
  segmentEnd: '19:00',
} as const

export const HOSTCUP_BASELINE_SATURDAY = {
  oppmote1: '08:20',
  kamp1: '09:00',
  oppmote2: '13:55',
  kamp2: '14:40',
} as const

const KAMP = /\bkamp|første|andre|match\b/i
const OPPMOTE = /\boppm[øo]te\b|\bm[øo]tes?\b/i
const HM = /\b([01]?\d|2[0-3]):[0-5]\d\b/

function extractDaySection(source: string, dayHeader: string, nextHeader: string | null): string {
  const start = source.indexOf(dayHeader)
  if (start < 0) return ''
  const end = nextHeader ? source.indexOf(nextHeader, start + dayHeader.length) : source.length
  return end < 0 ? source.slice(start) : source.slice(start, end)
}

export function sundaySectionHasExplicitProgramTime(source: string): boolean {
  const section = extractDaySection(source, 'Søndag 20. september', 'Husk / ta med:')
  if (!section.trim()) return false
  if (/foreløpig|ikke endelig|avhenger av|tidspunkt.*ikke/i.test(section) && !/\bkl\.?\s*\d{1,2}:\d{2}\b/i.test(section)) {
    return false
  }
  return HM.test(section)
}

export function sourceHasDeadline8Sept2100(source: string): boolean {
  return /8\.\s*september/i.test(source) && /\b21:00\b/.test(source)
}

function highlightAt(day: HostcupDayDurationSnapshot, time: string): string | undefined {
  return day.canonicalHighlights.find((l) => l.startsWith(`${time} `))
}

function timesInHighlights(day: HostcupDayDurationSnapshot): string[] {
  return day.canonicalHighlights.map((l) => l.slice(0, 5)).filter((t) => /^\d{2}:\d{2}$/.test(t))
}

function push(
  out: HostcupDurationPolicyFailure[],
  result: HostcupVariantRunResult,
  day: HostcupDayDurationSnapshot | undefined,
  code: string,
  message: string,
  extra?: Pick<HostcupDurationPolicyFailure, 'expected' | 'actual' | 'detail'>
): void {
  out.push({
    caseId: result.caseId,
    textVariantId: result.textVariantId,
    segmentMutation: result.segmentMutation,
    date: day?.date,
    code,
    message,
    ...extra,
  })
}

function assertBaselineFriday(
  result: HostcupVariantRunResult,
  fri: HostcupDayDurationSnapshot,
  failures: HostcupDurationPolicyFailure[]
): void {
  const h1730 = highlightAt(fri, HOSTCUP_BASELINE_FRIDAY.oppmote)
  const h1815 = highlightAt(fri, HOSTCUP_BASELINE_FRIDAY.kamp)
  if (!h1730 || !OPPMOTE.test(h1730)) {
    push(failures, result, fri, 'policy_fri_1730_oppmote', 'Fredag mangler 17:30 Oppmøte i canonical highlights', {
      expected: `${HOSTCUP_BASELINE_FRIDAY.oppmote} Oppmøte`,
      actual: fri.canonicalHighlights.join('; '),
    })
  }
  if (!h1815 || !KAMP.test(h1815)) {
    push(failures, result, fri, 'policy_fri_1815_kamp', 'Fredag mangler 18:15 Første kamp i canonical highlights', {
      expected: `${HOSTCUP_BASELINE_FRIDAY.kamp} Første kamp`,
      actual: fri.canonicalHighlights.join('; '),
    })
  }
  if (fri.canonicalDisplayTime !== HOSTCUP_BASELINE_FRIDAY.oppmote) {
    push(failures, result, fri, 'policy_fri_display_time', 'Fredag displayTime skal være tidligste programtid (17:30)', {
      expected: HOSTCUP_BASELINE_FRIDAY.oppmote,
      actual: fri.canonicalDisplayTime ?? 'null',
    })
  }
  if (fri.selected && fri.draftStart && !fri.draftEnd) {
    push(failures, result, fri, 'policy_fri_missing_draft_end', 'Fredag med start skal ha slutt (inferred eller eksplisitt)', {
      actual: `start=${fri.draftStart} end=`,
    })
  }
  if (fri.selected && fri.validationBlockers.includes('missing_end_time')) {
    push(failures, result, fri, 'policy_fri_missing_end_blocker', 'Fredag med start skal ikke ha missing_end_time-blokker', {
      actual: fri.validationBlockers.join(', '),
    })
  }
  if (fri.selected && fri.draftStart) {
    const end = fri.draftEnd || fri.exportResolvedEnd
    if (!end || end <= fri.draftStart) {
      push(failures, result, fri, 'policy_fri_inferred_end', 'Fredag skal ha inferred slutt etter start', {
        expected: `> ${fri.draftStart}`,
        actual: end || '(tom)',
      })
    }
  }
}

function assertBaselineSaturday(
  result: HostcupVariantRunResult,
  lor: HostcupDayDurationSnapshot,
  failures: HostcupDurationPolicyFailure[]
): void {
  const b = HOSTCUP_BASELINE_SATURDAY
  for (const [code, time, labelRe] of [
    ['policy_lor_0820', b.oppmote1, /oppm|første/i],
    ['policy_lor_0900', b.kamp1, KAMP],
    ['policy_lor_1355', b.oppmote2, /oppm|andre/i],
    ['policy_lor_1440', b.kamp2, /andre|kamp/i],
  ] as const) {
    const line = highlightAt(lor, time)
    if (!line || !labelRe.test(line)) {
      push(failures, result, lor, code, `Lørdag mangler ${time} forventet highlight`, {
        actual: lor.canonicalHighlights.join('; '),
      })
    }
  }
  if (lor.canonicalDisplayTime !== b.oppmote1) {
    push(failures, result, lor, 'policy_lor_display_time', 'Lørdag displayTime skal være 08:20', {
      expected: b.oppmote1,
      actual: lor.canonicalDisplayTime ?? 'null',
    })
  }
  const friTimesOnLor = lor.canonicalHighlights.filter((l) =>
    l.startsWith('17:30 ') || l.startsWith('18:15 ')
  )
  if (friTimesOnLor.length > 0) {
    push(failures, result, lor, 'policy_lor_no_fredag_times', 'Lørdag skal ikke inneholde fredagens programtider', {
      actual: friTimesOnLor.join('; '),
    })
  }
  if (lor.selected && lor.validationBlockers.includes('missing_end_time')) {
    push(failures, result, lor, 'policy_lor_missing_end_blocker', 'Lørdag med start skal ikke ha missing_end_time-blokker', {
      actual: lor.validationBlockers.join(', '),
    })
  }
}

function assertSundayPolicy(
  result: HostcupVariantRunResult,
  son: HostcupDayDurationSnapshot,
  source: string,
  failures: HostcupDurationPolicyFailure[]
): void {
  const explicitInSource = sundaySectionHasExplicitProgramTime(source)
  const preliminary = son.isConditional && !explicitInSource

  if (preliminary) {
    if (son.selected) {
      push(failures, result, son, 'policy_sunday_preliminary_not_selected', 'Foreløpig søndag uten bekreftet tid skal ikke forhåndsvelges', {
        actual: `selected=true displayTime=${son.canonicalDisplayTime ?? 'null'}`,
      })
    }
    if (son.canonicalDisplayTime && HOSTCUP_CROSS_DAY_PROGRAM_TIMES.includes(son.canonicalDisplayTime as (typeof HOSTCUP_CROSS_DAY_PROGRAM_TIMES)[number])) {
      push(
        failures,
        result,
        son,
        'policy_sunday_preliminary_no_cross_day_display',
        'Foreløpig søndag skal ikke få confirmed displayTime fra andre dager',
        { actual: son.canonicalDisplayTime }
      )
    }
    const leaked = timesInHighlights(son).filter((t) =>
      (HOSTCUP_CROSS_DAY_PROGRAM_TIMES as readonly string[]).includes(t)
    )
    if (leaked.length > 0 && !explicitInSource) {
      push(failures, result, son, 'policy_sunday_preliminary_no_program_highlights', 'Foreløpig søndag skal ikke ha program-highlights fra andre dager', {
        actual: son.canonicalHighlights.join('; '),
      })
    }
  }

  if (result.segmentMutation === 'son_leak_fri_1730') {
    const leakedFredagDisplay = son.canonicalDisplayTime === '17:30'
    const leakedFredagHighlights = timesInHighlights(son).includes('17:30')
    if (leakedFredagDisplay) {
      push(failures, result, son, 'policy_sunday_leaked_fredag_no_display', 'son_leak_fri_1730: søndag skal ikke vise 17:30 som displayTime', {
        expected: 'null eller søndagskilde',
        actual: '17:30',
      })
    }
    if (son.selected && (leakedFredagDisplay || (leakedFredagHighlights && !explicitInSource))) {
      push(failures, result, son, 'policy_sunday_leaked_fredag_not_selectable', 'son_leak_fri_1730: søndag skal ikke velges pga. lekket fredag 17:30', {
        actual: `selected=true displayTime=${son.canonicalDisplayTime ?? 'null'}`,
      })
    }
  }
}

function assertDeadlineNotInProgram(
  result: HostcupVariantRunResult,
  source: string,
  failures: HostcupDurationPolicyFailure[]
): void {
  if (!sourceHasDeadline8Sept2100(source)) return
  for (const day of result.days) {
    if (day.canonicalHighlights.some((l) => l.startsWith('21:00 '))) {
      push(failures, result, day, 'policy_deadline_in_program_highlights', '8. sept 21:00 skal ikke være program-highlight', {
        actual: day.canonicalHighlights.join('; '),
      })
    }
    if (day.date === '2026-09-08') {
      push(failures, result, day, 'policy_deadline_wrong_day_row', 'Frist 8. september skal ikke være egen programdag-rad', {
        actual: day.displayTitle,
      })
    }
  }
}

/** Om vi forventer baseline-exact (canonical fixture + originaltekst). */
function expectsBaselineSchedule(result: HostcupVariantRunResult, source: string): boolean {
  if (result.segmentMutation !== 'noop') return false
  if (result.textVariantId !== 'baseline') return false
  return source.includes('17:30') && source.includes('18:15') && source.includes('08:20')
}

export function policyFailuresForHostcupCase(
  result: HostcupVariantRunResult,
  source: string
): HostcupDurationPolicyFailure[] {
  const failures: HostcupDurationPolicyFailure[] = []
  const fri = result.days.find((d) => d.date === HOSTCUP_FRI_DATE)
  const lor = result.days.find((d) => d.date === HOSTCUP_LOR_DATE)
  const son = result.days.find((d) => d.date === HOSTCUP_SON_DATE)

  if (expectsBaselineSchedule(result, source) && fri && lor) {
    assertBaselineFriday(result, fri, failures)
    assertBaselineSaturday(result, lor, failures)
  }

  if (son) assertSundayPolicy(result, son, source, failures)
  assertDeadlineNotInProgram(result, source, failures)

  return failures
}

export type HostcupDurationPolicySummary = {
  totalCases: number
  passedCases: number
  failedCases: number
  knownFailures: number
  knownFailureRemains: number
  /** Legacy: selected+displayed leaks on son_leak mutation */
  sundayLeakCount: number
  missingEndHardBlockerCount: number
  startWithoutEndAllowedCount: number
  inferredEndCount: number
  deadlineMixedIntoProgramCount: number
}

export function isKnownPolicyCaseId(caseId: string): boolean {
  return HOSTCUP_DURATION_KNOWN_FAILURES.some((k) => caseId.endsWith(k.caseIdSuffix))
}

export function summarizePolicyResults(
  cases: HostcupVariantRunResult[],
  allFailures: HostcupDurationPolicyFailure[]
): HostcupDurationPolicySummary {
  const failedCaseIds = new Set(allFailures.map((f) => f.caseId))
  let sundayLeakCount = 0
  let missingEndHardBlockerCount = 0
  let startWithoutEndAllowedCount = 0
  let inferredEndCount = 0
  let deadlineMixedIntoProgramCount = 0

  for (const c of cases) {
    for (const d of c.days) {
      if (c.segmentMutation === 'son_leak_fri_1730' && d.date === HOSTCUP_SON_DATE) {
        const crossDayTimes = HOSTCUP_CROSS_DAY_PROGRAM_TIMES as readonly string[]
        const displayedCrossDay =
          d.canonicalDisplayTime != null && crossDayTimes.includes(d.canonicalDisplayTime)
        const highlightedCrossDay = timesInHighlights(d).some((t) => crossDayTimes.includes(t))
        if (displayedCrossDay || (d.selected && highlightedCrossDay)) {
          sundayLeakCount += 1
        }
      }
      if (d.selected && d.validationBlockers.includes('missing_end_time')) {
        missingEndHardBlockerCount += 1
      }
      if (d.selected && d.draftHasStartWithoutEnd) {
        startWithoutEndAllowedCount += 1
      }
      if (
        d.selected &&
        d.draftStart &&
        (d.draftEnd || d.exportResolvedEnd) &&
        (d.usesSyntheticLayoutEnd || d.draftUsesSyntheticLayoutEnd || d.exportPolicy.includes('conservative'))
      ) {
        inferredEndCount += 1
      }
    }
    if (allFailures.some((f) => f.caseId === c.caseId && f.code.startsWith('policy_deadline_'))) {
      deadlineMixedIntoProgramCount += 1
    }
  }

  const knownCaseIds = new Set(allFailures.filter((f) => isKnownPolicyCaseId(f.caseId)).map((f) => f.caseId))
  const knownFailureRemains = knownCaseIds.size
  const knownFailures = knownCaseIds.size

  return {
    totalCases: cases.length,
    passedCases: cases.length - failedCaseIds.size,
    failedCases: failedCaseIds.size,
    knownFailures,
    knownFailureRemains,
    sundayLeakCount,
    missingEndHardBlockerCount,
    startWithoutEndAllowedCount,
    inferredEndCount,
    deadlineMixedIntoProgramCount,
  }
}

export function partitionPolicyFailures(allFailures: HostcupDurationPolicyFailure[]): {
  unexpected: HostcupDurationPolicyFailure[]
  knownStillFailing: HostcupDurationPolicyFailure[]
} {
  const knownStillFailing: HostcupDurationPolicyFailure[] = []
  const unexpected: HostcupDurationPolicyFailure[] = []
  for (const f of allFailures) {
    if (isKnownPolicyCaseId(f.caseId)) knownStillFailing.push(f)
    else unexpected.push(f)
  }
  return { unexpected, knownStillFailing }
}

export function formatStrictPolicyErrorMessage(
  unexpected: HostcupDurationPolicyFailure[],
  knownStillFailing: HostcupDurationPolicyFailure[]
): string {
  const lines: string[] = []
  const knownCaseIds = [...new Set(knownStillFailing.map((f) => f.caseId))].sort()
  const label = HOSTCUP_DURATION_KNOWN_FAILURES[0]?.label ?? 'policy breach'
  if (knownCaseIds.length > 0) {
    lines.push(`known failure remains: ${label} (${knownCaseIds.length} cases)`)
    for (const id of knownCaseIds.slice(0, 6)) {
      const codes = [...new Set(knownStillFailing.filter((f) => f.caseId === id).map((f) => f.code))]
      lines.push(`  - ${id}: ${codes.join(', ')}`)
    }
    if (knownCaseIds.length > 6) lines.push(`  … +${knownCaseIds.length - 6} more`)
  }
  for (const f of unexpected.slice(0, 8)) {
    lines.push(`${f.caseId} [${f.code}] ${f.message}`)
  }
  if (unexpected.length > 8) lines.push(`… +${unexpected.length - 8} unexpected`)
  return lines.join('\n')
}
