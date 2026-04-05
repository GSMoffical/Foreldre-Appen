-- =============================================================================
-- DEMO DATA — example family exercising app features (run in Supabase SQL Editor)
-- =============================================================================
-- Before running:
--   1) Replace the placeholder UUID in v_owner (inside the DO $$ block) with your user id from:
--      Dashboard → Authentication → Users → your account → UUID
--   2) Run after: supabase-setup, supabase-fix, supabase-family-members-profile,
--      supabase-invites, supabase-invite-target-member, supabase-events-update-rpc,
--      supabase-family-members-rls-linked (same order as your project).
--
-- This script:
--   • Clears YOUR user’s events, family_invites (from you), and family_members rows
--   • Inserts: 2 parents + 2 children with school/work JSON (custom subject «Annet fag»)
--   • Inserts sample events: transport, participants, recurrence, reminder, notes
--   • Inserts a pending invite targeting the «Pappa» row (target_member_id)
--
-- Optional — second parent login (not required for seed to run):
--   Create another Auth user, then you can INSERT into family_links and set
--   linked_auth_user_id on demo-pappa — see bottom COMMENT block.
-- =============================================================================

DO $$
DECLARE
  -- Replace this UUID with yours (Authentication → Users → copy). Do not run unchanged.
  v_owner uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  -- Monday of the week containing today (ISO: Mon = 1 … Sun = 7)
  v_week_mon date := current_date - (extract(isodow from current_date)::int - 1);
  rg uuid := gen_random_uuid();
