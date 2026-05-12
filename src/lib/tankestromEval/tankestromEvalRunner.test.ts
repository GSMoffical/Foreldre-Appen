/**
 * Kjøres via `npm run eval:tankestrom` (scripts/eval-tankestrom.mjs setter TANKESTROM_EVAL=1).
 * Skipped i vanlig `npm test` med mindre TANKESTROM_EVAL=1 er satt.
 *
 * Miljø:
 *   TANKESTROM_EVAL_FIXTURE=all|<fixtureId>
 *   TANKESTROM_EVAL_RUNS
 *   TANKESTROM_EVAL_SEED
 *   TANKESTROM_EVAL_OUT
 */
import { describe, expect, it } from 'vitest'
import { runTankestromEval, type TankestromEvalFixtureId } from './evalEngine'

describe.skipIf(process.env.TANKESTROM_EVAL !== '1')('Tankestrom eval (CLI)', () => {
  it('kjører deterministisk eval og feiler ved invariant-brudd', () => {
    const fixtureRaw = process.env.TANKESTROM_EVAL_FIXTURE ?? 'all'
    const runs = Math.max(1, Math.floor(Number(process.env.TANKESTROM_EVAL_RUNS ?? '10')))
    const seed = Math.floor(Number(process.env.TANKESTROM_EVAL_SEED ?? '123'))
    const outDir = process.env.TANKESTROM_EVAL_OUT ?? 'tmp/tankestrom-eval'

    const fixture: 'all' | TankestromEvalFixtureId =
      fixtureRaw === 'all' ? 'all' : (fixtureRaw as TankestromEvalFixtureId)

    const summary = runTankestromEval({
      fixture,
      runs,
      seed,
      outDir,
    })

    console.info(
      `[tankestrom-eval] pass ${summary.passCount}/${summary.records.length} fail ${summary.failureCount} outDir=${outDir}`
    )

    expect(summary.failureCount, `Se ${outDir}/summary.md og failures.json`).toBe(0)
  })
})
