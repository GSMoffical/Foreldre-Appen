import type { CanonicalPlanItem, CanonicalSchoolImportPlan } from './canonicalSchoolImportPlan'
import type {
  ShadowCorrectedItemSnapshot,
  ShadowItemReview,
  ShadowReviewState,
  ShadowReviewVerdict,
} from './shadowAnalysisRunTypes'

/**
 * Ren, React-fri logikk for Shadow-review. Muterer aldri input. `predictionSnapshot` røres ALDRI her
 * — all ground truth legges i `ShadowReviewState`.
 *
 * VIKTIG (Del 13): `reviewed` betyr «predikert barn + alle PRESENTERTE item-fakta er human-reviewet»,
 * IKKE at hele dokumentet (dato/weekday/dayOperation = eget, ikke-reviewet lag) er bevist korrekt.
 */

const nowIso = () => new Date().toISOString()

/**
 * Alle reviewbare items brukeren faktisk presenteres for i planen — på tvers av timeplan-økter,
 * uplasserte faggrupper, audience-items og generelle dagsbeskjeder. Deduplisert på `itemId`
 * (stabil review-identitet). Day-level semantikk (dato/weekday/dayOperation) er IKKE items.
 */
export function collectReviewablePlanItems(plan: CanonicalSchoolImportPlan): CanonicalPlanItem[] {
  const seen = new Set<string>()
  const out: CanonicalPlanItem[] = []
  const push = (item: CanonicalPlanItem) => {
    if (seen.has(item.itemId)) return
    seen.add(item.itemId)
    out.push(item)
  }
  for (const day of plan.days) {
    for (const row of day.timetable) for (const it of row.items) push(it)
    for (const g of day.unplacedSubjectGroups) for (const it of g.items) push(it)
    for (const it of day.audienceItems) push(it)
    for (const it of day.generalMessages) push(it)
  }
  return out
}

export function collectReviewableItemIds(plan: CanonicalSchoolImportPlan): string[] {
  return collectReviewablePlanItems(plan).map((i) => i.itemId)
}

/**
 * Seeder «Rett»-editoren fra prediksjonen — KOMPLETT whitelist av bruker-reviewbare semantiske felt.
 * Ingen metadata/identitet (itemId/sourceId/sourceRef/evidence/confidence/reviewFlags/placement).
 */
export function buildCorrectedItemSnapshot(item: CanonicalPlanItem): ShadowCorrectedItemSnapshot {
  return {
    contentType: item.contentType,
    subjectKey: item.subjectKey,
    lines: [...item.lines],
    start: item.start,
    end: item.end,
  }
}

/** Nåværende verdict for et item, eller undefined om ikke reviewet. */
export function getItemVerdict(state: ShadowReviewState, itemId: string): ShadowReviewVerdict | undefined {
  return state.itemReviews.find((r) => r.itemId === itemId)?.verdict
}

/**
 * Setter/erstatter review for ETT item (maks én aktiv review per itemId — ny beslutning oppdaterer,
 * lager aldri duplikat). Ved `correct` MÅ `correctedSnapshot` gis. Returnerer ny state (immutabel).
 */
export function setItemVerdict(
  state: ShadowReviewState,
  input: { itemId: string; dayId?: string; verdict: ShadowReviewVerdict; correctedSnapshot?: ShadowCorrectedItemSnapshot },
  now: () => string = nowIso
): ShadowReviewState {
  if (input.verdict === 'correct' && !input.correctedSnapshot) {
    throw new Error('setItemVerdict: correct krever correctedSnapshot')
  }
  const review: ShadowItemReview = {
    itemId: input.itemId,
    ...(input.dayId ? { dayId: input.dayId } : {}),
    verdict: input.verdict,
    ...(input.verdict === 'correct' ? { correctedSnapshot: input.correctedSnapshot } : {}),
    reviewedAt: now(),
  }
  const itemReviews = [
    ...state.itemReviews.filter((r) => r.itemId !== input.itemId),
    review,
  ]
  return { ...state, itemReviews }
}

/** Setter run-level barnereview (Del 7). Muterer ALDRI predictionSnapshot.personId. */
export function setRunChildReview(
  state: ShadowReviewState,
  input: { childVerdict: 'approve' | 'correct'; correctedChildMemberId?: string | null },
  now: () => string = nowIso
): ShadowReviewState {
  return {
    ...state,
    runReview: {
      childVerdict: input.childVerdict,
      ...(input.childVerdict === 'correct' ? { correctedChildMemberId: input.correctedChildMemberId ?? null } : {}),
      reviewedAt: now(),
    },
  }
}

/** Run-level barnereview fullført? (approve, eller correct m/ valgt barn). */
export function isChildReviewComplete(state: ShadowReviewState): boolean {
  const r = state.runReview
  if (!r) return false
  if (r.childVerdict === 'approve') return true
  // correct: et konkret barn må være valgt som ground truth
  return typeof r.correctedChildMemberId === 'string' && r.correctedChildMemberId.length > 0
}

/**
 * Konservativ completion (Del 13): `reviewed` KUN når (1) run-level child review er fullført OG
 * (2) alle presenterte items har verdict. Ellers `pending`.
 */
export function computeReviewStatus(
  state: ShadowReviewState,
  presentedItemIds: readonly string[]
): 'pending' | 'reviewed' {
  if (!isChildReviewComplete(state)) return 'pending'
  const reviewed = new Set(state.itemReviews.map((r) => r.itemId))
  const allItemsReviewed = presentedItemIds.every((id) => reviewed.has(id))
  return allItemsReviewed ? 'reviewed' : 'pending'
}

/** Returnerer state med `status` rekomputert mot de presenterte item-ID-ene. */
export function withRecomputedStatus(
  state: ShadowReviewState,
  presentedItemIds: readonly string[]
): ShadowReviewState {
  return { ...state, status: computeReviewStatus(state, presentedItemIds) }
}
