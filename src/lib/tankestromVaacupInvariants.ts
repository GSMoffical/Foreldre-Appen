/**
 * Harde invariants for Vårcupen-fixturen (`vaacup_original`).
 *
 * Disse reglene speiler kildeteksten i `e2e/fixtures/vaacup-original.txt`:
 *   Fredag  17:45 oppmøte / 18:40 første kamp
 *   Lørdag  08:35 oppmøte før første kamp / 09:20 første kamp /
 *           14:25 oppmøte før andre kamp  / 15:10 andre kamp
 *   Søndag  foreløpig — ingen konkret oppmøtetid skal genereres.
 *
 * Invariantene brukes av enhetstester og soak-script for å fange intermittente
 * labelings-/tidsfeil i normalisert pipeline.
 */
import type { TankestromScheduleHighlight } from '../types'

export type VaacupDayKey = 'fredag' | 'lordag' | 'sondag'

export type VaacupNormalizedDay = {
  date: string
  dayKey: VaacupDayKey
  highlights: TankestromScheduleHighlight[]
  notes: string[]
  start?: string
  end?: string
  isConditional?: boolean
}

export type VaacupInvariantViolation = {
  dayKey: VaacupDayKey
  code:
    | 'fredag_missing_1745_oppmote'
    | 'fredag_missing_1840_kamp'
    | 'fredag_1840_labeled_oppmote'
    | 'fredag_1745_labeled_kamp'
    | 'lordag_missing_0835_oppmote'
    | 'lordag_missing_0920_first_kamp'
    | 'lordag_missing_1425_oppmote'
    | 'lordag_missing_1510_second_kamp'
    | 'lordag_0920_labeled_oppmote'
    | 'lordag_1510_labeled_first_kamp'
    | 'lordag_1510_labeled_oppmote'
    | 'sondag_synthetic_oppmote_present'
    | 'sondag_time_leakage_from_fredag'
    | 'sondag_not_tentative_but_has_concrete_time'
  message: string
  detail?: Record<string, unknown>
}

const KAMP_LABEL = /\bkamp\b|\bmatch\b/i
const OPPMOTE_LABEL = /\boppm[øo]te\b|\bm[øo]tes?\b|\bankomst\b/i
const FIRST_LABEL = /\bf[øo]rste\b|\bfirst\b/i
const SECOND_LABEL = /\bandre\b|\bsecond\b/i

function findHighlightByTime(
  highlights: TankestromScheduleHighlight[],
  time: string
): TankestromScheduleHighlight | undefined {
  return highlights.find((h) => h.time === time)
}

function isKamp(label: string): boolean {
  return KAMP_LABEL.test(label)
}

function isOppmote(label: string): boolean {
  return OPPMOTE_LABEL.test(label) && !KAMP_LABEL.test(label.replace(OPPMOTE_LABEL, ''))
}

function pushIfMissingOrWrong(
  out: VaacupInvariantViolation[],
  day: VaacupNormalizedDay,
  missingCode: VaacupInvariantViolation['code'],
  wrongCode: VaacupInvariantViolation['code'] | null,
  time: string,
  predicate: (label: string) => boolean,
  expected: string
): void {
  const h = findHighlightByTime(day.highlights, time)
  if (!h) {
    out.push({
      dayKey: day.dayKey,
      code: missingCode,
      message: `${day.dayKey} mangler highlight ${time} (${expected})`,
      detail: { time, expected, highlights: day.highlights.map((x) => `${x.time} ${x.label}`) },
    })
    return
  }
  if (!predicate(h.label)) {
    if (wrongCode) {
      out.push({
        dayKey: day.dayKey,
        code: wrongCode,
        message: `${day.dayKey} ${time} har feil label «${h.label}» (forventet ${expected})`,
        detail: { time, label: h.label, expected },
      })
    }
  }
}

function assertFredag(day: VaacupNormalizedDay, out: VaacupInvariantViolation[]): void {
  pushIfMissingOrWrong(
    out,
    day,
    'fredag_missing_1745_oppmote',
    'fredag_1745_labeled_kamp',
    '17:45',
    (label) => isOppmote(label),
    'Oppmøte'
  )
  pushIfMissingOrWrong(
    out,
    day,
    'fredag_missing_1840_kamp',
    'fredag_1840_labeled_oppmote',
    '18:40',
    (label) => isKamp(label),
    'Kamp / Første kamp'
  )
  const h1840 = findHighlightByTime(day.highlights, '18:40')
  if (h1840 && OPPMOTE_LABEL.test(h1840.label) && !KAMP_LABEL.test(h1840.label)) {
    out.push({
      dayKey: 'fredag',
      code: 'fredag_1840_labeled_oppmote',
      message: 'fredag 18:40 må aldri labels som Oppmøte (det er kampstart)',
      detail: { label: h1840.label },
    })
  }
}

