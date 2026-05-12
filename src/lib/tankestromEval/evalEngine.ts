import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execSync } from 'node:child_process'
import { parsePortalImportProposalBundle } from '../tankestromApi'
import type { PortalImportProposalBundle } from '../../features/tankestrom/types'
import type { EventMetadata } from '../../types'
import {
  applyVaacupMutation,
  buildCanonicalVaacupSegments,
  buildMetadataFromVaacupSegments,
} from './vaacupFixtureMutations'
import { normalizeEmbeddedScheduleDaySnapshots, normalizeVaacupDaysFromEmbeddedMetadata } from './vaacupNormalize'
import {
  invariantFailuresForAmbiguousWeekend,
  invariantFailuresForHostcupDays,
  invariantFailuresForSpondBundle,
  invariantFailuresForVaacupDays,
  invariantFailuresForVaacupUpdateMatch,
  type FixtureInvariantFailure,
} from './fixtureInvariants'
import {
  analyzeTextWithLiveApi,
  LiveAnalyzeError,
  type LiveAnalyzeOptions,
} from './liveAnalyze'

export const TANKESTROM_EVAL_FIXTURE_IDS = [
  'vaacup_original',
  'vaacup_update_1',
  'hostcup_original',
  'spond_deadline',
  'ambiguous_weekend_event',
] as const

export type TankestromEvalFixtureId = (typeof TANKESTROM_EVAL_FIXTURE_IDS)[number]

/** Fixtures støttet i live-modus (innskrenket initielt: kun cup-fixtures med embedded schedule). */
export const TANKESTROM_LIVE_FIXTURE_IDS = ['vaacup_original', 'hostcup_original'] as const
export type TankestromLiveFixtureId = (typeof TANKESTROM_LIVE_FIXTURE_IDS)[number]

export type TankestromEvalMode = 'deterministic' | 'live'

export type EvalRunRecord = {
  fixture: TankestromEvalFixtureId
  run: number
  seed: number
  passed: boolean
  mode: TankestromEvalMode
  mutationKind?: string
  failures: FixtureInvariantFailure[]
  summary?: Record<string, unknown>
  /** Sett kun i live-modus. Lagres til disk for feilede runs. */
  live?: {
    httpStatus?: number
    durationMs?: number
    errorStage?: string
  }
}

export type EvalSummary = {
  generatedAt: string
  commit: string
  argv: string[]
  mode: TankestromEvalMode
  runsPerFixture: number
  baseSeed: number
  records: EvalRunRecord[]
  failureCount: number
  passCount: number
}

const FIXTURES_DIR = 'fixtures/tankestrom'

function readFixtureText(id: TankestromEvalFixtureId): string {
  return readFileSync(resolve(process.cwd(), join(FIXTURES_DIR, `${id}.txt`)), 'utf-8')
}

function readAnalyzeJsonRaw(id: TankestromEvalFixtureId): unknown {
  const p = resolve(process.cwd(), join(FIXTURES_DIR, `${id}.analyze.json`))
  return JSON.parse(readFileSync(p, 'utf-8')) as unknown
}

function tryGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return (
      process.env.GITHUB_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.CF_PAGES_COMMIT_SHA ??
      'unknown'
    )
  }
}

function parseBundle(id: TankestromEvalFixtureId): PortalImportProposalBundle {
  return parsePortalImportProposalBundle(readAnalyzeJsonRaw(id))
}

function runVaacupOriginalRun(run: number, mutationSeed: number): EvalRunRecord {
  const base = buildCanonicalVaacupSegments()
  const mutation = applyVaacupMutation(mutationSeed, base)
  const metadata = buildMetadataFromVaacupSegments(mutation.segments)
  const days = normalizeVaacupDaysFromEmbeddedMetadata(metadata)
  const failures = invariantFailuresForVaacupDays(days)
  return {
    fixture: 'vaacup_original',
    run,
    seed: mutationSeed,
    passed: failures.length === 0,
    mode: 'deterministic',
    mutationKind: mutation.kind,
    failures,
    summary: {
      days: days.map((d) => ({
        dayKey: d.dayKey,
        highlights: d.highlights.map((h) => `${h.time} ${h.label}`),
      })),
    },
  }
}

