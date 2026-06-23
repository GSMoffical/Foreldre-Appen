-- Atomic delete for family member + their events (owner only).
-- Run order: supabase-setup.sql -> supabase-invites.sql -> this file.

CREATE OR REPLACE FUNCTION public.delete_family_member_and_events_keep_owner(
  p_member_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT COALESCE(
    (SELECT linked_to_user_id FROM public.family_links WHERE user_id = auth.uid() LIMIT 1),
    auth.uid()
  ) INTO v_owner_id;

  IF auth.uid() <> v_owner_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM public.events
  WHERE user_id = v_owner_id
    AND person_id = p_member_id;

  DELETE FROM public.family_members
  WHERE user_id = v_owner_id
    AND id = p_member_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_family_member_and_events_keep_owner(text) TO anon, authenticated;
