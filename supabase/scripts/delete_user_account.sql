-- Synka: Account deletion RPC
-- Run this in the Supabase SQL Editor.
-- This function is called by the frontend via supabase.rpc('delete_user_account')
-- when a user chooses to permanently delete their account.
--
-- Security: SECURITY DEFINER so it can delete from auth.users.
-- Only authenticated users can call it (GRANT to authenticated only).
-- The function verifies auth.uid() is not null before proceeding.

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid;
BEGIN
  calling_user_id := auth.uid();

  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.notifications
    WHERE target_user_id = calling_user_id
       OR from_user_id = calling_user_id;

  DELETE FROM public.events
    WHERE user_id = calling_user_id;

  DELETE FROM public.tasks
    WHERE user_id = calling_user_id;

  DELETE FROM public.family_members
    WHERE user_id = calling_user_id;

  DELETE FROM public.family_invites
    WHERE from_user_id = calling_user_id;

  DELETE FROM public.family_links
    WHERE user_id = calling_user_id
       OR linked_to_user_id = calling_user_id;

  DELETE FROM public.profiles
    WHERE id = calling_user_id;

  DELETE FROM auth.users
    WHERE id = calling_user_id;

END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
