-- Prevents event owner (user_id) from being changed on UPDATE.
-- Linked users can edit events but must not reassign ownership.
-- Run once in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.events_keep_owner_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_keep_owner_trigger ON public.events;
CREATE TRIGGER events_keep_owner_trigger
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_keep_owner_on_update();
