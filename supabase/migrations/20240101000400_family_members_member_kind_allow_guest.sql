-- Extends the member_kind CHECK constraint to include 'guest' (read-only access).
-- Run this against your Supabase project after deploying the guest-role UI changes.
--
-- The original constraint was added in supabase-family-members-profile.sql:
--   CHECK (member_kind IN ('parent', 'child'))
-- Postgres names it automatically as family_members_member_kind_check.

ALTER TABLE public.family_members
  DROP CONSTRAINT IF EXISTS family_members_member_kind_check;

ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_member_kind_check
    CHECK (member_kind IN ('parent', 'child', 'guest'));

COMMENT ON COLUMN public.family_members.member_kind IS
  'parent = can receive invite pairing; child = school schedule UI; guest = read-only calendar access';
