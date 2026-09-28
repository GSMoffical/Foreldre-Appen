import { describe, expect, it, vi, beforeEach } from 'vitest'
import { parseCanonicalSchoolContentDraft } from '../canonicalSchoolParse'
import type { CanonicalSchoolContentDraft } from '../canonicalSchoolTypes'

// Chainable Supabase-mock (fanger insert/update-payload; returnerer forhåndssatt rad).
const h = vi.hoisted(() => ({
  state: { table: '' as string, insertArg: null as unknown, updateArg: null as unknown, resultRow: null as unknown },
}))
vi.mock('../supabaseClient', () => {
  const chain = {
    insert(a: unknown) { h.state.insertArg = a; return chain },
    update(a: unknown) { h.state.updateArg = a; return chain },
    select() { return chain },
    eq() { return chain },
    single() { return Promise.resolve({ data: h.state.resultRow, error: null }) },
  }
  return { supabase: { from(t: string) { h.state.table = t; return chain } } }
})

import {
  buildShadowAnalysisRunInsert,
  mapShadowAnalysisRunRow,
  createShadowAnalysisRun,
  updateShadowReviewState,
  type ShadowAnalysisRunRow,
} from '../shadowAnalysisRunApi'
import { SHADOW_ANALYSIS_RUN_SCHEMA_VERSION, type ShadowReviewState } from '../shadowAnalysisRunTypes'

// Normalisert draft (idempotent under parse → trygg for roundtrip-sammenligning).
const draft: CanonicalSchoolContentDraft = parseCanonicalSchoolContentDraft({
  schemaVersion: '1.0.0',
  sourceTitle: 'Ukeplan uke 25',
  originalSourceType: 'school_activity_plan',
  personId: 'stellan',
  personMatchStatus: 'matched',
  classCode: '2STC',
  structureStatus: 'complete',
  reviewFlags: [],
  days: [
    {
      dayId: 'd1', date: '2026-06-16', weekdayIndex: '1', dayOperation: { op: 'none' }, dayResolution: 'enrich_only',
      subjectItems: [{ itemId: 'c1', sourceId: 's1', subjectKey: 'matematikk', sourceText: 'Forberedelsesdag', placement: 'subject', contentType: 'lesson' }],
      audienceItems: [], generalDayMessages: [], reviewFlags: [],
    },
  ],
})!

function rowFrom(insertArg: Record<string, unknown>, over: Partial<ShadowAnalysisRunRow> = {}): ShadowAnalysisRunRow {
  return {
    id: 'run-1',
    user_id: insertArg.user_id as string,
    child_member_id: (insertArg.child_member_id ?? null) as string | null,
    tankestrom_import_run_id: insertArg.tankestrom_import_run_id as string,
    schema_version: insertArg.schema_version as string,
    // Simulerer JSONB tur/retur:
    prediction_snapshot: JSON.parse(JSON.stringify(insertArg.prediction_snapshot)),
    review_state: JSON.parse(JSON.stringify(insertArg.review_state)),
    created_at: '2026-06-16T10:00:00Z',
    updated_at: '2026-06-16T10:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  h.state.table = ''
  h.state.insertArg = null
  h.state.updateArg = null
  h.state.resultRow = null
})

describe('buildShadowAnalysisRunInsert', () => {
  it('setter schemaVersion, tomt pending review_state, bevarer importRunId + snapshot', () => {
    const ins = buildShadowAnalysisRunInsert({
      userId: 'u1', childMemberId: 'stellan', tankestromImportRunId: 'run-abc', predictionSnapshot: draft,
    })
    expect(ins.schema_version).toBe(SHADOW_ANALYSIS_RUN_SCHEMA_VERSION)
    expect(ins.tankestrom_import_run_id).toBe('run-abc')
    expect(ins.review_state).toEqual({ status: 'pending', itemReviews: [] })
    expect(ins.prediction_snapshot).toBe(draft) // ikke kopiert/mutert
  })

  it('nullable/uavklart barn håndteres', () => {
    const ins = buildShadowAnalysisRunInsert({ userId: 'u1', childMemberId: null, tankestromImportRunId: 'r', predictionSnapshot: draft })
    expect(ins.child_member_id).toBeNull()
  })
})

