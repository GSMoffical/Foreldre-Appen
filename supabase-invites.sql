-- Family invite & share: run in Supabase SQL Editor.
-- Lets a second parent join the same family (see same family_members and events).
-- Uses family_links (invitee sees inviter's data) and family_invites (invite tokens).

-- 1) family_links: user_id = who joined, linked_to_user_id = whose family they see
CREATE TABLE IF NOT EXISTS public.family_links (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_link CHECK (user_id != linked_to_user_id)
);

ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own link"
  ON public.family_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) family_invites: invite tokens created by the family "owner"
CREATE TABLE IF NOT EXISTS public.family_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  invited_email text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_family_invites_token ON public.family_invites(token);
CREATE INDEX IF NOT EXISTS idx_family_invites_from_user ON public.family_invites(from_user_id);

ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- Creator can do everything on their invites
CREATE POLICY "Creator can manage own invites"
  ON public.family_invites FOR ALL
  USING (auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = from_user_id);

-- 3) RPC: get invite by token (for accept screen – returns public info only)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(in_token text)
RETURNS TABLE (
  from_user_id uuid,
  invited_email text,
  expires_at timestamptz,
  accepted_at timestamptz,
  from_email text
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
    (SELECT email FROM auth.users WHERE id = i.from_user_id) AS from_email
  FROM public.family_invites i
  WHERE i.token = in_token;
$$;

-- 4) RPC: accept invite (call when logged in as invitee)
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

  UPDATE public.family_invites
  SET accepted_at = now(), accepted_by_user_id = uid
  WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5) RLS: allow linked users to read/write the owner's family_members and events
--    NOTE: If this ever fails to apply, run supabase-family-members-rls-linked.sql
--    (drops all family_members policies and recreates — launch gate for invites).
DROP POLICY IF EXISTS "Users can manage own family_members" ON public.family_members;
DROP POLICY IF EXISTS "family_members_access_owner_or_linked" ON public.family_members;
CREATE POLICY "family_members_access_owner_or_linked"
  ON public.family_members FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.family_links fl
      WHERE fl.user_id = auth.uid() AND fl.linked_to_user_id = family_members.user_id
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.family_links fl
      WHERE fl.user_id = auth.uid() AND fl.linked_to_user_id = family_members.user_id
    )
  );

DROP POLICY IF EXISTS "Users can manage own events" ON public.events;
CREATE POLICY "Users can manage own events"
  ON public.events FOR ALL
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT linked_to_user_id FROM public.family_links WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IN (SELECT linked_to_user_id FROM public.family_links WHERE user_id = auth.uid())
  );
