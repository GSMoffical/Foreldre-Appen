-- Run in Supabase SQL Editor after supabase-invites.sql and supabase-family-members-profile.sql.
-- Ties an invite to a specific family_members row (e.g. «pappa») so the invitee claims that profile.
--
-- If something fails: copy the full red error from the SQL Editor (error code + message) — that pinpoints the fix.

ALTER TABLE public.family_invites
  ADD COLUMN IF NOT EXISTS target_member_id text;

COMMENT ON COLUMN public.family_invites.target_member_id IS 'Owner''s family_members.id (parent row) to link via linked_auth_user_id on accept';

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS linked_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_linked_auth_user
  ON public.family_members(linked_auth_user_id)
  WHERE linked_auth_user_id IS NOT NULL;

-- Public invite lookup (add target_member_id).
-- Must DROP first: Postgres does not allow CREATE OR REPLACE when RETURNS TABLE columns change.
-- CASCADE: drops dependent objects if any (rare); avoids "cannot drop because other objects depend".
DROP FUNCTION IF EXISTS public.get_invite_by_token(text) CASCADE;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(in_token text)
RETURNS TABLE (
  from_user_id uuid,
  invited_email text,
  expires_at timestamptz,
  accepted_at timestamptz,
  from_email text,
  target_member_id text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.from_user_id,
    i.invited_email,
    i.expires_at,
    i.accepted_at,
    (SELECT email FROM auth.users WHERE id = i.from_user_id) AS from_email,
    i.target_member_id
  FROM public.family_invites i
  WHERE i.token = in_token;
$$;

-- PostgREST needs execute rights on RPCs (re-applying after DROP is safe).
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated, service_role;

-- Accept: link family + optionally claim the pre-created parent row
DROP FUNCTION IF EXISTS public.accept_invite(text) CASCADE;

CREATE OR REPLACE FUNCTION public.accept_invite(in_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  uid uuid := auth.uid();
  user_email text;
  updated_rows int;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO inv
  FROM public.family_invites
  WHERE token = in_token
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_accepted');
  END IF;

  IF inv.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF inv.from_user_id = uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_accept_own');
  END IF;

  IF inv.invited_email IS NOT NULL THEN
    SELECT email INTO user_email FROM auth.users WHERE id = uid;
    IF user_email IS NULL OR lower(trim(user_email)) <> lower(trim(inv.invited_email)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
    END IF;
  END IF;

  INSERT INTO public.family_links (user_id, linked_to_user_id)
  VALUES (uid, inv.from_user_id)
  ON CONFLICT (user_id) DO UPDATE SET linked_to_user_id = EXCLUDED.linked_to_user_id;

  IF inv.target_member_id IS NOT NULL AND length(trim(inv.target_member_id)) > 0 THEN
    UPDATE public.family_members
    SET linked_auth_user_id = uid
    WHERE user_id = inv.from_user_id
      AND id = inv.target_member_id
      AND member_kind = 'parent'
      AND (linked_auth_user_id IS NULL OR linked_auth_user_id = uid);

    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    IF updated_rows = 0 THEN
      DELETE FROM public.family_links WHERE user_id = uid AND linked_to_user_id = inv.from_user_id;
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_target_member');
    END IF;
  END IF;

  UPDATE public.family_invites
  SET accepted_at = now(), accepted_by_user_id = uid
  WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO anon, authenticated, service_role;
