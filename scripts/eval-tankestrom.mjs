#!/usr/bin/env node
/**
 * Tankestrom fixture-eval.
 *
 * Deterministisk (default):
 *   npm run eval:tankestrom -- --fixture=all --runs=20 --seed=123
 *
 * Live (kaller faktisk Tankestrøm analyse-API):
 *   $env:VITE_TANKESTROM_ANALYZE_URL="https://..."
 *   $env:TANKESTROM_BEARER="<token>"           # eller TANKESTROM_API_KEY
 *   npm run eval:tankestrom -- --mode=live --fixture=vaacup_original --runs=3 --seed=123
 *
 * Output under tmp/tankestrom-eval/ (konfigurerbart med --out):
 *   summary.md, failures.json, runs/*.json
 */
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

function parseArg(name, fallback) {
  const prefix = `--${name}=`
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length)
  }
  const idx = process.argv.indexOf(`--${name}`)
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1]
  }
  return fallback
}

const mode = (parseArg('mode', 'deterministic') || 'deterministic').toLowerCase()
if (mode !== 'deterministic' && mode !== 'live') {
  console.error(`[eval:tankestrom] ugyldig --mode=${mode} (forventet 'deterministic' eller 'live')`)
  process.exit(2)
}

const fixture = parseArg('fixture', mode === 'live' ? 'vaacup_original' : 'all')
const runs = parseArg('runs', mode === 'live' ? '3' : '10')
const seed = parseArg('seed', '123')
const outDir = parseArg('out', 'tmp/tankestrom-eval')
const liveTimeoutMs = parseArg('live-timeout-ms', '60000')

if (mode === 'live') {
  const url = (process.env.VITE_TANKESTROM_ANALYZE_URL ?? '').trim()
  if (!url) {
    console.error(
      '[eval:tankestrom] live-modus krever VITE_TANKESTROM_ANALYZE_URL i env. Avbryter.'
    )
    process.exit(2)
  }
}

const extraArgs = []
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--fixture=') || a === '--fixture') continue
  if (a.startsWith('--runs=') || a === '--runs') continue
  if (a.startsWith('--seed=') || a === '--seed') continue
  if (a.startsWith('--out=') || a === '--out') continue
  if (a.startsWith('--mode=') || a === '--mode') continue
  if (a.startsWith('--live-timeout-ms=') || a === '--live-timeout-ms') continue
  extraArgs.push(a)
}

const vitestArgs = ['vitest', 'run', resolve('src/lib/tankestromEval/tankestromEvalRunner.test.ts'), '--reporter=default', ...extraArgs]

const env = {
  ...process.env,
  TANKESTROM_EVAL: '1',
  TANKESTROM_EVAL_MODE: mode,
  TANKESTROM_EVAL_FIXTURE: fixture,
  TANKESTROM_EVAL_RUNS: runs,
  TANKESTROM_EVAL_SEED: seed,
  TANKESTROM_EVAL_OUT: outDir,
  TANKESTROM_EVAL_LIVE_TIMEOUT_MS: liveTimeoutMs,
}

console.info(`[eval:tankestrom] mode=${mode} fixture=${fixture} runs=${runs} seed=${seed} out=${outDir}`)

const isWindows = process.platform === 'win32'
const child = spawn(isWindows ? 'npx.cmd' : 'npx', vitestArgs, {
  env,
  stdio: 'inherit',
  shell: isWindows,
})

child.on('error', (err) => {
  console.error('[eval:tankestrom] spawn error:', err.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
