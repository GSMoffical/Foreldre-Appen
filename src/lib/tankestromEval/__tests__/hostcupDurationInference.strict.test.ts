/**
 * Strict eval-gate for Høstcup duration policy (kjøres via npm run eval:tankestrom:duration).
 */
import { describe, expect, it } from 'vitest'
import { runHostcupDurationMatrix } from '../hostcupDurationInferenceHarness'
import {
  buildHostcupDurationReport,
  writeHostcupDurationFailuresReport,
} from '../hostcupDurationInferenceDebug'
import {
  formatStrictPolicyErrorMessage,
  partitionPolicyFailures,
} from '../hostcupDurationPolicyInvariants'

describe('Høstcup duration strict policy (eval gate)', () => {
  it('strict: ingen uventede policy-brudd; kjente son_leak-feil blokkerer til fix', () => {
    const matrix = runHostcupDurationMatrix()
    const { policyFailures } = buildHostcupDurationReport(matrix)
    const { unexpected, knownStillFailing } = partitionPolicyFailures(policyFailures)

    expect(unexpected).toEqual([])

    if (knownStillFailing.length > 0) {
      writeHostcupDurationFailuresReport(policyFailures, matrix)
      throw new Error(formatStrictPolicyErrorMessage(unexpected, knownStillFailing))
    }
  })
})
