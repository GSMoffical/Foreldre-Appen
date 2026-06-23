-- Owner-only bulk delete for all events.
-- Run in Supabase SQL Editor after supabase-invites.sql.
--
-- Problem: The RLS policy on events allows linked users to delete any event owned
-- by the family owner (via the family_links sub-query). This means a linked partner
-- who calls the Supabase client directly (bypassing client-side guards) could delete
-- ALL events for the shared family.
--
-- Fix: Replace the direct .delete().eq('user_id', userId) call with this RPC.
-- The RPC enforces that only the actual owner (auth.uid() = owner_id) can bulk-delete.

CREATE OR REPLACE FUNCTION public.delete_all_events_owner_only()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_linked_to uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- If this user is a linked partner, they must not be allowed to bulk-delete.
  SELECT linked_to_user_id INTO v_linked_to
  FROM public.family_links
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_linked_to IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Caller is the owner: delete all their events.
  DELETE FROM public.events WHERE user_id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_all_events_owner_only() TO authenticated;