BEGIN
  IF v_owner = '11111111-1111-1111-1111-111111111111'::uuid THEN
    RAISE EXCEPTION 'Replace v_owner in supabase-seed-demo-family.sql with your real auth.users id.';
  END IF;

  -- Clean slate for this calendar owner
  DELETE FROM public.events WHERE user_id = v_owner;
  DELETE FROM public.family_invites WHERE from_user_id = v_owner;
  DELETE FROM public.family_members WHERE user_id = v_owner;

  -- ---- Family members (ids are stable for references in events / invites) ----
  INSERT INTO public.family_members (
    id, user_id, name, color_tint, color_accent, sort_order, member_kind, profile, linked_auth_user_id
  ) VALUES
  (
    'demo-mamma',
    v_owner,
    'Mamma (deg)',
    '#fef9c3',
    '#eab308',
    0,
    'parent',
    jsonb_build_object(
      'work', jsonb_build_object(
        'weekdays', jsonb_build_object(
          '0', jsonb_build_object('start', '09:00', 'end', '16:30'),
          '2', jsonb_build_object('start', '08:30', 'end', '15:00'),
          '4', jsonb_build_object('start', '09:00', 'end', '14:00')
        )
      )
    ),
    NULL
  ),
  (
    'demo-pappa',
    v_owner,
    'Pappa (invitasjon)',
    '#dbeafe',
    '#3b82f6',
    1,
    'parent',
    '{}'::jsonb,
    NULL
  ),
  (
    'demo-emma',
    v_owner,
    'Emma',
    '#dcfce7',
    '#22c55e',
    2,
    'child',
    jsonb_build_object(
      'school', jsonb_build_object(
        'gradeBand', '5-7',
        'weekdays', jsonb_build_object(
          -- Mandag: timedelsdag med bl.a. «Annet fag» (customLabel) + vanlig fag
          '0', jsonb_build_object(
            'useSimpleDay', false,
            'schoolStart', '08:15',
            'schoolEnd', '14:30',
            'lessons', jsonb_build_array(
              jsonb_build_object('subjectKey', 'norsk', 'start', '08:15', 'end', '09:00'),
              jsonb_build_object(
                'subjectKey', 'custom',
                'customLabel', 'Kristendom / livssyn',
                'start', '09:15',
                'end', '10:00'
              ),
              jsonb_build_object('subjectKey', 'matematikk', 'start', '10:15', 'end', '11:15'),
              jsonb_build_object('subjectKey', 'naturfag', 'start', '12:00', 'end', '13:00')
            )
          ),
          -- Tirsdag: enkel «Skole»-blokk
          '1', jsonb_build_object(
            'useSimpleDay', true,
            'schoolStart', '08:15',
            'schoolEnd', '14:30'
          ),
          -- Onsdag: kun standardporttider (implicit simple)
          '2', jsonb_build_object('useSimpleDay', true)
        )
      )
    ),
    NULL
  ),
  (
    'demo-leo',
    v_owner,
    'Leo',
    '#ede9fe',
    '#8b5cf6',
    3,
    'child',
    jsonb_build_object(
      'school', jsonb_build_object(
        'gradeBand', '1-4',
        'weekdays', jsonb_build_object(
          '0', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:30', 'schoolEnd', '14:00'),
          '3', jsonb_build_object('useSimpleDay', true)
        )
      )
    ),
    NULL
  );

  -- ---- Pending invite: other parent claims row demo-pappa (target_member_id) ----
  INSERT INTO public.family_invites (
    from_user_id, token, invited_email, expires_at, accepted_at, target_member_id
  ) VALUES (
    v_owner,
    'demo-seed-pappa-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 8),
    NULL,
    now() + interval '7 days',
    NULL,
    'demo-pappa'
  );

  -- ---- Events (same calendar week as “this week” for easy viewing) ----
  -- Single activity + location + notes + reminder
  INSERT INTO public.events (
    user_id, person_id, date, title, start, "end", notes, location, recurrence_group_id, reminder_minutes, metadata
  ) VALUES (
    v_owner,
    'demo-mamma',
    v_week_mon,
    'Foreldremøte',
    '17:00',
    '18:00',
    'Husk bakekake til loddsalg',
    'Skolen, biblioteket',
    NULL,
    15,
    NULL
  );

  -- Transport + participants (Fellesskapsaktivitet)
  INSERT INTO public.events (
    user_id, person_id, date, title, start, "end", metadata
  ) VALUES (
    v_owner,
    'demo-emma',
    v_week_mon + 2,
    'Fotballtrening',
    '16:00',
    '17:15',
    jsonb_build_object(
      'transport', jsonb_build_object(
        'dropoffBy', 'demo-mamma',
        'pickupBy', 'demo-pappa'
      ),
      'participants', jsonb_build_array('demo-emma', 'demo-mamma')
    )
  );

  -- Recurring series (two occurrences, same recurrence_group_id)
  INSERT INTO public.events (
    user_id, person_id, date, title, start, "end", recurrence_group_id, reminder_minutes, metadata
  ) VALUES
  (
    v_owner,
    'demo-leo',
    v_week_mon + 1,
    'SFO morgen',
    '07:30',
    '08:20',
    rg,
    NULL,
    NULL
  ),
  (
    v_owner,
    'demo-leo',
    v_week_mon + 3,
    'SFO morgen',
    '07:30',
    '08:20',
    rg,
    NULL,
    NULL
  );

  -- Work-adjacent block on parent
  INSERT INTO public.events (
    user_id, person_id, date, title, start, "end", notes
  ) VALUES (
    v_owner,
    'demo-pappa',
    v_week_mon + 4,
    'Hjemmekontor — dybde',
    '08:00',
    '12:00',
    'DND i kalender'
  );

END $$;

-- =============================================================================
-- After running: reload the app. You should see:
--   • Four people; «Pappa» has a pending invite (copy token from table or use app)
--   • Emma: Monday lessons including custom «Kristendom / livssyn»; Tue simple Skole
--   • Leo: recurring SFO ×2; background school blocks when filters include them
--   • Mamma: work background Mon/Wed/Fri; one meeting with reminder
--   • Transport/pickup on Emma’s football event
--
-- To fetch the new invite link in SQL (optional):
--   SELECT token FROM public.family_invites
--   WHERE from_user_id = '<your same uuid>' AND accepted_at IS NULL
--   ORDER BY created_at DESC LIMIT 1;
-- Then open: https://YOUR_PROJECT_REF.supabase.co is wrong — use your app origin:
--   https://<your-app-host>/?invite=<token>
--
-- Linked second parent (manual):
--   INSERT INTO public.family_links (user_id, linked_to_user_id)
--   VALUES ('<OTHER_USER_UUID>', '<YOUR_OWNER_UUID>');
--   UPDATE public.family_members SET linked_auth_user_id = '<OTHER_USER_UUID>'
--   WHERE user_id = '<YOUR_OWNER_UUID>' AND id = 'demo-pappa';
-- =============================================================================
