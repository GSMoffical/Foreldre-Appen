#!/usr/bin/env node
/**
 * Vårcupen Tankestrøm soak-runner.
 *
 * Bruk:
 *   npm run eval:tankestrom:soak -- --fixture=vaacup_original --runs=50 --model=gpt-5.4-mini
 *
 * Argumenter:
 *   --fixture=<name>   Hvilket fixtursett (kun `vaacup_original` foreløpig).
 *   --runs=<n>         Antall iterasjoner (default 50).
 *   --model=<name>     Etikett som loggføres (default `fixture-mutation`). Soak kjøres
 *                      som lokal mutasjon mot vår normaliseringspipeline; modellnavn er
 *                      kun loggføring for sammenligning.
 *   --seed=<n>         Base-seed (deterministisk run).
 *
 * Failures: detaljer skrives til `tmp/tankestrom-soak/`. Sammendrag printes på slutten.
 * Soak-driveren er en vitest-test (`tankestromVaacupSoak.test.ts`); denne wrapper-en
 * setter miljøvariabler og kaller `npx vitest run`. Cross-platform.
 */
import { spawn } from 'node:child_process'

function parseArg(name, fallback) {
  const prefix = `--${name}=`
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length)
  }
  const eqIdx = process.argv.indexOf(`--${name}`)
  if (eqIdx >= 0 && process.argv[eqIdx + 1] && !process.argv[eqIdx + 1].startsWith('--')) {
    return process.argv[eqIdx + 1]
  }
  return fallback
}

const fixture = parseArg('fixture', 'vaacup_original')
const runs = parseArg('runs', '50')
const model = parseArg('model', 'fixture-mutation')
const seed = parseArg('seed', undefined)

if (fixture !== 'vaacup_original') {
  console.error(`Ukjent fixture «${fixture}» — kun «vaacup_original» er støttet foreløpig.`)
  process.exit(2)
}

const env = {
  ...process.env,
  VAACUP_SOAK_RUNS: String(runs),
  VAACUP_SOAK_FIXTURE: fixture,
  VAACUP_SOAK_MODEL: model,
}
if (seed !== undefined) env.VAACUP_SOAK_SEED = String(seed)

console.info(`[soak] fixture=${fixture} runs=${runs} model=${model}${seed ? ` seed=${seed}` : ''}`)

const isWindows = process.platform === 'win32'
const child = spawn(
  isWindows ? 'npx.cmd' : 'npx',
  ['vitest', 'run', 'src/lib/__tests__/tankestromVaacupSoak.test.ts', '--reporter=default'],
  {
    env,
    stdio: 'inherit',
    shell: isWindows,
  }
)

child.on('error', (err) => {
  console.error('[soak] spawn error:', err.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
