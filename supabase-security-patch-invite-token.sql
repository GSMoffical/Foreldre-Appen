-- Security patch: harden get_invite_by_token RPC.
-- 
-- Problem: The original function returns from_email (inviter's email address)
-- and invited_email to any caller who possesses a valid token, with no
-- authentication required. Email addresses are personal data under GDPR.
--
-- Fix: 
--   1. Remove from_email from the return set entirely.
--      The UI only needs to show the inviter's display name, not their email.
--   2. Add an expiry check inside the function so expired tokens return no rows
--      rather than returning data about an expired invite.
--   3. Keep invited_email in the return set — the accept flow needs it to verify
--      the accepting user's email matches. But this is now the only personal data
--      returned, and it is only useful to the person who already knows their own email.
--
-- Run this in the Supabase SQL Editor AFTER the existing supabase-invites.sql.
-- This replaces the get_invite_by_token function defined in supabase-invites.sql.

CREATE OR REPLACE FUNCTION public.get_invite_by_token(in_token text)
RETURNS TABLE (
  from_user_id uuid,
  invited_email text,
  expires_at timestamptz,
  accepted_at timestamptz,
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
    i.target_member_id
  FROM public.family_invites i
  WHERE i.token = in_token
    AND i.expires_at > now();
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- Note: from_email has been intentionally removed.
-- If the UI previously displayed the inviter's email, update it to use
-- a display name fetched via a separate authenticated call, or remove
-- the display entirely.
