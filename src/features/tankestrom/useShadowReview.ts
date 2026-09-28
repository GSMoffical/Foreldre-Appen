import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CanonicalPlanItem, CanonicalSchoolImportPlan } from '../../lib/canonicalSchoolImportPlan'
import type { CanonicalSchoolContentDraft } from '../../lib/canonicalSchoolTypes'
import type {
  ShadowAnalysisRun,
  ShadowCorrectedItemSnapshot,
  ShadowReviewState,
  ShadowReviewVerdict,
} from '../../lib/shadowAnalysisRunTypes'
import { emptyShadowReviewState } from '../../lib/shadowAnalysisRunTypes'
import { ensureShadowAnalysisRun, updateShadowReviewState } from '../../lib/shadowAnalysisRunApi'
import {
  collectReviewableItemIds,
  computeReviewStatus,
  getItemVerdict as getVerdict,
  setItemVerdict,
  setRunChildReview,
  withRecomputedStatus,
} from '../../lib/shadowReview'
import { addTankestromSentryBreadcrumb } from '../../lib/sentry'

export type ShadowRunStatus = 'idle' | 'creating' | 'created' | 'error'
export type ShadowSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseShadowReviewArgs {
  enabled: boolean
  plan: CanonicalSchoolImportPlan | null
  draft: CanonicalSchoolContentDraft | undefined
  importRunId: string | undefined
  childMemberId: string | null
  userId: string | null
}

export interface UseShadowReview {
  active: boolean
  runStatus: ShadowRunStatus
  saveStatus: ShadowSaveStatus
  reviewState: ShadowReviewState
  presentedItemIds: string[]
  isComplete: boolean
  getItemVerdict: (itemId: string) => ShadowReviewVerdict | undefined
  approveItem: (item: CanonicalPlanItem) => void
  rejectItem: (item: CanonicalPlanItem) => void
  correctItem: (item: CanonicalPlanItem, corrected: ShadowCorrectedItemSnapshot) => void
  approveChild: () => void
  correctChild: (correctedChildMemberId: string) => void
}

/**
 * Shadow review-hook. Oppretter ETT immutabelt analysis run etter gyldig canonical prediction
 * (FØR review), og eier den mutable review_state. Muterer aldri predictionSnapshot. Idempotent
 * pr (userId, importRunId) — StrictMode/rerender/retry gir ikke duplikat (ref-guard + DB UNIQUE).
 * Vanlig import er upåvirket; hooken gjør ingenting når `enabled=false`.
 */
export function useShadowReview(args: UseShadowReviewArgs): UseShadowReview {
  const { enabled, plan, draft, importRunId, childMemberId, userId } = args
  const planReady = !!plan && plan.days.length > 0
  const active = enabled && planReady

  const [runStatus, setRunStatus] = useState<ShadowRunStatus>('idle')
  const [saveStatus, setSaveStatus] = useState<ShadowSaveStatus>('idle')
  const [run, setRun] = useState<ShadowAnalysisRun | null>(null)
  const [reviewState, setReviewState] = useState<ShadowReviewState>(emptyShadowReviewState())
  const [reviewStarted, setReviewStarted] = useState(false)

  const presentedItemIds = useMemo(() => (plan ? collectReviewableItemIds(plan) : []), [plan])

  // Idempotent run-creation. creationKeyRef dedupe'r innen komponentinstansen (StrictMode-trygt);
  // DB UNIQUE (user_id, importRunId) dedupe'r på tvers av sesjoner/tenant.
  const creationKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!active || !draft || !importRunId || !userId) return
    const key = `${userId}::${importRunId}`
    if (creationKeyRef.current === key) return
    creationKeyRef.current = key
    setRunStatus('creating')
    void ensureShadowAnalysisRun({
      userId,
      childMemberId,
      tankestromImportRunId: importRunId,
      predictionSnapshot: draft,
    }).then((res) => {
      if (creationKeyRef.current !== key) return // en nyere analyse tok over
      if (res.ok) {
        setRun(res.run)
        setReviewState(res.run.reviewState)
        setRunStatus('created')
        if (res.created) addTankestromSentryBreadcrumb('shadow_run_created')
      } else {
        setRunStatus('error')
      }
    })
  }, [active, draft, importRunId, userId, childMemberId])

  const persist = useCallback(
    async (next: ShadowReviewState) => {
      if (!run || !userId) return
      if (!reviewStarted) {
        setReviewStarted(true)
        addTankestromSentryBreadcrumb('shadow_review_started')
      }
      setSaveStatus('saving')
      const updated = await updateShadowReviewState(run.id, userId, next)
      if (updated) {
        setRun(updated)
        setSaveStatus('saved')
        if (updated.reviewState.status === 'reviewed') {
          addTankestromSentryBreadcrumb('shadow_review_completed')
        }
      } else {
        // Behold lokal `next` (decisions går ikke tapt); vis feil.
        setSaveStatus('error')
        addTankestromSentryBreadcrumb('shadow_review_save_failed')
      }
    },
    [run, userId, reviewStarted]
  )

  const applyItem = useCallback(
    (item: CanonicalPlanItem, verdict: ShadowReviewVerdict, corrected?: ShadowCorrectedItemSnapshot) => {
      if (runStatus !== 'created') return
      setReviewState((prev) => {
        const next = withRecomputedStatus(
          setItemVerdict(prev, { itemId: item.itemId, verdict, correctedSnapshot: corrected }),
          presentedItemIds
        )
        void persist(next)
        return next
      })
    },
    [runStatus, presentedItemIds, persist]
  )

  const approveItem = useCallback((item: CanonicalPlanItem) => applyItem(item, 'approve'), [applyItem])
  const rejectItem = useCallback((item: CanonicalPlanItem) => applyItem(item, 'reject'), [applyItem])
  const correctItem = useCallback(
    (item: CanonicalPlanItem, corrected: ShadowCorrectedItemSnapshot) => applyItem(item, 'correct', corrected),
    [applyItem]
  )

  const applyChild = useCallback(
    (childVerdict: 'approve' | 'correct', correctedChildMemberId?: string) => {
      if (runStatus !== 'created') return
      setReviewState((prev) => {
        const next = withRecomputedStatus(
          setRunChildReview(prev, { childVerdict, correctedChildMemberId }),
          presentedItemIds
        )
        void persist(next)
        return next
      })
    },
    [runStatus, presentedItemIds, persist]
  )

  const approveChild = useCallback(() => applyChild('approve'), [applyChild])
  const correctChild = useCallback((id: string) => applyChild('correct', id), [applyChild])

  const getItemVerdict = useCallback((itemId: string) => getVerdict(reviewState, itemId), [reviewState])
  const isComplete = computeReviewStatus(reviewState, presentedItemIds) === 'reviewed'

  return {
    active,
    runStatus,
    saveStatus,
    reviewState,
    presentedItemIds,
    isComplete,
    getItemVerdict,
    approveItem,
    rejectItem,
    correctItem,
    approveChild,
    correctChild,
  }
}
