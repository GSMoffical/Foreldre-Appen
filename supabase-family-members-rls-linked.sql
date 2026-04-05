-- =============================================================================
-- LAUNCH GATE: family_members visibility for invited (linked) parents
-- =============================================================================
-- Run this in Supabase SQL Editor after:
--   - supabase-setup.sql (tables)
--   - supabase-invites.sql (family_links, family_invites, accept_invite, …)
--
-- Problem: If only supabase-setup.sql was applied, RLS on family_members only
-- allows user_id = auth.uid(). Invited users need rows where user_id = OWNER.
--
-- This script:
--   1) Ensures family_links exists
--   2) Replaces family_members policies so SELECT/INSERT/UPDATE/DELETE work for:
--        - the row owner (auth.uid() = user_id), OR
--        - anyone linked to that owner via family_links (invited parent)
-- =============================================================================

-- 1) family_links (safe if already created by supabase-invites.sql)
CREATE TABLE IF NOT EXISTS public.family_links (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_link CHECK (user_id != linked_to_user_id)
);

ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own link" ON public.family_links;
CREATE POLICY "Users can manage own link"
  ON public.family_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) Drop all existing policies on family_members (avoid duplicates / old rules)
DO $$
DECLARE
  pol text;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'family_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.family_members', pol);
  END LOOP;
END $$;

-- 3) Single policy: owner OR linked-to-owner (same logic as events in supabase-invites.sql)
CREATE POLICY "family_members_access_owner_or_linked"
  ON public.family_members
  FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.family_links fl
      WHERE fl.user_id = auth.uid()
        AND fl.linked_to_user_id = family_members.user_id
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.family_links fl
      WHERE fl.user_id = auth.uid()
        AND fl.linked_to_user_id = family_members.user_id
    )
  );

-- 4) Grants: Supabase usually grants authenticated access to public tables by default.
--    Add explicit GRANTs only if your project revoked defaults.

-- =============================================================================
-- Verification (run manually as needed)
-- =============================================================================
-- As INVITED user (after accept_invite), this should return rows (not empty / not error):
--   SELECT id, name, user_id FROM public.family_members ORDER BY sort_order;
--
-- As OWNER, you should see your own rows (user_id = your auth.uid()).
-- =============================================================================
