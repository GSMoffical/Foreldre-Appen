/**
 * Kjøres via `npm run eval:tankestrom` (scripts/eval-tankestrom.mjs setter TANKESTROM_EVAL=1).
 * Skipped i vanlig `npm test` med mindre TANKESTROM_EVAL=1 er satt.
 *
 * Miljø:
 *   TANKESTROM_EVAL_MODE=deterministic|live  (default deterministic)
 *   TANKESTROM_EVAL_FIXTURE=all|<fixtureId>
 *   TANKESTROM_EVAL_RUNS
 *   TANKESTROM_EVAL_SEED
 *   TANKESTROM_EVAL_OUT
 *
 *   Live-modus krever i tillegg:
 *     VITE_TANKESTROM_ANALYZE_URL
 *     (valgfritt) TANKESTROM_BEARER  → settes som Authorization: Bearer ...
 *     (valgfritt) TANKESTROM_API_KEY → settes som X-API-Key
 *     (valgfritt) TANKESTROM_EVAL_LIVE_TIMEOUT_MS (default 60000)
 */
import { describe, expect, it } from 'vitest'
import { runTankestromEval, type TankestromEvalFixtureId, type TankestromEvalMode } from './evalEngine'
import { liveOptionsFromEnv } from './liveAnalyze'

describe.skipIf(process.env.TANKESTROM_EVAL !== '1')('Tankestrom eval (CLI)', () => {
  it('kjører eval og feiler ved invariant-brudd', async () => {
    const mode: TankestromEvalMode = process.env.TANKESTROM_EVAL_MODE === 'live' ? 'live' : 'deterministic'
    const fixtureRaw = process.env.TANKESTROM_EVAL_FIXTURE ?? 'all'
    const runsDefault = mode === 'live' ? '3' : '10'
    const runs = Math.max(1, Math.floor(Number(process.env.TANKESTROM_EVAL_RUNS ?? runsDefault)))
    const seed = Math.floor(Number(process.env.TANKESTROM_EVAL_SEED ?? '123'))
    const outDir = process.env.TANKESTROM_EVAL_OUT ?? 'tmp/tankestrom-eval'

    const fixture: 'all' | TankestromEvalFixtureId =
      fixtureRaw === 'all' ? 'all' : (fixtureRaw as TankestromEvalFixtureId)

    const summary = await runTankestromEval({
      fixture,
      runs,
      seed,
      outDir,
      mode,
      live: mode === 'live' ? liveOptionsFromEnv() : undefined,
    })

    console.info(
      `[tankestrom-eval] mode=${summary.mode} pass ${summary.passCount}/${summary.records.length} fail ${summary.failureCount} outDir=${outDir}`
    )

    expect(summary.failureCount, `Se ${outDir}/summary.md og failures.json`).toBe(0)
  }, 600_000)
})
