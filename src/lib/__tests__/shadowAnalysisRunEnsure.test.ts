import { describe, expect, it, vi, beforeEach } from 'vitest'
import { parseCanonicalSchoolContentDraft } from '../canonicalSchoolParse'
import type { CanonicalSchoolContentDraft } from '../canonicalSchoolTypes'

const h = vi.hoisted(() => ({
  state: {
    insertResult: { data: null as unknown, error: null as unknown },
    maybeSingleResult: { data: null as unknown, error: null as unknown },
    fromCalls: 0,
  },
}))

vi.mock('../supabaseClient', () => {
  const makeChain = () => {
    let mode: 'select' | 'insert' | 'update' = 'select'
    const c = {
      insert() { mode = 'insert'; return c },
      update() { mode = 'update'; return c },
      select() { return c },
      eq() { return c },
      single() { return Promise.resolve(mode === 'insert' ? h.state.insertResult : h.state.maybeSingleResult) },
      maybeSingle() { return Promise.resolve(h.state.maybeSingleResult) },
    }
    return c
  }
  return { supabase: { from() { h.state.fromCalls += 1; return makeChain() } } }
})

import { buildShadowAnalysisRunInsert, ensureShadowAnalysisRun } from '../shadowAnalysisRunApi'

const draft: CanonicalSchoolContentDraft = parseCanonicalSchoolContentDraft({
  schemaVersion: '1.0.0', sourceTitle: 'x', originalSourceType: 'school_activity_plan',
  personId: 'stellan', personMatchStatus: 'matched', classCode: '2STC', structureStatus: 'complete',
  reviewFlags: [], days: [{ dayId: 'd1', weekdayIndex: '1', dayOperation: { op: 'none' }, dayResolution: 'enrich_only', subjectItems: [], audienceItems: [], generalDayMessages: [] }],
})!

function row() {
  const ins = buildShadowAnalysisRunInsert({ userId: 'u1', childMemberId: 'stellan', tankestromImportRunId: 'run-abc', predictionSnapshot: draft }) as unknown as Record<string, unknown>
  return {
    id: 'run-1', user_id: 'u1', child_member_id: 'stellan', tankestrom_import_run_id: 'run-abc',
    schema_version: '1.0.0', prediction_snapshot: JSON.parse(JSON.stringify(ins.prediction_snapshot)),
    review_state: JSON.parse(JSON.stringify(ins.review_state)), created_at: 't', updated_at: 't',
  }
}

const input = { userId: 'u1', childMemberId: 'stellan', tankestromImportRunId: 'run-abc', predictionSnapshot: draft }

beforeEach(() => {
  h.state.insertResult = { data: null, error: null }
  h.state.maybeSingleResult = { data: null, error: null }
  h.state.fromCalls = 0
})

describe('ensureShadowAnalysisRun — idempotens', () => {
  it('ny: insert lykkes → created=true', async () => {
    h.state.insertResult = { data: row(), error: null }
    const res = await ensureShadowAnalysisRun(input)
    expect(res).toMatchObject({ ok: true, created: true })
    if (res.ok) expect(res.run.tankestromImportRunId).toBe('run-abc')
  })

  it('duplikat (23505) → henter eksisterende, created=false', async () => {
    h.state.insertResult = { data: null, error: { code: '23505', message: 'duplicate key' } }
    h.state.maybeSingleResult = { data: row(), error: null }
    const res = await ensureShadowAnalysisRun(input)
    expect(res).toMatchObject({ ok: true, created: false })
    if (res.ok) expect(res.run.id).toBe('run-1')
  })

  it('annen DB-feil skjules ALDRI som idempotens → create_failed', async () => {
    h.state.insertResult = { data: null, error: { code: '23502', message: 'not null violation' } }
    const res = await ensureShadowAnalysisRun(input)
    expect(res).toEqual({ ok: false, reason: 'create_failed' })
  })

  it('23505 men ingen eksisterende funnet → create_failed (skjuler ikke)', async () => {
    h.state.insertResult = { data: null, error: { code: '23505', message: 'duplicate key' } }
    h.state.maybeSingleResult = { data: null, error: null }
    const res = await ensureShadowAnalysisRun(input)
    expect(res).toEqual({ ok: false, reason: 'create_failed' })
  })
})