function assertLordag(day: VaacupNormalizedDay, out: VaacupInvariantViolation[]): void {
  pushIfMissingOrWrong(
    out,
    day,
    'lordag_missing_0835_oppmote',
    null,
    '08:35',
    (label) => isOppmote(label),
    'Oppmøte før første kamp'
  )
  pushIfMissingOrWrong(
    out,
    day,
    'lordag_missing_0920_first_kamp',
    'lordag_0920_labeled_oppmote',
    '09:20',
    (label) => isKamp(label) && (FIRST_LABEL.test(label) || !SECOND_LABEL.test(label)),
    'Første kamp / Kamp'
  )
  pushIfMissingOrWrong(
    out,
    day,
    'lordag_missing_1425_oppmote',
    null,
    '14:25',
    (label) => isOppmote(label),
    'Oppmøte før andre kamp'
  )
  const h1510 = findHighlightByTime(day.highlights, '15:10')
  if (!h1510) {
    out.push({
      dayKey: 'lordag',
      code: 'lordag_missing_1510_second_kamp',
      message: 'lørdag mangler 15:10 (Andre kamp / Kamp)',
      detail: { highlights: day.highlights.map((x) => `${x.time} ${x.label}`) },
    })
  } else {
    if (!KAMP_LABEL.test(h1510.label)) {
      out.push({
        dayKey: 'lordag',
        code: 'lordag_1510_labeled_oppmote',
        message: `lørdag 15:10 må være kamp, ikke «${h1510.label}»`,
        detail: { label: h1510.label },
      })
    } else if (FIRST_LABEL.test(h1510.label) && !SECOND_LABEL.test(h1510.label)) {
      out.push({
        dayKey: 'lordag',
        code: 'lordag_1510_labeled_first_kamp',
        message: 'lørdag 15:10 skal være Andre kamp, ikke Første kamp',
        detail: { label: h1510.label },
      })
    }
  }
  const h0920 = findHighlightByTime(day.highlights, '09:20')
  if (h0920 && OPPMOTE_LABEL.test(h0920.label) && !KAMP_LABEL.test(h0920.label)) {
    out.push({
      dayKey: 'lordag',
      code: 'lordag_0920_labeled_oppmote',
      message: 'lørdag 09:20 må aldri labels som Oppmøte (det er kampstart)',
      detail: { label: h0920.label },
    })
  }
}

function assertSondag(day: VaacupNormalizedDay, out: VaacupInvariantViolation[]): void {
  if (day.isConditional !== true && day.highlights.length > 0) {
    out.push({
      dayKey: 'sondag',
      code: 'sondag_not_tentative_but_has_concrete_time',
      message: 'søndag er foreløpig i kilden men har konkrete highlights uten tentativ-flagg',
      detail: { highlights: day.highlights.map((x) => `${x.time} ${x.label}`) },
    })
  }
  for (const h of day.highlights) {
    if (OPPMOTE_LABEL.test(h.label) && !KAMP_LABEL.test(h.label)) {
      out.push({
        dayKey: 'sondag',
        code: 'sondag_synthetic_oppmote_present',
        message: `søndag har syntetisk Oppmøte ${h.time} «${h.label}» – kilden har ikke konkret oppmøtetid`,
        detail: { time: h.time, label: h.label },
      })
    }
    if (h.time === '17:45') {
      out.push({
        dayKey: 'sondag',
        code: 'sondag_time_leakage_from_fredag',
        message: 'søndag 17:45 ser ut som lekkasje fra fredag — kilden har ingen konkret tid for søndag',
        detail: { time: h.time, label: h.label },
      })
    }
  }
}

export function assertVaacupOriginalInvariants(
  days: ReadonlyArray<VaacupNormalizedDay>
): VaacupInvariantViolation[] {
  const out: VaacupInvariantViolation[] = []
  const fredag = days.find((d) => d.dayKey === 'fredag')
  const lordag = days.find((d) => d.dayKey === 'lordag')
  const sondag = days.find((d) => d.dayKey === 'sondag')
  if (fredag) assertFredag(fredag, out)
  if (lordag) assertLordag(lordag, out)
  if (sondag) assertSondag(sondag, out)
  return out
}

export function dayKeyFromDateForVaacup(date: string): VaacupDayKey | null {
  if (date === '2026-06-12') return 'fredag'
  if (date === '2026-06-13') return 'lordag'
  if (date === '2026-06-14') return 'sondag'
  return null
}

export function formatVaacupInvariantViolations(violations: VaacupInvariantViolation[]): string {
  if (violations.length === 0) return 'OK'
  return violations.map((v) => `[${v.dayKey}/${v.code}] ${v.message}`).join('\n')
}
