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
import { readTankestromScheduleDetailsFromMetadata } from '../tankestromScheduleDetails'
import {
  assertVaacupOriginalInvariants,
  dayKeyFromDateForVaacup,
  formatVaacupInvariantViolations,
  type VaacupNormalizedDay,
} from '../tankestromVaacupInvariants'
import type { EmbeddedScheduleSegment, EventMetadata } from '../../types'
import { parseEmbeddedScheduleFromMetadata } from '../embeddedSchedule'

const DEFAULT_QUICK_RUNS = 5
const ENV_RUNS = process.env.VAACUP_SOAK_RUNS
const ENV_FIXTURE = process.env.VAACUP_SOAK_FIXTURE ?? 'vaacup_original'
const ENV_MODEL = process.env.VAACUP_SOAK_MODEL ?? 'fixture-mutation'
const ENV_SEED = process.env.VAACUP_SOAK_SEED
const RUNS = ENV_RUNS ? Math.max(1, Math.floor(Number(ENV_RUNS))) : DEFAULT_QUICK_RUNS
const SOAK_OUTPUT_DIR = resolve(process.cwd(), 'tmp', 'tankestrom-soak')

function buildCanonicalVaacupSegments(): EmbeddedScheduleSegment[] {
  return [
    {
      date: '2026-06-12',
      title: 'Fredag',
      start: '17:45',
      end: '19:00',
      notes: 'Oppmøte kl. 17:45 ved kunstgressbanen. Første kamp starter 18:40.',
      tankestromHighlights: [
        { time: '17:45', label: 'Oppmøte', type: 'meeting' },
        { time: '18:40', label: 'Første kamp', type: 'match' },
      ],
    },
    {
      date: '2026-06-13',
      title: 'Lørdag',
      start: '08:35',
      end: '16:00',
      notes:
        'Oppmøte før første kamp kl. 08:35. Første kamp 09:20. Oppmøte før andre kamp 14:25. Andre kamp 15:10.',
      tankestromHighlights: [
        { time: '08:35', label: 'Oppmøte før første kamp', type: 'meeting' },
        { time: '09:20', label: 'Første kamp', type: 'match' },
        { time: '14:25', label: 'Oppmøte før andre kamp', type: 'meeting' },
        { time: '15:10', label: 'Andre kamp', type: 'match' },
      ],
    },
    {
      date: '2026-06-14',
      title: 'Søndag',
      isConditional: true,
      notes: 'Program for søndag avhenger av plassering etter lørdagens kamper.',
      tankestromHighlights: [],
    },
  ]
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type MutationKind =
  | 'noop'
  | 'fredag_drop_oppmote_highlight'
  | 'fredag_segment_start_18_40'
  | 'lordag_mislabel_kamp_as_oppmote'
  | 'lordag_first_kamp_at_second_slot'
  | 'sondag_leak_1745_oppmote'
  | 'sondag_synthetic_oppmote_label'
  | 'fredag_drop_all_highlights'

type Mutation = { kind: MutationKind; segments: EmbeddedScheduleSegment[] }

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function applyMutation(seed: number, base: EmbeddedScheduleSegment[]): Mutation {
  const rng = mulberry32(seed)
  const r = rng()
  const segments = clone(base)
  if (r < 0.1) return { kind: 'noop', segments }
  if (r < 0.25) {
    const fre = segments.find((s) => s.date === '2026-06-12')
    if (fre?.tankestromHighlights) {
      fre.tankestromHighlights = fre.tankestromHighlights.filter((h) => h.time !== '17:45')
    }
    return { kind: 'fredag_drop_oppmote_highlight', segments }
  }
  if (r < 0.35) {
    const fre = segments.find((s) => s.date === '2026-06-12')
    if (fre) {
      fre.start = '18:40'
      if (fre.tankestromHighlights) fre.tankestromHighlights = []
    }
    return { kind: 'fredag_segment_start_18_40', segments }
  }
  if (r < 0.5) {
    const lor = segments.find((s) => s.date === '2026-06-13')
    if (lor?.tankestromHighlights) {
      lor.tankestromHighlights = [
        { time: '08:35', label: 'Oppmøte før første kamp', type: 'meeting' },
        { time: '09:20', label: 'Oppmøte', type: 'meeting' },
        { time: '14:25', label: 'Oppmøte', type: 'meeting' },
        { time: '15:10', label: 'Første kamp', type: 'match' },
      ]
    }
    return { kind: 'lordag_mislabel_kamp_as_oppmote', segments }
  }
  if (r < 0.6) {
    const lor = segments.find((s) => s.date === '2026-06-13')
    if (lor?.tankestromHighlights) {
      lor.tankestromHighlights = lor.tankestromHighlights.map((h) =>
        h.time === '15:10' ? { ...h, label: 'Første kamp', type: 'match' } : h
      )
    }
    return { kind: 'lordag_first_kamp_at_second_slot', segments }
  }
  if (r < 0.75) {
    const son = segments.find((s) => s.date === '2026-06-14')
    if (son) {
      son.start = '17:45'
      son.tankestromHighlights = [{ time: '17:45', label: 'Oppmøte', type: 'meeting' }]
    }
    return { kind: 'sondag_leak_1745_oppmote', segments }
  }
  if (r < 0.85) {
    const son = segments.find((s) => s.date === '2026-06-14')
    if (son) {
      son.notes = 'Oppmøte sannsynligvis sent på dagen.'
      son.tankestromHighlights = [{ time: '17:00', label: 'Oppmøte', type: 'meeting' }]
    }
    return { kind: 'sondag_synthetic_oppmote_label', segments }
  }
  const fre = segments.find((s) => s.date === '2026-06-12')
  if (fre) fre.tankestromHighlights = []
  return { kind: 'fredag_drop_all_highlights', segments }
}

function buildMetadataFromSegments(segments: EmbeddedScheduleSegment[]): EventMetadata {
  return { isArrangementParent: true, embeddedSchedule: segments } as unknown as EventMetadata
}

function normalizeAllDays(metadata: EventMetadata): VaacupNormalizedDay[] {
  const parsed = parseEmbeddedScheduleFromMetadata(metadata)
  const days: VaacupNormalizedDay[] = []
  for (const seg of parsed) {
    const dayKey = dayKeyFromDateForVaacup(seg.date)
    if (!dayKey) continue
    const segMetadata: EventMetadata = {
      tankestromHighlights: seg.tankestromHighlights,
      tankestromNotes: seg.tankestromNotes,
      bringItems: seg.bringItems,
      packingItems: seg.packingItems,
      timeWindowCandidates: seg.timeWindowCandidates,
    }
    const normalized = readTankestromScheduleDetailsFromMetadata(segMetadata, [seg.title], {
      fallbackStartTime: seg.start,
      sourceTextForValidation: seg.notes,
      isConditionalSegment: seg.isConditional === true,
    })
    days.push({
      date: seg.date,
      dayKey,
      highlights: normalized.highlights,
      notes: normalized.notes,
      start: seg.start,
      end: seg.end,
      isConditional: seg.isConditional,
    })
  }
  return days
}

type RunResult = {
  run: number
  seed: number
  mutation: MutationKind
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
      const mutation = applyMutation(seed, base)
      const metadata = buildMetadataFromSegments(mutation.segments)
      const days = normalizeAllDays(metadata)
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
  _kind: MutationKind,
  _violations: ReturnType<typeof assertVaacupOriginalInvariants>
): boolean {
  return false
}