function runHostcupRun(run: number, mutationSeed: number): EvalRunRecord {
  const bundle = parseBundle('hostcup_original')
  const ev = bundle.items.find((i) => i.kind === 'event')
  if (!ev || ev.kind !== 'event') {
    return {
      fixture: 'hostcup_original',
      run,
      seed: mutationSeed,
      passed: false,
      mode: 'deterministic',
      failures: [{ code: 'hostcup_parse', message: 'Ingen event i bundle', detail: {} }],
    }
  }
  const meta = ev.event.metadata as EventMetadata
  const globalSourceText = readFixtureText('hostcup_original')
  const days = normalizeEmbeddedScheduleDaySnapshots(meta, { globalSourceText })
  const failures = invariantFailuresForHostcupDays(days)
  return {
    fixture: 'hostcup_original',
    run,
    seed: mutationSeed,
    passed: failures.length === 0,
    mode: 'deterministic',
    failures,
    summary: { dayCount: days.length, dates: days.map((d) => d.date) },
  }
}

function runSpondRun(run: number, mutationSeed: number): EvalRunRecord {
  const bundle = parseBundle('spond_deadline')
  const failures = invariantFailuresForSpondBundle(bundle)
  return {
    fixture: 'spond_deadline',
    run,
    seed: mutationSeed,
    passed: failures.length === 0,
    mode: 'deterministic',
    failures,
    summary: { itemKinds: bundle.items.map((i) => i.kind) },
  }
}

function runAmbiguousRun(run: number, mutationSeed: number): EvalRunRecord {
  const bundle = parseBundle('ambiguous_weekend_event')
  const failures = invariantFailuresForAmbiguousWeekend(bundle)
  return {
    fixture: 'ambiguous_weekend_event',
    run,
    seed: mutationSeed,
    passed: failures.length === 0,
    mode: 'deterministic',
    failures,
    summary: { itemKinds: bundle.items.map((i) => i.kind) },
  }
}

function runVaacupUpdateRun(run: number, mutationSeed: number): EvalRunRecord {
  const bundle = parseBundle('vaacup_update_1')
  const failures = invariantFailuresForVaacupUpdateMatch(bundle)
  return {
    fixture: 'vaacup_update_1',
    run,
    seed: mutationSeed,
    passed: failures.length === 0,
    mode: 'deterministic',
    failures,
    summary: { itemKinds: bundle.items.map((i) => i.kind) },
  }
}

function isLiveEligibleFixture(id: TankestromEvalFixtureId): id is TankestromLiveFixtureId {
  return (TANKESTROM_LIVE_FIXTURE_IDS as readonly string[]).includes(id)
}

function firstEventMetadataFromBundle(bundle: PortalImportProposalBundle): EventMetadata | null {
  for (const it of bundle.items) {
    if (it.kind === 'event') {
      const meta = it.event.metadata
      if (meta && typeof meta === 'object' && !Array.isArray(meta)) return meta as EventMetadata
    }
  }
  return null
}

async function runLiveOne(
  fixture: TankestromLiveFixtureId,
  run: number,
  seed: number,
  liveOpts: LiveAnalyzeOptions,
  rawDir: string
): Promise<EvalRunRecord> {
  const text = readFixtureText(fixture)
  const baseRecord: Omit<EvalRunRecord, 'passed' | 'failures'> = {
    fixture,
    run,
    seed,
    mode: 'live',
    summary: { fixtureBytes: text.length },
  }
  let liveRes
  try {
    liveRes = await analyzeTextWithLiveApi(text, liveOpts)
  } catch (err) {
    const live = err instanceof LiveAnalyzeError ? err : null
    const message = err instanceof Error ? err.message : String(err)
    const rec: EvalRunRecord = {
      ...baseRecord,
      passed: false,
      failures: [
        {
          code: live ? `live_${live.stage}_error` : 'live_unknown_error',
          message,
          detail: {
            httpStatus: live?.httpStatus,
            durationMs: live?.durationMs,
            responseText: live?.responseText,
          },
        },
      ],
      live: {
        httpStatus: live?.httpStatus,
        durationMs: live?.durationMs,
        errorStage: live?.stage,
      },
    }
    writeFileSync(
      join(rawDir, `${fixture}__run-${run}__seed-${seed}__live-error.json`),
      JSON.stringify(rec, null, 2),
      'utf-8'
    )
    return rec
  }

  const meta = firstEventMetadataFromBundle(liveRes.bundle)
  if (!meta) {
    const rec: EvalRunRecord = {
      ...baseRecord,
      passed: false,
      failures: [
        {
          code: 'live_no_event_in_bundle',
          message: 'Live analyse returnerte ingen kalenderhendelse — fant ingen event-metadata.',
          detail: { itemKinds: liveRes.bundle.items.map((i) => i.kind) },
        },
      ],
      live: { httpStatus: liveRes.httpStatus, durationMs: liveRes.durationMs },
    }
    writeFileSync(
      join(rawDir, `${fixture}__run-${run}__seed-${seed}__live-raw.json`),
      JSON.stringify({ rec, rawPayload: liveRes.rawPayload }, null, 2),
      'utf-8'
    )
    return rec
  }

  const failures: FixtureInvariantFailure[] = []
  let summary: Record<string, unknown> = {}
  if (fixture === 'vaacup_original') {
    const days = normalizeVaacupDaysFromEmbeddedMetadata(meta, { globalSourceText: text })
    failures.push(...invariantFailuresForVaacupDays(days))
    summary = {
      days: days.map((d) => ({
        dayKey: d.dayKey,
        highlights: d.highlights.map((h) => `${h.time} ${h.label}`),
      })),
    }
  } else if (fixture === 'hostcup_original') {
    const days = normalizeEmbeddedScheduleDaySnapshots(meta, { globalSourceText: text })
    failures.push(...invariantFailuresForHostcupDays(days))
    summary = { dayCount: days.length, dates: days.map((d) => d.date) }
  }
  if (!meta.embeddedSchedule || !Array.isArray(meta.embeddedSchedule) || meta.embeddedSchedule.length === 0) {
    failures.push({
      code: 'live_no_embedded_schedule',
      message: 'Live analyse returnerte ingen embeddedSchedule på parent-event — kan ikke verifisere delprogram.',
      detail: { itemKinds: liveRes.bundle.items.map((i) => i.kind) },
    })
  }

  const passed = failures.length === 0
  const rec: EvalRunRecord = {
    ...baseRecord,
    passed,
    failures,
    summary: { ...summary, httpStatus: liveRes.httpStatus, durationMs: liveRes.durationMs },
    live: { httpStatus: liveRes.httpStatus, durationMs: liveRes.durationMs },
  }
  if (!passed) {
    writeFileSync(
      join(rawDir, `${fixture}__run-${run}__seed-${seed}__live-raw.json`),
      JSON.stringify({ rec, rawPayload: liveRes.rawPayload }, null, 2),
      'utf-8'
    )
  }
  return rec
}

