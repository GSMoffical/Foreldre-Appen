-- ============================================================================
-- Tasks: task_intent (must_do | can_help) — kjør i Supabase SQL Editor
-- ============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_intent text NOT NULL DEFAULT 'must_do';

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_task_intent_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_task_intent_check
  CHECK (task_intent IN ('must_do', 'can_help'));

COMMENT ON COLUMN public.tasks.task_intent IS 'Semantikk: must_do = plikt, can_help = frivillig forespørsel (ingen påmelding i MVP).';
