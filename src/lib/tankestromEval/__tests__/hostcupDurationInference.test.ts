/**
 * Matrise-test: Høstcup tekst- og segment-varianter + strenge policy-invariants.
 *
 * Kjør: npm run eval:tankestrom:duration
 */
import { afterAll, describe, expect, it } from 'vitest'
import { HOSTCUP_TEXT_VARIANTS } from '../hostcupTextVariants'
import { HOSTCUP_SEGMENT_MUTATION_KINDS } from '../hostcupSegmentMutations'
import {
  runHostcupDurationCase,
  runHostcupDurationMatrix,
  type HostcupVariantRunResult,
} from '../hostcupDurationInferenceHarness'
import {
  buildHostcupDurationReport,
  writeHostcupDurationFailuresReport,
  writeHostcupDurationInferenceReport,
} from '../hostcupDurationInferenceDebug'
import { policyFailuresForHostcupCase } from '../hostcupDurationPolicyInvariants'

let matrixCache: HostcupVariantRunResult[] | null = null
let policyFailuresCache: ReturnType<typeof buildHostcupDurationReport> | null = null

function getMatrix(): HostcupVariantRunResult[] {
  if (!matrixCache) matrixCache = runHostcupDurationMatrix()
  return matrixCache
}

function getPolicyReport() {
  if (!policyFailuresCache) policyFailuresCache = buildHostcupDurationReport(getMatrix())
  return policyFailuresCache
}

function day(result: HostcupVariantRunResult, date: string) {
  const d = result.days.find((x) => x.date === date)
  if (!d) throw new Error(`Mangler dag ${date} i ${result.caseId}`)
  return d
}

afterAll(() => {
  const { report, policyFailures } = getPolicyReport()
  writeHostcupDurationInferenceReport(report.cases, { matrixFilename: 'matrix-latest.json' })
  if (policyFailures.length > 0) {
    writeHostcupDurationFailuresReport(policyFailures, report.cases, {
      filename: 'failures-latest.json',
    })
  }
})

describe('Høstcup duration inference matrix', () => {
  it('baseline + noop: canonical tider og import-count', () => {
    const r = runHostcupDurationCase(
      HOSTCUP_TEXT_VARIANTS.find((v) => v.id === 'baseline')!,
      'noop'
    )
    expect(r.importButtonSummary).toBe('1 arrangement / 2 hendelser')
    expect(r.evalInvariantFailures).toEqual([])
    expect(day(r, '2026-09-18').canonicalDisplayTime).toBe('17:30')
    expect(day(r, '2026-09-18').canonicalHighlights).toEqual([
      '17:30 Oppmøte ved bane 2',
      '18:15 Første kamp',
    ])
    expect(day(r, '2026-09-19').canonicalDisplayTime).toBe('08:20')
    expect(day(r, '2026-09-20').selected).toBe(false)
    expect(day(r, '2026-09-20').canonicalDisplayTime).toBeNull()
    expect(policyFailuresForHostcupCase(r, HOSTCUP_TEXT_VARIANTS.find((v) => v.id === 'baseline')!.text)).toEqual(
      []
    )
  })

  it('baseline: draft har start+slutt for valgte dager (varighet beregnet)', () => {
    const r = runHostcupDurationCase(
      HOSTCUP_TEXT_VARIANTS.find((v) => v.id === 'baseline')!,
      'noop'
    )
    const fri = day(r, '2026-09-18')
    const lor = day(r, '2026-09-19')
    expect(fri.selected).toBe(true)
    expect(lor.selected).toBe(true)
    expect(fri.draftStart).toBe('17:30')
    expect(fri.draftEnd).toBe('19:00')
    expect(fri.draftDurationMinutes).toBe(90)
    expect(lor.draftStart).toBe('08:20')
    expect(lor.draftEnd.length).toBeGreaterThan(0)
  })

  it('lor_drop_segment_end: export skal fortsatt gi konservativ slutt', () => {
    const r = runHostcupDurationCase(
      HOSTCUP_TEXT_VARIANTS.find((v) => v.id === 'baseline')!,
      'lor_drop_segment_end'
    )
    const lor = day(r, '2026-09-19')
    expect(lor.rawSegmentEnd).toBeUndefined()
    expect(lor.exportResolvedEnd).toMatch(/^\d{2}:\d{2}$/)
    expect(lor.exportResolvedEnd).not.toBe(lor.exportResolvedStart)
  })

  it('son_confirmed_times + son_bekreftet_program: søndag valgbar med konkret tid', () => {
    const r = runHostcupDurationCase(
      HOSTCUP_TEXT_VARIANTS.find((v) => v.id === 'son_bekreftet_program')!,
      'son_confirmed_times'
    )
    const son = day(r, '2026-09-20')
    expect(son.isConditional).toBe(false)
    expect(son.canonicalDisplayTime).toBe('10:30')
    expect(son.selected).toBe(true)
    const failures = policyFailuresForHostcupCase(
      r,
      HOSTCUP_TEXT_VARIANTS.find((v) => v.id === 'son_bekreftet_program')!.text
    )
    expect(failures.filter((f) => f.code.startsWith('policy_sunday_preliminary'))).toEqual([])
  })

  it('son_leak_fri_1730: policy godkjenner avvist lekkasje (ingen selected/display)', () => {
    const tv = HOSTCUP_TEXT_VARIANTS.find((v) => v.id === 'baseline')!
    const r = runHostcupDurationCase(tv, 'son_leak_fri_1730')
    const son = r.days.find((d) => d.date === '2026-09-20')!
    expect(son.canonicalDisplayTime).toBeNull()
    expect(son.selected).toBe(false)
    expect(policyFailuresForHostcupCase(r, tv.text)).toEqual([])
  })

  it('med_frist_8_sept_2100: frist skal ikke bli program-highlight', () => {
    const tv = HOSTCUP_TEXT_VARIANTS.find((v) => v.id === 'med_frist_8_sept_2100')!
    const r = runHostcupDurationCase(tv, 'noop')
    const failures = policyFailuresForHostcupCase(r, tv.text)
    expect(failures.filter((f) => f.code.startsWith('policy_deadline_'))).toEqual([])
  })

  it('kjører full matrise (187+ cases) og skriver debug-rapport', () => {
    const matrix = getMatrix()
    const expectedCases = HOSTCUP_TEXT_VARIANTS.length * HOSTCUP_SEGMENT_MUTATION_KINDS.length
    expect(matrix).toHaveLength(expectedCases)

    const { report } = getPolicyReport()
    expect(report.summary.totalCases).toBe(expectedCases)
    expect(report.summary.failedCases).toBeGreaterThanOrEqual(0)
    expect(report.caseCount).toBe(expectedCases)

    const { matrixPath } = writeHostcupDurationInferenceReport(matrix, {
      matrixFilename: 'matrix-latest.json',
    })
    expect(matrixPath).toContain('tankestrom-duration-inference-hostcup')
    expect(report.summaryByTextVariant).toBeDefined()
  }, 60_000)

})
