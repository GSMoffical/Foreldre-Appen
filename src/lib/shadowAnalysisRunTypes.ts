import type { CanonicalSchoolContentDraft } from './canonicalSchoolTypes'

/**
 * Shadow Synka v0 — domenetyper for ett «analysis run».
 *
 * Formål: skille (1) hva Tankestrømmen predikerte, (2) hva brukeren senere
 * bekrefter/korrigerer/avviser, og (3) dagens gjeldende skole-state
 * (family_members.profile.school.weekOverlays — IKKE berørt her).
 *
 * `predictionSnapshot` gjenbruker `CanonicalSchoolContentDraft` direkte (ikke kopiert)
 * og er IMMUTABLE etter opprettelse. `reviewState` er den eneste mutable delen.
 */

export const SHADOW_ANALYSIS_RUN_SCHEMA_VERSION = '1.0.0'

export type ShadowReviewVerdict = 'approve' | 'correct' | 'reject'

/**
 * KOMPLETT korrigert representasjon av de bruker-reviewbare SEMANTISKE feltene for ett item
 * (Del 8/10). Eksplisitt whitelist — IKKE en kopi av hele CanonicalSchoolContentItem. Bevisst
 * UTELATT (metadata/prediction-identitet, ikke bruker-redigerbart): itemId, sourceId, sourceRef,
 * evidence, confidence, reviewFlags, placement, audienceEntries. Ved `correct` lagres HELE denne
 * (ikke en delta/patch), slik at senere field-level sammenligning mot prediksjonen er mulig.
 */
export interface ShadowCorrectedItemSnapshot {
  contentType: string
  subjectKey: string | null
  /** Synlig tekst slik brukeren mener den skal være. */
  lines: string[]
  start: string | null
  end: string | null
}

/**
 * Per-item ground truth. Refererer canonical `itemId` (stabil identitet); `dayId` er valgfri for
 * dag-scopede fakta. Ved `verdict === 'correct'` skal `correctedSnapshot` være satt (komplett).
 */
export interface ShadowItemReview {
  itemId: string
  dayId?: string
  verdict: ShadowReviewVerdict
  correctedSnapshot?: ShadowCorrectedItemSnapshot
  reviewedAt: string
}

/**
 * RUN-nivå ground truth: canonical personId/personMatchStatus ligger på draft-nivå,
 * så «var riktig barn valgt?» er en run-level vurdering — ikke en item-review.
 * (Fylles av PR2.)
 */
export interface ShadowRunReview {
  childVerdict: 'approve' | 'correct'
  /** Satt når predikert barn var feil; peker til korrekt family_members.id (eller null = uavklart). */
  correctedChildMemberId?: string | null
  reviewedAt: string
}

export interface ShadowReviewState {
  status: 'pending' | 'reviewed'
  /** Run-level: var predikert barn riktig? (Del 5) */
  runReview?: ShadowRunReview
  /** Per-item verdicts (Del 6). Tom i denne PR-en. */
  itemReviews: ShadowItemReview[]
}

export interface ShadowAnalysisRun {
  id: string
  userId: string
  /** family_members.id, eller null når canonical prediction har uavklart barn. */
  childMemberId: string | null
  /** Tankestrømmens bundle.provenance.importRunId — aldri regenerert. */
  tankestromImportRunId: string
  schemaVersion: string
  /** Immutabelt canonical prediksjons-snapshot. */
  predictionSnapshot: CanonicalSchoolContentDraft
  reviewState: ShadowReviewState
  createdAt: string
  updatedAt: string
}

/** Initielt (tomt) review-state for et nytt run. */
export function emptyShadowReviewState(): ShadowReviewState {
  return { status: 'pending', itemReviews: [] }
}
