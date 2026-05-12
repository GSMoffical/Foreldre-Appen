#!/usr/bin/env node
/**
 * Tankestrom fixture-eval (deterministisk, uten live analyse-API).
 *
 *   npm run eval:tankestrom -- --fixture=all --runs=20 --seed=123
 *
 * Output under tmp/tankestrom-eval/ (konfigurerbart med TANKESTROM_EVAL_OUT):
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

const fixture = parseArg('fixture', 'all')
const runs = parseArg('runs', '10')
const seed = parseArg('seed', '123')
const outDir = parseArg('out', 'tmp/tankestrom-eval')

const extraArgs = []
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--fixture=') || a === '--fixture') continue
  if (a.startsWith('--runs=') || a === '--runs') continue
  if (a.startsWith('--seed=') || a === '--seed') continue
  if (a.startsWith('--out=') || a === '--out') continue
  extraArgs.push(a)
}

const vitestArgs = ['vitest', 'run', resolve('src/lib/tankestromEval/tankestromEvalRunner.test.ts'), '--reporter=default', ...extraArgs]

const env = {
  ...process.env,
  TANKESTROM_EVAL: '1',
  TANKESTROM_EVAL_FIXTURE: fixture,
  TANKESTROM_EVAL_RUNS: runs,
  TANKESTROM_EVAL_SEED: seed,
  TANKESTROM_EVAL_OUT: outDir,
}

console.info(`[eval:tankestrom] fixture=${fixture} runs=${runs} seed=${seed} out=${outDir}`)

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
