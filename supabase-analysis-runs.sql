-- ============================================================================
-- Shadow Synka v0 — analysis_runs
-- Immutable prediction snapshot + separate review state (ground truth).
-- Additiv tabell. Rører IKKE dagens "current state"-modell
-- (family_members.profile.school.weekOverlays) — den forblir uendret.
--
-- Run in Supabase SQL Editor after:
--   supabase-setup.sql
--   supabase-invites.sql   (family_links must exist for owner-or-linked RLS)
--   supabase-delete-account.sql
--
-- Modellert etter public.tasks (supabase-tasks.sql): uuid-PK, user_id FK m/
-- ON DELETE CASCADE, before-update-trigger som låser eierskap + bumper updated_at,
-- RLS "owner OR linked" (samme som events/tasks/family_members).
-- ============================================================================

-- 1) Table
CREATE TABLE public.analysis_runs (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: account deletion (delete_user_account → DELETE FROM auth.users)
  -- rydder disse radene automatisk. Ingen egen sletting trengs i den sentrale RPC-en.
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- family_members.id (text). Nullbar: canonical prediction kan ha uavklart barn
  -- (personId=null / personMatchStatus != matched). Ingen FK (family_members har
  -- sammensatt PK (user_id, id)) — samme konvensjon som tasks.child_person_id.
  child_member_id          text,
  -- Tankestrømmens bundle.provenance.importRunId — ALDRI regenerert i Synka.
  tankestrom_import_run_id text        NOT NULL,
  schema_version           text        NOT NULL DEFAULT '1.0.0',
  -- Immutabelt øyeblikksbilde av CanonicalSchoolContentDraft brukeren vurderer.
  -- Endres ALDRI av review-oppdateringer.
  prediction_snapshot      jsonb       NOT NULL,
  -- Ground truth. Initielt pending; PR2 fyller approve/correct/reject.
  review_state             jsonb       NOT NULL DEFAULT '{"status":"pending","itemReviews":[]}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- 2) Indexes
CREATE INDEX idx_analysis_runs_user            ON public.analysis_runs (user_id);
CREATE INDEX idx_analysis_runs_user_import_run ON public.analysis_runs (user_id, tankestrom_import_run_id);

-- 3) Before-update trigger: lock ownership + snapshot, bump updated_at.
--    prediction_snapshot og tankestrom_import_run_id er immutable etter opprettelse
--    (review-oppdateringer skal kun endre review_state).
CREATE OR REPLACE FUNCTION public.analysis_runs_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.user_id                  := OLD.user_id;                  -- prevent ownership reassignment
  NEW.prediction_snapshot      := OLD.prediction_snapshot;      -- immutable prediction
  NEW.tankestrom_import_run_id := OLD.tankestrom_import_run_id; -- immutable analyse-kobling
  NEW.schema_version           := OLD.schema_version;
  NEW.created_at               := OLD.created_at;
  NEW.updated_at               := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER analysis_runs_before_update_trigger
  BEFORE UPDATE ON public.analysis_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.analysis_runs_before_update();

-- 4) Enable RLS
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;

-- 5) Access policy — "owner OR linked", identisk mønster som public.tasks
--    (supabase-tasks.sql:50). Linked family (family_links) co-forvalter familien,
--    som for events/tasks. Ingen cross-household tilgang; ikke offentlig lesbar.
CREATE POLICY "analysis_runs_access_owner_or_linked"
  ON public.analysis_runs
  FOR ALL
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT linked_to_user_id
      FROM public.family_links
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IN (
      SELECT linked_to_user_id
      FROM public.family_links
      WHERE user_id = auth.uid()
    )
  );

-- 6) Account deletion: håndteres AUTOMATISK via FK-cascade.
--    analysis_runs.user_id har ON DELETE CASCADE mot auth.users (se kolonnen over),
--    og delete_user_account() (supabase-delete-account.sql) avslutter med
--    `DELETE FROM auth.users` — som cascade-sletter denne tabellens rader.
--    Vi redefinerer derfor bevisst IKKE den sentrale delete_user_account()-RPC-en her.
