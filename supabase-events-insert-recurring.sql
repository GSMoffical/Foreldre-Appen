-- Atomic recurring event insert for owner/linked users.
-- Run order: supabase-setup.sql -> supabase-invites.sql -> supabase-events-update-rpc.sql -> this file.

CREATE OR REPLACE FUNCTION public.insert_recurring_events_keep_owner(
  p_start_date date,
  p_end_date date,
  p_interval_days integer,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_current date;
  v_group_id uuid;
  v_rows jsonb := '[]'::jsonb;
  v_inserted events%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_interval_days IS NULL OR p_interval_days < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_interval');
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_range');
  END IF;

  SELECT COALESCE(
    (SELECT linked_to_user_id FROM public.family_links WHERE user_id = auth.uid() LIMIT 1),
    auth.uid()
  )
  INTO v_owner_id;

  v_group_id := COALESCE((p_input->>'recurrence_group_id')::uuid, gen_random_uuid());
  v_current := p_start_date;

  WHILE v_current <= p_end_date LOOP
    INSERT INTO public.events (
      user_id,
      date,
      person_id,
      title,
      start,
      "end",
      notes,
      location,
      recurrence_group_id,
      reminder_minutes,
      metadata
    )
    VALUES (
      v_owner_id,
      v_current,
      COALESCE((p_input->>'person_id')::text, 'family'),
      COALESCE(p_input->>'title', ''),
      COALESCE(p_input->>'start', '00:00'),
      COALESCE(p_input->>'end', '00:30'),
      CASE WHEN p_input ? 'notes' THEN (p_input->>'notes')::text ELSE NULL END,
      CASE WHEN p_input ? 'location' THEN (p_input->>'location')::text ELSE NULL END,
      v_group_id,
      CASE WHEN p_input ? 'reminder_minutes' THEN (p_input->>'reminder_minutes')::integer ELSE NULL END,
      CASE WHEN p_input ? 'metadata' THEN (p_input->'metadata')::jsonb ELSE NULL END
    )
    RETURNING * INTO v_inserted;

    v_rows := v_rows || to_jsonb(v_inserted);
    v_current := v_current + p_interval_days;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_recurring_events_keep_owner(date, date, integer, jsonb) TO anon, authenticated;
