/**
 * Skriver matrise-resultater og policy-feil til tmp/ for manuell inspeksjon.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HostcupVariantRunResult } from './hostcupDurationInferenceHarness'
import { HOSTCUP_TEXT_VARIANTS } from './hostcupTextVariants'
import {
  policyFailuresForHostcupCase,
  summarizePolicyResults,
  type HostcupDurationPolicyFailure,
  type HostcupDurationPolicySummary,
} from './hostcupDurationPolicyInvariants'

export type HostcupDurationFailureRecord = {
  caseId: string
  textVariantId: string
  segmentMutation: string
  day?: string
  actualDisplayTime: string | null
  actualSelected: boolean
  actualBlockers: string[]
  actualHighlights: string[]
  code: string
  message: string
  expected?: string
}

export type HostcupSundayLeakSummary = {
  rawLeakCandidateCount: number
  rejectedLeakCount: number
  displayedLeakCount: number
  selectedLeakCount: number
}

export type HostcupDurationInferenceReport = {
  generatedAt: string
  caseCount: number
  summary: HostcupDurationPolicySummary
  sundayLeak: HostcupSundayLeakSummary
  policyFailureCount: number
  cases: HostcupVariantRunResult[]
  summaryByTextVariant: Record<
    string,
    { cases: number; invariantFailureCases: number; draftMissingEndCases: number; policyFailedCases: number }
  >
}

function textForVariant(id: string): string {
  return HOSTCUP_TEXT_VARIANTS.find((v) => v.id === id)?.text ?? ''
}

export function collectAllPolicyFailures(cases: HostcupVariantRunResult[]): HostcupDurationPolicyFailure[] {
  const out: HostcupDurationPolicyFailure[] = []
  for (const c of cases) {
    out.push(...policyFailuresForHostcupCase(c, textForVariant(c.textVariantId)))
  }
  return out
}

export function policyFailuresToMinimalRecords(
  failures: HostcupDurationPolicyFailure[],
  cases: HostcupVariantRunResult[]
): HostcupDurationFailureRecord[] {
  return failures.map((f) => {
    const c = cases.find((x) => x.caseId === f.caseId)
    const day = f.date ? c?.days.find((d) => d.date === f.date) : c?.days[0]
    return {
      caseId: f.caseId,
      textVariantId: f.textVariantId,
      segmentMutation: f.segmentMutation,
      day: f.date,
      actualDisplayTime: day?.canonicalDisplayTime ?? null,
      actualSelected: day?.selected ?? false,
      actualBlockers: day?.validationBlockers ?? [],
      actualHighlights: day?.canonicalHighlights ?? [],
      code: f.code,
      message: f.message,
      expected: f.expected,
    }
  })
}

export function summarizeHostcupDurationMatrix(
  cases: HostcupVariantRunResult[],
  policyFailures: HostcupDurationPolicyFailure[]
): HostcupDurationInferenceReport['summaryByTextVariant'] {
  const failedCaseIds = new Set(policyFailures.map((f) => f.caseId))
  const summary: HostcupDurationInferenceReport['summaryByTextVariant'] = {}
  for (const c of cases) {
    const s = summary[c.textVariantId] ?? {
      cases: 0,
      invariantFailureCases: 0,
      draftMissingEndCases: 0,
      policyFailedCases: 0,
    }
    s.cases += 1
    if (c.evalInvariantFailures.length > 0) s.invariantFailureCases += 1
    if (c.days.some((d) => d.draftHasStartWithoutEnd && d.selected)) s.draftMissingEndCases += 1
    if (failedCaseIds.has(c.caseId)) s.policyFailedCases += 1
    summary[c.textVariantId] = s
  }
  return summary
}

function summarizeSundayLeaks(cases: HostcupVariantRunResult[]): HostcupSundayLeakSummary {
  const crossDay = ['17:30', '18:15', '08:20', '09:00', '13:55', '14:40', '17:45', '16:40', '08:30', '09:15']
  let rawLeakCandidateCount = 0
  let rejectedLeakCount = 0
  let displayedLeakCount = 0
  let selectedLeakCount = 0

  for (const c of cases) {
    if (c.segmentMutation !== 'son_leak_fri_1730') continue
    const son = c.days.find((d) => d.date === '2026-09-20')
    if (!son) continue
    const rawStart = son.rawSegmentStart?.slice(0, 5)
    const rawHasCross =
      (rawStart && crossDay.includes(rawStart)) ||
      son.canonicalHighlights.some((h) => crossDay.some((t) => h.startsWith(`${t} `)))
    if (rawHasCross || son.rawSegmentStart === '17:30') rawLeakCandidateCount += 1

    const displayed =
      son.canonicalDisplayTime != null && crossDay.includes(son.canonicalDisplayTime)
    const highlightedCrossDay = son.canonicalHighlights.some((h) =>
      crossDay.some((t) => h.startsWith(`${t} `))
    )
    const selectedLeak = son.selected && (displayed || highlightedCrossDay)
    if (rawHasCross && !displayed && !selectedLeak) rejectedLeakCount += 1
    if (displayed) displayedLeakCount += 1
    if (selectedLeak) selectedLeakCount += 1
  }

  return { rawLeakCandidateCount, rejectedLeakCount, displayedLeakCount, selectedLeakCount }
}

export function buildHostcupDurationReport(cases: HostcupVariantRunResult[]): {
  report: HostcupDurationInferenceReport
  policyFailures: HostcupDurationPolicyFailure[]
} {
  const policyFailures = collectAllPolicyFailures(cases)
  const summary = summarizePolicyResults(cases, policyFailures)
  return {
    policyFailures,
    report: {
      generatedAt: new Date().toISOString(),
      caseCount: cases.length,
      summary,
      sundayLeak: summarizeSundayLeaks(cases),
      policyFailureCount: policyFailures.length,
      cases,
      summaryByTextVariant: summarizeHostcupDurationMatrix(cases, policyFailures),
    },
  }
}

export function writeHostcupDurationInferenceReport(
  cases: HostcupVariantRunResult[],
  opts?: { dir?: string; matrixFilename?: string }
): { matrixPath: string; policyFailures: HostcupDurationPolicyFailure[] } {
  const dir = opts?.dir ?? join(process.cwd(), 'tmp', 'tankestrom-duration-inference-hostcup')
  mkdirSync(dir, { recursive: true })
  const { report, policyFailures } = buildHostcupDurationReport(cases)
  const matrixPath = join(dir, opts?.matrixFilename ?? 'matrix-latest.json')
  writeFileSync(matrixPath, JSON.stringify(report, null, 2), 'utf8')
  return { matrixPath, policyFailures }
}

export function writeHostcupDurationFailuresReport(
  failures: HostcupDurationPolicyFailure[],
  cases: HostcupVariantRunResult[],
  opts?: { dir?: string; filename?: string }
): string {
  const dir = opts?.dir ?? join(process.cwd(), 'tmp', 'tankestrom-duration-inference-hostcup')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, opts?.filename ?? 'failures-latest.json')
  const payload = {
    generatedAt: new Date().toISOString(),
    failureCount: failures.length,
    failures: policyFailuresToMinimalRecords(failures, cases),
  }
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8')
  return path
}
