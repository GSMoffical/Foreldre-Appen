// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor, act } from '@testing-library/react'
import type { CanonicalPlanItem, CanonicalSchoolImportPlan } from '../../../lib/canonicalSchoolImportPlan'
import type { CanonicalSchoolContentDraft } from '../../../lib/canonicalSchoolTypes'
import type { ShadowAnalysisRun } from '../../../lib/shadowAnalysisRunTypes'
import { emptyShadowReviewState } from '../../../lib/shadowAnalysisRunTypes'

const api = vi.hoisted(() => ({
  ensure: vi.fn(),
  update: vi.fn(),
}))
vi.mock('../../../lib/shadowAnalysisRunApi', () => ({
  ensureShadowAnalysisRun: api.ensure,
  updateShadowReviewState: api.update,
}))
// Sentry breadcrumbs — no-op i test
vi.mock('../../../lib/sentry', () => ({ addTankestromSentryBreadcrumb: vi.fn() }))

import { useShadowReview } from '../useShadowReview'

const draft = { schemaVersion: '1.0.0', days: [{}] } as unknown as CanonicalSchoolContentDraft

function item(id: string): CanonicalPlanItem {
  return {
    itemId: id, sourceId: id, sourceRef: null, placement: 'subject', contentType: 'lesson',
    subjectKey: 'matematikk', start: '10:35', end: '11:35', audienceEntries: [], lines: ['x'], reviewRequired: false,
  }
}
const plan: CanonicalSchoolImportPlan = {
  personId: 'stellan', structureStatus: 'complete',
  days: [{ weekday: 1, dayLabel: 'Tir', op: 'none', note: null, timetable: [{ key: 'r', label: 'M', start: '1', end: '2', items: [item('a')] }], replacement: null, unplacedSubjectGroups: [], audienceItems: [], generalMessages: [], reviewRequired: false }],
}

function runFixture(): ShadowAnalysisRun {
  return {
    id: 'run-1', userId: 'u1', childMemberId: 'stellan', tankestromImportRunId: 'run-abc',
    schemaVersion: '1.0.0', predictionSnapshot: draft, reviewState: emptyShadowReviewState(),
    createdAt: 't', updatedAt: 't',
  }
}

const baseArgs = { enabled: true, plan, draft, importRunId: 'run-abc', childMemberId: 'stellan', userId: 'u1' }

beforeEach(() => {
  api.ensure.mockReset()
  api.update.mockReset()
  api.ensure.mockResolvedValue({ ok: true, run: runFixture(), created: true })
  api.update.mockImplementation((_id: string, _uid: string, rs: unknown) =>
    Promise.resolve({ ...runFixture(), reviewState: rs })
  )
})
afterEach(cleanup)

describe('useShadowReview — run creation', () => {
  it('Shadow OFF → ingen run opprettes', async () => {
    const { result } = renderHook(() => useShadowReview({ ...baseArgs, enabled: false }))
    await waitFor(() => expect(result.current.runStatus).toBe('idle'))
    expect(api.ensure).not.toHaveBeenCalled()
  })

  it('ON + gyldig plan → ett run; rerender dupliserer ikke', async () => {
    const { result, rerender } = renderHook(() => useShadowReview(baseArgs))
    await waitFor(() => expect(result.current.runStatus).toBe('created'))
    rerender()
    rerender()
    await waitFor(() => expect(result.current.runStatus).toBe('created'))
    expect(api.ensure).toHaveBeenCalledTimes(1)
  })

  it('run-create feiler → runStatus error (preview krasjer ikke)', async () => {
    api.ensure.mockResolvedValue({ ok: false, reason: 'create_failed' })
    const { result } = renderHook(() => useShadowReview(baseArgs))
    await waitFor(() => expect(result.current.runStatus).toBe('error'))
  })
})

describe('useShadowReview — review + persist', () => {
  it('approve item persisterer og setter saved', async () => {
    const { result } = renderHook(() => useShadowReview(baseArgs))
    await waitFor(() => expect(result.current.runStatus).toBe('created'))
    act(() => result.current.approveItem(item('a')))
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'))
    expect(api.update).toHaveBeenCalledTimes(1)
    expect(result.current.getItemVerdict('a')).toBe('approve')
  })

  it('save-feil: saveStatus error, men lokal decision beholdes', async () => {
    api.update.mockResolvedValue(null) // save feiler
    const { result } = renderHook(() => useShadowReview(baseArgs))
    await waitFor(() => expect(result.current.runStatus).toBe('created'))
    act(() => result.current.rejectItem(item('a')))
    await waitFor(() => expect(result.current.saveStatus).toBe('error'))
    expect(result.current.getItemVerdict('a')).toBe('reject') // ikke tapt
  })

  it('completion: child approve + item approve → isComplete', async () => {
    const { result } = renderHook(() => useShadowReview(baseArgs))
    await waitFor(() => expect(result.current.runStatus).toBe('created'))
    act(() => result.current.approveChild())
    act(() => result.current.approveItem(item('a')))
    await waitFor(() => expect(result.current.isComplete).toBe(true))
  })
})