describe('mapShadowAnalysisRunRow — JSON-roundtrip', () => {
  it('bevarer snapshot uendret gjennom JSONB tur/retur (idempotent parse)', () => {
    const ins = buildShadowAnalysisRunInsert({ userId: 'u1', childMemberId: 'stellan', tankestromImportRunId: 'run-abc', predictionSnapshot: draft })
    const row = rowFrom(ins as unknown as Record<string, unknown>)
    const run = mapShadowAnalysisRunRow(row)!
    expect(run.predictionSnapshot).toEqual(draft)
    expect(run.tankestromImportRunId).toBe('run-abc')
    expect(run.schemaVersion).toBe('1.0.0')
    expect(run.reviewState).toEqual({ status: 'pending', itemReviews: [] })
    expect(run.childMemberId).toBe('stellan')
  })

  it('ugyldig snapshot → null (ingen krasj)', () => {
    const row = rowFrom(
      buildShadowAnalysisRunInsert({ userId: 'u1', childMemberId: null, tankestromImportRunId: 'r', predictionSnapshot: draft }) as unknown as Record<string, unknown>,
      { prediction_snapshot: { schemaVersion: '1.0.0', days: 'ugyldig' } }
    )
    expect(mapShadowAnalysisRunRow(row)).toBeNull()
  })

  it('normaliserer manglende/ugyldig review_state til pending', () => {
    const row = rowFrom(
      buildShadowAnalysisRunInsert({ userId: 'u1', childMemberId: null, tankestromImportRunId: 'r', predictionSnapshot: draft }) as unknown as Record<string, unknown>,
      { review_state: null }
    )
    expect(mapShadowAnalysisRunRow(row)!.reviewState).toEqual({ status: 'pending', itemReviews: [] })
  })
})

describe('createShadowAnalysisRun (mock Supabase)', () => {
  it('skriver til analysis_runs og returnerer mappet run', async () => {
    const input = { userId: 'u1', childMemberId: 'stellan', tankestromImportRunId: 'run-abc', predictionSnapshot: draft }
    h.state.resultRow = rowFrom(buildShadowAnalysisRunInsert(input) as unknown as Record<string, unknown>)
    const run = await createShadowAnalysisRun(input)
    expect(h.state.table).toBe('analysis_runs')
    expect(run?.tankestromImportRunId).toBe('run-abc')
    // importRunId kom fra input, ikke regenerert:
    expect((h.state.insertArg as Record<string, unknown>).tankestrom_import_run_id).toBe('run-abc')
  })
})

describe('updateShadowReviewState — snapshot er immutable via API', () => {
  it('sender KUN review_state (aldri prediction_snapshot/importRunId/schema)', async () => {
    const ins = buildShadowAnalysisRunInsert({ userId: 'u1', childMemberId: 'stellan', tankestromImportRunId: 'run-abc', predictionSnapshot: draft })
    const reviewed: ShadowReviewState = {
      status: 'reviewed',
      runReview: { childVerdict: 'approve', reviewedAt: '2026-06-16T11:00:00Z' },
      itemReviews: [{ itemId: 'c1', verdict: 'approve', reviewedAt: '2026-06-16T11:00:00Z' }],
    }
    h.state.resultRow = rowFrom(ins as unknown as Record<string, unknown>, { review_state: JSON.parse(JSON.stringify(reviewed)) })
    const run = await updateShadowReviewState('run-1', 'u1', reviewed)

    const payload = h.state.updateArg as Record<string, unknown>
    expect(Object.keys(payload)).toEqual(['review_state']) // ingen prediction_snapshot
    expect('prediction_snapshot' in payload).toBe(false)
    expect('tankestrom_import_run_id' in payload).toBe(false)
    expect('schema_version' in payload).toBe(false)
    // Snapshot uendret ved readback; review oppdatert:
    expect(run?.predictionSnapshot).toEqual(draft)
    expect(run?.reviewState.status).toBe('reviewed')
    expect(run?.reviewState.runReview?.childVerdict).toBe('approve')
  })
})
