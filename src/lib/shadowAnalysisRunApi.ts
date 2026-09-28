import { supabase } from './supabaseClient'
import { parseCanonicalSchoolContentDraft } from './canonicalSchoolParse'
import type { CanonicalSchoolContentDraft } from './canonicalSchoolTypes'
import {
  SHADOW_ANALYSIS_RUN_SCHEMA_VERSION,
  emptyShadowReviewState,
  type ShadowAnalysisRun,
  type ShadowReviewState,
} from './shadowAnalysisRunTypes'

/**
 * Data-access for Shadow Synka `analysis_runs`. Ingen React, ingen Tankestrøm-kall,
 * ingen sideeffekter utover Supabase. Prediction snapshot er IMMUTABLE gjennom det
 * offentlige API-et: `updateReviewState` sender ALDRI prediction_snapshot.
 */

const ANALYSIS_RUN_COLUMNS =
  'id, user_id, child_member_id, tankestrom_import_run_id, schema_version, prediction_snapshot, review_state, created_at, updated_at'

interface AnalysisRunRow {
  id: string
  user_id: string
  child_member_id: string | null
  tankestrom_import_run_id: string
  schema_version: string
  prediction_snapshot: unknown
  review_state: unknown
  created_at: string
  updated_at: string
}

export type ShadowAnalysisRunRow = AnalysisRunRow

export interface CreateShadowAnalysisRunInput {
  userId: string
  /** family_members.id, eller null når canonical prediction har uavklart barn. */
  childMemberId: string | null
  /** bundle.provenance.importRunId — må komme fra Tankestrøm-responsen, ikke genereres. */
  tankestromImportRunId: string
  predictionSnapshot: CanonicalSchoolContentDraft
}

/** Kolonner sendt til insert. Ren funksjon (testbar uten Supabase). */
export function buildShadowAnalysisRunInsert(input: CreateShadowAnalysisRunInput): {
  user_id: string
  child_member_id: string | null
  tankestrom_import_run_id: string
  schema_version: string
  prediction_snapshot: CanonicalSchoolContentDraft
  review_state: ShadowReviewState
} {
  return {
    user_id: input.userId,
    child_member_id: input.childMemberId,
    tankestrom_import_run_id: input.tankestromImportRunId,
    schema_version: SHADOW_ANALYSIS_RUN_SCHEMA_VERSION,
    prediction_snapshot: input.predictionSnapshot,
    review_state: emptyShadowReviewState(),
  }
}

function normalizeReviewState(raw: unknown): ShadowReviewState {
  if (!raw || typeof raw !== 'object') return emptyShadowReviewState()
  const r = raw as Partial<ShadowReviewState>
  const status = r.status === 'reviewed' ? 'reviewed' : 'pending'
  const itemReviews = Array.isArray(r.itemReviews) ? r.itemReviews : []
  return { status, itemReviews, ...(r.runReview ? { runReview: r.runReview } : {}) }
}

/**
 * Mapper DB-rad → domene. `prediction_snapshot` RUNTIME-valideres med den delte
 * canonical-parseren (JSONB kan være hva som helst); ugyldig snapshot → null (kaller
 * håndterer det, ingen krasj).
 */
export function mapShadowAnalysisRunRow(row: AnalysisRunRow): ShadowAnalysisRun | null {
  const snapshot = parseCanonicalSchoolContentDraft(row.prediction_snapshot)
  if (!snapshot) return null
  return {
    id: row.id,
    userId: row.user_id,
    childMemberId: row.child_member_id,
    tankestromImportRunId: row.tankestrom_import_run_id,
    schemaVersion: row.schema_version,
    predictionSnapshot: snapshot,
    reviewState: normalizeReviewState(row.review_state),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createShadowAnalysisRun(
  input: CreateShadowAnalysisRunInput
): Promise<ShadowAnalysisRun | null> {
  const { data, error } = await supabase
    .from('analysis_runs')
    .insert(buildShadowAnalysisRunInsert(input))
    .select(ANALYSIS_RUN_COLUMNS)
    .single()
  if (error) {
    console.error('[shadowAnalysisRunApi] createShadowAnalysisRun error', error)
    return null
  }
  return mapShadowAnalysisRunRow(data as AnalysisRunRow)
}

export async function fetchShadowAnalysisRun(id: string): Promise<ShadowAnalysisRun | null> {
  const { data, error } = await supabase
    .from('analysis_runs')
    .select(ANALYSIS_RUN_COLUMNS)
    .eq('id', id)
    .single()
  if (error) {
    console.error('[shadowAnalysisRunApi] fetchShadowAnalysisRun error', error)
    return null
  }
  return mapShadowAnalysisRunRow(data as AnalysisRunRow)
}

/**
 * Oppdaterer KUN review_state (+ user_id-scoping). Sender ALDRI prediction_snapshot,
 * tankestrom_import_run_id eller schema_version — de er immutable (og DB-triggeren
 * låser dem uansett). Snapshot kan derfor ikke endres via review-oppdatering.
 */
export async function updateShadowReviewState(
  id: string,
  userId: string,
  reviewState: ShadowReviewState
): Promise<ShadowAnalysisRun | null> {
  const { data, error } = await supabase
    .from('analysis_runs')
    .update({ review_state: reviewState })
    .eq('id', id)
    .eq('user_id', userId)
    .select(ANALYSIS_RUN_COLUMNS)
    .single()
  if (error) {
    console.error('[shadowAnalysisRunApi] updateShadowReviewState error', error)
    return null
  }
  return mapShadowAnalysisRunRow(data as AnalysisRunRow)
}
