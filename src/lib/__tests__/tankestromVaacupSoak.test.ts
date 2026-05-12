/**
 * Soak-test for Vårcupen Tankestrøm-pipeline.
 *
 * Kjøres normalt via `npm run eval:tankestrom:soak` (Node-wrapper) eller
 * `VAACUP_SOAK_RUNS=50 npx vitest run src/lib/__tests__/tankestromVaacupSoak.test.ts`.
 * Når miljøvariabelen `VAACUP_SOAK_RUNS` ikke er satt, kjøres bare en kort sanity-runde,
 * slik at vanlig `npm test` ikke blir tregt.
 *
 * Hver run muterer den kanoniske Vårcupen-fixturen for å simulere intermittente LLM-feil
 * (lekkasjer, mis-labeling, manglende highlights). Invariants verifiseres pr. dag.
 * Feil skrives til `tmp/tankestrom-soak/<runId>-<seed>.json`.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertVaacupOriginalInvariants,
  formatVaacupInvariantViolations,
  type VaacupNormalizedDay,
} from '../tankestromVaacupInvariants'
import {
  applyVaacupMutation,
  buildCanonicalVaacupSegments,
  buildMetadataFromVaacupSegments,
  type VaacupMutationKind,
} from '../tankestromEval/vaacupFixtureMutations'
import { normalizeVaacupDaysFromEmbeddedMetadata } from '../tankestromEval/vaacupNormalize'

const DEFAULT_QUICK_RUNS = 5
const ENV_RUNS = process.env.VAACUP_SOAK_RUNS
const ENV_FIXTURE = process.env.VAACUP_SOAK_FIXTURE ?? 'vaacup_original'
const ENV_MODEL = process.env.VAACUP_SOAK_MODEL ?? 'fixture-mutation'
const ENV_SEED = process.env.VAACUP_SOAK_SEED
const RUNS = ENV_RUNS ? Math.max(1, Math.floor(Number(ENV_RUNS))) : DEFAULT_QUICK_RUNS
const SOAK_OUTPUT_DIR = resolve(process.cwd(), 'tmp', 'tankestrom-soak')

type RunResult = {
  run: number
  seed: number
  mutation: VaacupMutationKind
  invariantsPassed: boolean
  violations: ReturnType<typeof assertVaacupOriginalInvariants>
  days: VaacupNormalizedDay[]
}

function summarizeRun(r: RunResult): Record<string, unknown> {
  return {
    run: r.run,
    seed: r.seed,
    mutation: r.mutation,
    invariantsPassed: r.invariantsPassed,
    days: r.days.map((d) => ({
      dayKey: d.dayKey,
      date: d.date,
      isConditional: d.isConditional,
      start: d.start,
      end: d.end,
      highlights: d.highlights.map((h) => `${h.time} ${h.label}`),
      notesCount: d.notes.length,
    })),
    violations: r.violations.map((v) => ({ code: v.code, message: v.message, detail: v.detail })),
  }
}

function ensureDirExists(path: string): void {
  try {
    mkdirSync(path, { recursive: true })
  } catch {
    // ignore
  }
}

describe(`Vårcupen soak (runs=${RUNS}, fixture=${ENV_FIXTURE}, model=${ENV_MODEL})`, () => {
  const failures: RunResult[] = []
  const allResults: RunResult[] = []
  const baseSeed = ENV_SEED ? Number(ENV_SEED) : Date.now() & 0xffffffff
  const base = buildCanonicalVaacupSegments()

  it('alle muterte runs respekterer invariants etter normalisering', () => {
    for (let run = 1; run <= RUNS; run++) {
      const seed = (baseSeed + run * 7919) >>> 0
      const mutation = applyVaacupMutation(seed, base)
      const metadata = buildMetadataFromVaacupSegments(mutation.segments)
      const days = normalizeVaacupDaysFromEmbeddedMetadata(metadata)
      const violations = assertVaacupOriginalInvariants(days)
      const result: RunResult = {
        run,
        seed,
        mutation: mutation.kind,
        invariantsPassed: violations.length === 0 || isExpectedTolerableViolation(mutation.kind, violations),
        violations,
        days,
      }
      allResults.push(result)
      if (!result.invariantsPassed) failures.push(result)
    }
    if (failures.length > 0) {
      ensureDirExists(SOAK_OUTPUT_DIR)
      for (const f of failures) {
        const fpath = resolve(SOAK_OUTPUT_DIR, `${baseSeed}-${f.run}-${f.mutation}.json`)
        writeFileSync(fpath, JSON.stringify(summarizeRun(f), null, 2), 'utf-8')
      }
    }
    if (failures.length > 0) {
      const sample = failures.slice(0, 3).map((f) => formatVaacupInvariantViolations(f.violations)).join('\n')
      throw new Error(
        `Soak feilet: ${failures.length}/${RUNS} runs brøt invariants. Eksempler:\n${sample}\nDetaljer skrevet til ${SOAK_OUTPUT_DIR}`
      )
    }
    expect(failures.length).toBe(0)
  })

  afterAll(() => {
    const byMutation = new Map<string, { ok: number; bad: number }>()
    for (const r of allResults) {
      const cur = byMutation.get(r.mutation) ?? { ok: 0, bad: 0 }
      if (r.invariantsPassed) cur.ok += 1
      else cur.bad += 1
      byMutation.set(r.mutation, cur)
    }
    const lines: string[] = []
    lines.push('---')
    lines.push(`Vårcupen soak summary  fixture=${ENV_FIXTURE}  model=${ENV_MODEL}  runs=${RUNS}  baseSeed=${baseSeed}`)
    for (const [mut, c] of [...byMutation.entries()].sort()) {
      lines.push(`  ${mut.padEnd(36)}  ok=${String(c.ok).padStart(3)}  bad=${String(c.bad).padStart(3)}`)
    }
    lines.push(`  failures=${failures.length}`)
    lines.push('---')
    console.info(lines.join('\n'))
  })
})

function isExpectedTolerableViolation(
  _kind: VaacupMutationKind,
  _violations: ReturnType<typeof assertVaacupOriginalInvariants>
): boolean {
  return false
}
