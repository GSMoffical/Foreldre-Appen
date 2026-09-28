import { describe, expect, it } from 'vitest'
import type { CanonicalPlanDay, CanonicalPlanItem, CanonicalSchoolImportPlan } from '../canonicalSchoolImportPlan'
import { emptyShadowReviewState } from '../shadowAnalysisRunTypes'
import {
  buildCorrectedItemSnapshot,
  collectReviewableItemIds,
  computeReviewStatus,
  setItemVerdict,
  setRunChildReview,
  withRecomputedStatus,
} from '../shadowReview'

const fixedNow = () => '2026-06-16T10:00:00Z'

function item(over: Partial<CanonicalPlanItem> = {}): CanonicalPlanItem {
  return {
    itemId: 'it-1', sourceId: 's-1', sourceRef: null, placement: 'subject', contentType: 'lesson',
    subjectKey: 'matematikk', start: '10:35', end: '11:35', audienceEntries: [], lines: ['Forberedelse'],
    reviewRequired: false, ...over,
  }
}

function day(over: Partial<CanonicalPlanDay> = {}): CanonicalPlanDay {
  return {
    weekday: 1, dayLabel: 'Tirsdag', op: 'none', note: null,
    timetable: [], replacement: null, unplacedSubjectGroups: [], audienceItems: [], generalMessages: [],
    reviewRequired: false, ...over,
  }
}

function plan(days: CanonicalPlanDay[]): CanonicalSchoolImportPlan {
  return { personId: 'stellan', structureStatus: 'complete', days }
}

describe('collectReviewableItemIds — alle presenterte lag, deduplisert', () => {
  it('samler subject (timetable), unplaced, audience og general', () => {
    const p = plan([
      day({
        timetable: [{ key: 'r1', label: 'Matte', start: '10:35', end: '11:35', items: [item({ itemId: 'a' })] }],
        unplacedSubjectGroups: [{ label: 'Tysk', items: [item({ itemId: 'b' })] }],
        audienceItems: [item({ itemId: 'c', placement: 'audience' })],
        generalMessages: [item({ itemId: 'd', placement: 'day' })],
      }),
    ])
    expect(collectReviewableItemIds(p).sort()).toEqual(['a', 'b', 'c', 'd'])
  })
  it('dedupliserer på itemId', () => {
    const p = plan([
      day({ timetable: [{ key: 'r', label: 'M', start: '1', end: '2', items: [item({ itemId: 'x' })] }], generalMessages: [item({ itemId: 'x', placement: 'day' })] }),
    ])
    expect(collectReviewableItemIds(p)).toEqual(['x'])
  })
})

describe('setItemVerdict — maks én review per itemId, komplett correctedSnapshot', () => {
  it('approve legger til review', () => {
    const s = setItemVerdict(emptyShadowReviewState(), { itemId: 'a', verdict: 'approve' }, fixedNow)
    expect(s.itemReviews).toEqual([{ itemId: 'a', verdict: 'approve', reviewedAt: '2026-06-16T10:00:00Z' }])
  })
  it('ny beslutning ERSTATTER (ingen duplikat)', () => {
    let s = setItemVerdict(emptyShadowReviewState(), { itemId: 'a', verdict: 'approve' }, fixedNow)
    s = setItemVerdict(s, { itemId: 'a', verdict: 'reject' }, fixedNow)
    expect(s.itemReviews).toHaveLength(1)
    expect(s.itemReviews[0]!.verdict).toBe('reject')
  })
  it('correct lagrer KOMPLETT snapshot', () => {
    const corrected = buildCorrectedItemSnapshot(item({ lines: ['Rettet tekst'], start: '11:00' }))
    const s = setItemVerdict(emptyShadowReviewState(), { itemId: 'a', verdict: 'correct', correctedSnapshot: corrected }, fixedNow)
    expect(s.itemReviews[0]!.correctedSnapshot).toEqual({ contentType: 'lesson', subjectKey: 'matematikk', lines: ['Rettet tekst'], start: '11:00', end: '11:35' })
  })
  it('correct uten snapshot kaster', () => {
    expect(() => setItemVerdict(emptyShadowReviewState(), { itemId: 'a', verdict: 'correct' }, fixedNow)).toThrow()
  })
  it('muterer ikke input-state', () => {
    const s0 = emptyShadowReviewState()
    const snap = JSON.parse(JSON.stringify(s0))
    setItemVerdict(s0, { itemId: 'a', verdict: 'approve' }, fixedNow)
    expect(s0).toEqual(snap)
  })
})

describe('setRunChildReview', () => {
  it('approve', () => {
    const s = setRunChildReview(emptyShadowReviewState(), { childVerdict: 'approve' }, fixedNow)
    expect(s.runReview).toEqual({ childVerdict: 'approve', reviewedAt: '2026-06-16T10:00:00Z' })
  })
  it('correct m/ valgt barn', () => {
    const s = setRunChildReview(emptyShadowReviewState(), { childVerdict: 'correct', correctedChildMemberId: 'ida' }, fixedNow)
    expect(s.runReview).toEqual({ childVerdict: 'correct', correctedChildMemberId: 'ida', reviewedAt: '2026-06-16T10:00:00Z' })
  })
})

describe('computeReviewStatus — konservativ completion (Del 13)', () => {
  const ids = ['a', 'b']
  it('pending uten child-review', () => {
    let s = setItemVerdict(emptyShadowReviewState(), { itemId: 'a', verdict: 'approve' }, fixedNow)
    s = setItemVerdict(s, { itemId: 'b', verdict: 'approve' }, fixedNow)
    expect(computeReviewStatus(s, ids)).toBe('pending')
  })
  it('pending når et item mangler verdict', () => {
    let s = setRunChildReview(emptyShadowReviewState(), { childVerdict: 'approve' }, fixedNow)
    s = setItemVerdict(s, { itemId: 'a', verdict: 'approve' }, fixedNow)
    expect(computeReviewStatus(s, ids)).toBe('pending')
  })
  it('pending når child correct uten valgt barn', () => {
    let s = setRunChildReview(emptyShadowReviewState(), { childVerdict: 'correct', correctedChildMemberId: null }, fixedNow)
    s = setItemVerdict(s, { itemId: 'a', verdict: 'approve' }, fixedNow)
    s = setItemVerdict(s, { itemId: 'b', verdict: 'approve' }, fixedNow)
    expect(computeReviewStatus(s, ids)).toBe('pending')
  })
  it('reviewed når child + alle items er vurdert', () => {
    let s = setRunChildReview(emptyShadowReviewState(), { childVerdict: 'approve' }, fixedNow)
    s = setItemVerdict(s, { itemId: 'a', verdict: 'approve' }, fixedNow)
    s = setItemVerdict(s, { itemId: 'b', verdict: 'reject' }, fixedNow)
    expect(computeReviewStatus(s, ids)).toBe('reviewed')
    expect(withRecomputedStatus(s, ids).status).toBe('reviewed')
  })
  it('reviewed med tom item-liste + child approve', () => {
    const s = setRunChildReview(emptyShadowReviewState(), { childVerdict: 'approve' }, fixedNow)
    expect(computeReviewStatus(s, [])).toBe('reviewed')
  })
})