function runOne(
  fixture: TankestromEvalFixtureId,
  run: number,
  mutationSeed: number
): EvalRunRecord {
  switch (fixture) {
    case 'vaacup_original':
      return runVaacupOriginalRun(run, mutationSeed)
    case 'hostcup_original':
      return runHostcupRun(run, mutationSeed)
    case 'spond_deadline':
      return runSpondRun(run, mutationSeed)
    case 'ambiguous_weekend_event':
      return runAmbiguousRun(run, mutationSeed)
    case 'vaacup_update_1':
      return runVaacupUpdateRun(run, mutationSeed)
    default: {
      const _x: never = fixture
      return _x
    }
  }
}

/** Validerer at .txt finnes (tekstbank) — analyze.json er det som kjøres deterministisk. */
export function assertFixtureTextPresent(ids: readonly TankestromEvalFixtureId[]): void {
  for (const id of ids) {
    readFixtureText(id)
  }
}

export type RunTankestromEvalOptions = {
  fixture: 'all' | TankestromEvalFixtureId
  runs: number
  seed: number
  outDir: string
  mode?: TankestromEvalMode
  live?: LiveAnalyzeOptions
}

export async function runTankestromEval(opts: RunTankestromEvalOptions): Promise<EvalSummary> {
  const mode: TankestromEvalMode = opts.mode === 'live' ? 'live' : 'deterministic'

  let ids: TankestromEvalFixtureId[]
  if (mode === 'live') {
    if (opts.fixture === 'all') {
      ids = [...TANKESTROM_LIVE_FIXTURE_IDS]
    } else if (isLiveEligibleFixture(opts.fixture)) {
      ids = [opts.fixture]
    } else {
      throw new Error(
        `Live-modus støtter foreløpig kun fixtures: ${TANKESTROM_LIVE_FIXTURE_IDS.join(', ')}. Fikk «${opts.fixture}».`
      )
    }
    if (!opts.live || !opts.live.url) {
      throw new Error(
        'Live-modus krever VITE_TANKESTROM_ANALYZE_URL (+ valgfri TANKESTROM_BEARER/TANKESTROM_API_KEY) i env.'
      )
    }
  } else {
    ids = opts.fixture === 'all' ? [...TANKESTROM_EVAL_FIXTURE_IDS] : [opts.fixture]
  }
  assertFixtureTextPresent(ids)

  const runs = Math.max(1, Math.floor(opts.runs))
  const outDir = resolve(process.cwd(), opts.outDir)
  const rawDir = join(outDir, 'runs')
  mkdirSync(rawDir, { recursive: true })

  const records: EvalRunRecord[] = []
  if (mode === 'deterministic') {
    for (const fixture of ids) {
      parseBundle(fixture)
      for (let run = 1; run <= runs; run++) {
        const mutationSeed = (opts.seed + hashFixtureSalt(fixture) + run * 7919) >>> 0
        const rec = runOne(fixture, run, mutationSeed)
        records.push(rec)
        if (!rec.passed) {
          const fname = `${fixture}__run-${run}__seed-${mutationSeed}.json`
          writeFileSync(
            join(rawDir, fname),
            JSON.stringify(
              {
                ...rec,
                fixtureTextNote: 'Se fixtures/tankestrom/<fixture>.txt (kildebank)',
              },
              null,
              2
            ),
            'utf-8'
          )
        }
      }
    }
  } else {
    for (const fixture of ids) {
      if (!isLiveEligibleFixture(fixture)) continue
      for (let run = 1; run <= runs; run++) {
        const seed = (opts.seed + hashFixtureSalt(fixture) + run * 7919) >>> 0
        // eslint-disable-next-line no-await-in-loop -- intentionally sequential to be gentle på live API
        const rec = await runLiveOne(fixture, run, seed, opts.live!, rawDir)
        records.push(rec)
      }
    }
  }

  const failureCount = records.filter((r) => !r.passed).length
  const passCount = records.length - failureCount
  const summary: EvalSummary = {
    generatedAt: new Date().toISOString(),
    commit: tryGitSha(),
    argv: typeof process !== 'undefined' ? process.argv : [],
    mode,
    runsPerFixture: runs,
    baseSeed: opts.seed,
    records,
    failureCount,
    passCount,
  }

  const failuresPayload = {
    generatedAt: summary.generatedAt,
    commit: summary.commit,
    mode,
    failureCount,
    passCount,
    records: records.filter((r) => !r.passed),
  }
  writeFileSync(join(outDir, 'failures.json'), JSON.stringify(failuresPayload, null, 2), 'utf-8')

  const byFixture = new Map<TankestromEvalFixtureId, { pass: number; fail: number }>()
  for (const id of ids) byFixture.set(id, { pass: 0, fail: 0 })
  for (const r of records) {
    const cur = byFixture.get(r.fixture)
    if (!cur) continue
    if (r.passed) cur.pass += 1
    else cur.fail += 1
  }

  const codeCounts = new Map<string, number>()
  for (const r of records) {
    if (r.passed) continue
    for (const f of r.failures) {
      codeCounts.set(f.code, (codeCounts.get(f.code) ?? 0) + 1)
    }
  }
  const topFailureCodes = [...codeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([code, n]) => `- ${n}× ${code}`)
    .join('\n')

  const lines: string[] = []
  lines.push(`# Tankestrøm eval summary`)
  lines.push('')
  lines.push(`- **Mode:** ${mode === 'live' ? 'live (Tankestrøm analyze API)' : 'deterministic (fixtures only)'}`)
  lines.push(`- **Generated:** ${summary.generatedAt}`)
  lines.push(`- **Commit:** \`${summary.commit}\``)
  lines.push(`- **Fixtures:** ${ids.length}`)
  lines.push(`- **Runs per fixture:** ${runs}`)
  lines.push(`- **Base seed:** ${opts.seed}`)
  lines.push(`- **Pass:** ${passCount} / ${records.length}`)
  lines.push(`- **Fail:** ${failureCount}`)
  lines.push(`- **Failures JSON:** \`${join(outDir, 'failures.json')}\``)
  if (mode === 'live') {
    lines.push(`- **Live raw payload (failed runs):** \`${rawDir}/<fixture>__run-N__seed-...__live-*.json\``)
  }
  lines.push('')
  lines.push('## Per fixture')
  lines.push('')
  for (const id of ids) {
    const c = byFixture.get(id) ?? { pass: 0, fail: 0 }
    const icon = c.fail === 0 ? '✅' : '❌'
    lines.push(`${icon} **${id}** ${c.pass}/${c.pass + c.fail}`)
    if (c.fail > 0) {
      const reasons = records
        .filter((r) => r.fixture === id && !r.passed)
        .flatMap((r) => r.failures.map((f) => f.code))
      const reasonCounts = new Map<string, number>()
      for (const code of reasons) reasonCounts.set(code, (reasonCounts.get(code) ?? 0) + 1)
      for (const [code, n] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
        lines.push(`   - ${n}× ${code}`)
      }
    }
  }
  lines.push('')
  lines.push('## Top failure codes (all fixtures)')
  lines.push(topFailureCodes || '_none_')
  lines.push('')

  writeFileSync(join(outDir, 'summary.md'), lines.join('\n'), 'utf-8')

  return summary
}

function hashFixtureSalt(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  return h % 100000
}
