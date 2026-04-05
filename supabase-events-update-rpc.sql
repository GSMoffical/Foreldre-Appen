-- Events: fetch and update via RPC so the event owner never changes and both users see the same calendar.
-- Run order: 1) supabase-setup.sql  2) supabase-invites.sql  3) this file.
-- Optional: supabase-events-owner-lock.sql (trigger backup; RPC already keeps owner).

-- 1) Fetch events: server computes "effective owner" (self or linked-to), returns only that calendar.
CREATE OR REPLACE FUNCTION public.get_events_for_calendar(
  p_start_date date,
  p_end_date date
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
    RETURN '[]'::jsonb;
  END IF;
  SELECT COALESCE(
    (SELECT linked_to_user_id FROM public.family_links WHERE user_id = auth.uid() LIMIT 1),
    auth.uid()
  ) INTO v_owner_id;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.date, e.start), '[]'::jsonb)
    FROM public.events e
    WHERE e.user_id = v_owner_id
      AND e.date >= p_start_date
      AND e.date <= p_end_date
  );
END;
$$;

-- 2) Update single event: never touch user_id.
CREATE OR REPLACE FUNCTION public.update_event_keep_owner(
  p_event_id uuid,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_row events%ROWTYPE;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.events WHERE id = p_event_id;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF v_owner_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.family_links WHERE user_id = auth.uid() AND linked_to_user_id = v_owner_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE public.events
  SET
    person_id    = COALESCE((p_updates->>'person_id')::text, person_id),
    title        = COALESCE(p_updates->>'title', title),
    start        = COALESCE(p_updates->>'start', start),
    "end"        = COALESCE(p_updates->>'end', "end"),
    notes        = CASE WHEN p_updates ? 'notes' THEN (p_updates->>'notes')::text ELSE notes END,
    location     = CASE WHEN p_updates ? 'location' THEN (p_updates->>'location')::text ELSE location END,
    reminder_minutes = CASE WHEN p_updates ? 'reminder_minutes' THEN (p_updates->>'reminder_minutes')::int ELSE reminder_minutes END,
    metadata     = CASE WHEN p_updates ? 'metadata' THEN (p_updates->'metadata')::jsonb ELSE metadata END,
    date         = COALESCE((p_updates->>'date')::date, date)
  WHERE id = p_event_id;

  SELECT * INTO v_row FROM public.events WHERE id = p_event_id;
  RETURN jsonb_build_object(
    'ok', true,
    'row', to_jsonb(v_row)
  );
END;
$$;

-- Batch update by recurrence group (keeps owner of all events in the group).
CREATE OR REPLACE FUNCTION public.update_events_by_group_keep_owner(
  p_group_id uuid,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.events WHERE recurrence_group_id = p_group_id LIMIT 1;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF v_owner_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.family_links WHERE user_id = auth.uid() AND linked_to_user_id = v_owner_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE public.events
  SET
    person_id    = COALESCE((p_updates->>'person_id')::text, person_id),
    title        = COALESCE(p_updates->>'title', title),
    start        = COALESCE(p_updates->>'start', start),
    "end"        = COALESCE(p_updates->>'end', "end"),
    notes        = CASE WHEN p_updates ? 'notes' THEN (p_updates->>'notes')::text ELSE notes END,
    location     = CASE WHEN p_updates ? 'location' THEN (p_updates->>'location')::text ELSE location END,
    reminder_minutes = CASE WHEN p_updates ? 'reminder_minutes' THEN (p_updates->>'reminder_minutes')::int ELSE reminder_minutes END
  WHERE recurrence_group_id = p_group_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_events_for_calendar(date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_keep_owner(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_events_by_group_keep_owner(uuid, jsonb) TO anon, authenticated;
