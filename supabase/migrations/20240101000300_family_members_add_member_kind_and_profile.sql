-- Run after supabase-setup.sql (and invites if used).
-- Adds parent/child kind + JSON profile for school & work schedules.

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS member_kind text NOT NULL DEFAULT 'child'
    CHECK (member_kind IN ('parent', 'child'));

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.family_members.member_kind IS 'parent = can receive invite pairing; child = school schedule UI';
COMMENT ON COLUMN public.family_members.profile IS 'JSON: { school?: ChildSchoolProfile, work?: ParentWorkProfile }';
