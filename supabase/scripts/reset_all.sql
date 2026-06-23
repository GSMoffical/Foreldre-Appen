-- Reset all app data (and optionally auth users) for a clean test.
-- Run in Supabase: SQL Editor → New query → paste → Run.
--
-- STEP 1: Clear app data (run this in SQL Editor)
-- Order matters because of foreign keys.

TRUNCATE TABLE public.family_links CASCADE;
TRUNCATE TABLE public.family_invites CASCADE;
TRUNCATE TABLE public.events CASCADE;
TRUNCATE TABLE public.family_members CASCADE;
-- Profiles are deleted when you delete users (CASCADE). If you added supabase-profiles.sql, you can also: TRUNCATE TABLE public.profiles CASCADE;

-- STEP 2: Delete all auth users
-- You cannot delete auth.users from the SQL Editor with default permissions.
-- Do this in the Dashboard instead:
--   1. Go to Authentication → Users
--   2. Select each user (or use "Select all") and click Delete.
--
-- Alternatively, if you have the Supabase CLI or service role key, you can
-- delete users via the Auth Admin API (e.g. deleteUserById).
