-- ============================================================================
-- Tasks: task_intent (must_do | can_help) — kjør i Supabase SQL Editor
-- Uten denne kolonnen: PostgREST kan gi PGRST204 («Could not find task_intent…»).
-- Etter ALTER: ev. «Reload schema» i Supabase eller vent på cache-oppdatering.
-- ============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_intent text NOT NULL DEFAULT 'must_do';

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_task_intent_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_task_intent_check
  CHECK (task_intent IN ('must_do', 'can_help'));

COMMENT ON COLUMN public.tasks.task_intent IS 'Semantikk: must_do = plikt, can_help = frivillig forespørsel (ingen påmelding i MVP).';
