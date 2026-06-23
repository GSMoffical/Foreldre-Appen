-- =============================================================================
-- PACKED MONTH DEMO DATA (run in Supabase SQL Editor)
-- =============================================================================
-- Purpose:
--   Seed one busy family month that exercises nearly all app features:
--   - 2 parents + 3 children
--   - Parent work profiles (background blocks)
--   - Child school profiles, including lessons + custom subject label
--   - Parent-targeted invite (target_member_id)
--   - Transport metadata (dropoff/pickup + modes + car seat)
--   - Participants metadata (multi-person events)
--   - Recurrence groups
--   - Reminder minutes
--   - Notes/location/source metadata
--   - Packed weekdays + weekend family plans
--
-- Pre-req SQL already applied in your project:
--   supabase-setup.sql
--   supabase-fix.sql
--   supabase-family-members-profile.sql
--   supabase-invites.sql
--   supabase-family-members-rls-linked.sql
--   supabase-invite-target-member.sql
--   supabase-events-update-rpc.sql
--
-- IMPORTANT:
--   Replace v_owner UUID in DECLARE block before running.
-- =============================================================================

DO $$
DECLARE
  v_owner uuid := '11111111-1111-1111-1111-111111111111'::uuid; -- replace with your auth.users id
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  d date;
  iso_dow int;
  week_idx int;

  rg_sfo uuid := gen_random_uuid();
  rg_math uuid := gen_random_uuid();
  rg_swim uuid := gen_random_uuid();
  rg_therapy uuid := gen_random_uuid();
BEGIN
  IF v_owner = '11111111-1111-1111-1111-111111111111'::uuid THEN
    RAISE EXCEPTION 'Replace v_owner with your real auth.users UUID before running.';
  END IF;

  -- Clean only this owner's data
  DELETE FROM public.events WHERE user_id = v_owner;
  DELETE FROM public.family_invites WHERE from_user_id = v_owner;
  DELETE FROM public.family_members WHERE user_id = v_owner;

  -- ---------------------------------------------------------------------------
  -- Family members
  -- ---------------------------------------------------------------------------
  INSERT INTO public.family_members (
    id, user_id, name, color_tint, color_accent, sort_order, member_kind, profile, linked_auth_user_id
  ) VALUES
  (
    'fam-mamma',
    v_owner,
    'Mamma (deg)',
    '#fef9c3',
    '#eab308',
    0,
    'parent',
    jsonb_build_object(
      'work', jsonb_build_object(
        'weekdays', jsonb_build_object(
          '0', jsonb_build_object('start', '08:30', 'end', '16:30'),
          '1', jsonb_build_object('start', '09:00', 'end', '17:00'),
          '2', jsonb_build_object('start', '08:00', 'end', '15:30'),
          '3', jsonb_build_object('start', '09:00', 'end', '16:30'),
          '4', jsonb_build_object('start', '08:30', 'end', '14:30')
        )
      )
    ),
    NULL
  ),
  (
    'fam-pappa',
    v_owner,
    'Pappa',
    '#dbeafe',
    '#3b82f6',
    1,
    'parent',
    jsonb_build_object(
      'work', jsonb_build_object(
        'weekdays', jsonb_build_object(
          '0', jsonb_build_object('start', '07:30', 'end', '16:00'),
          '1', jsonb_build_object('start', '08:00', 'end', '16:30'),
          '2', jsonb_build_object('start', '08:00', 'end', '16:30'),
          '3', jsonb_build_object('start', '07:30', 'end', '15:30'),
          '4', jsonb_build_object('start', '08:00', 'end', '15:00')
        )
      )
    ),
    NULL
  ),
  (
    'kid-emma',
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
          '0', jsonb_build_object(
            'useSimpleDay', false,
            'schoolStart', '08:15',
            'schoolEnd', '14:30',
            'lessons', jsonb_build_array(
              jsonb_build_object('subjectKey', 'norsk', 'start', '08:15', 'end', '09:00'),
              jsonb_build_object('subjectKey', 'matematikk', 'start', '09:15', 'end', '10:00'),
              jsonb_build_object('subjectKey', 'custom', 'customLabel', 'Praktisk livsmestring', 'start', '10:15', 'end', '11:00'),
              jsonb_build_object('subjectKey', 'naturfag', 'start', '12:00', 'end', '13:00')
            )
          ),
          '1', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:15', 'schoolEnd', '14:30'),
          '2', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:15', 'schoolEnd', '14:30'),
          '3', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:15', 'schoolEnd', '14:30'),
          '4', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:15', 'schoolEnd', '14:00')
        )
      )
    ),
    NULL
  ),
  (
    'kid-leo',
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
          '1', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:30', 'schoolEnd', '14:00'),
          '2', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:30', 'schoolEnd', '14:00'),
          '3', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:30', 'schoolEnd', '14:00'),
          '4', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:30', 'schoolEnd', '13:30')
        )
      )
    ),
    NULL
  ),
  (
    'kid-noah',
    v_owner,
    'Noah',
    '#ffedd5',
    '#f97316',
    4,
    'child',
    jsonb_build_object(
      'school', jsonb_build_object(
        'gradeBand', '8-10',
        'weekdays', jsonb_build_object(
          '0', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:15', 'schoolEnd', '15:00'),
          '1', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:15', 'schoolEnd', '15:00'),
          '2', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:15', 'schoolEnd', '15:00'),
          '3', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:15', 'schoolEnd', '15:00'),
          '4', jsonb_build_object('useSimpleDay', true, 'schoolStart', '08:15', 'schoolEnd', '14:30')
        )
      )
    ),
    NULL
  );

  -- Parent-targeted invite (new feature)
  INSERT INTO public.family_invites (
    from_user_id, token, invited_email, expires_at, accepted_at, target_member_id
  ) VALUES (
    v_owner,
    'packed-month-pappa-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 8),
    NULL,
    now() + interval '7 days',
    NULL,
    'fam-pappa'
  );

  -- ---------------------------------------------------------------------------
  -- Month events (busy realistic mix)
  -- ---------------------------------------------------------------------------
  FOR d IN SELECT generate_series(v_month_start, v_month_end, interval '1 day')::date LOOP
    iso_dow := extract(isodow from d); -- 1=Mon ... 7=Sun
    week_idx := ((extract(day from d)::int - 1) / 7) + 1;

    IF iso_dow BETWEEN 1 AND 5 THEN
      -- Morning logistics block (participants + transport + reminder)
      INSERT INTO public.events (
        user_id, person_id, date, title, start, "end", reminder_minutes, metadata
      ) VALUES (
        v_owner,
        'fam-mamma',
        d,
        'Morgenlogistikk skole',
        '07:10',
        '08:10',
        20,
        jsonb_build_object(
          'participants', jsonb_build_array('fam-mamma', 'kid-emma', 'kid-leo', 'kid-noah'),
          'transport', jsonb_build_object(
            'dropoffBy', CASE WHEN iso_dow IN (1,3,5) THEN 'fam-mamma' ELSE 'fam-pappa' END,
            'dropoffMode', CASE WHEN iso_dow IN (1,5) THEN 'car' ELSE 'walk' END,
            'needsCarSeat', true
          ),
          'sourceId', 'seed-packed-month'
        )
      );

      -- Afternoon pickup window (transport both ways)
      INSERT INTO public.events (
        user_id, person_id, date, title, start, "end", metadata
      ) VALUES (
        v_owner,
        'fam-pappa',
        d,
        'Henting skole/SFO',
        '14:15',
        '15:30',
        jsonb_build_object(
          'participants', jsonb_build_array('fam-pappa', 'kid-emma', 'kid-leo'),
          'transport', jsonb_build_object(
            'pickupBy', CASE WHEN iso_dow IN (2,4) THEN 'fam-pappa' ELSE 'fam-mamma' END,
            'pickupMode', 'car',
            'needsCarSeat', true
          ),
          'sourceId', 'seed-packed-month'
        )
      );

      -- Dinner prep + family meal
      INSERT INTO public.events (
        user_id, person_id, date, title, start, "end", notes, metadata
      ) VALUES (
        v_owner,
        'fam-mamma',
        d,
        'Middag + leksehjelp',
        '17:00',
        '18:30',
        'Fordel oppgaver: dekke bord, matte, leselekse.',
        jsonb_build_object(
          'participants', jsonb_build_array('fam-mamma', 'fam-pappa', 'kid-emma', 'kid-leo', 'kid-noah'),
          'sourceId', 'seed-packed-month'
        )
      );

      -- Weekly patterned activities
      IF iso_dow = 1 THEN
        -- Monday football (Emma)
        INSERT INTO public.events (
          user_id, person_id, date, title, start, "end", location, reminder_minutes, metadata
        ) VALUES (
          v_owner,
          'kid-emma',
          d,
          'Fotballtrening',
          '18:00',
          '19:15',
          'Idrettsparken bane 2',
          45,
          jsonb_build_object(
            'participants', jsonb_build_array('kid-emma', 'fam-pappa'),
            'transport', jsonb_build_object(
              'dropoffBy', 'fam-pappa',
              'pickupBy', 'fam-mamma',
              'dropoffMode', 'car',
              'pickupMode', 'car'
            ),
            'sourceId', 'seed-packed-month'
          )
        );
      ELSIF iso_dow = 2 THEN
        -- Tuesday dentist rotation
        IF week_idx = 1 THEN
          INSERT INTO public.events (user_id, person_id, date, title, start, "end", location, notes, reminder_minutes, metadata)
          VALUES (
            v_owner, 'kid-emma', d, 'Tannlege Emma', '15:10', '15:50', 'Sentrum tannklinikk',
            'Ta med nytt helsekort.', 60,
            jsonb_build_object(
              'participants', jsonb_build_array('kid-emma', 'fam-mamma'),
              'transport', jsonb_build_object('dropoffBy', 'fam-mamma', 'pickupBy', 'fam-mamma', 'dropoffMode', 'car', 'pickupMode', 'car'),
              'sourceId', 'seed-packed-month'
            )
          );
        ELSIF week_idx = 2 THEN
          INSERT INTO public.events (user_id, person_id, date, title, start, "end", location, notes, reminder_minutes, metadata)
          VALUES (
            v_owner, 'kid-leo', d, 'Tannlege Leo', '15:20', '16:00', 'Sentrum tannklinikk',
            'Husk fluor etterpå.', 60,
            jsonb_build_object(
              'participants', jsonb_build_array('kid-leo', 'fam-pappa'),
              'transport', jsonb_build_object('dropoffBy', 'fam-pappa', 'pickupBy', 'fam-pappa', 'dropoffMode', 'car', 'pickupMode', 'car', 'needsCarSeat', true),
              'sourceId', 'seed-packed-month'
            )
          );
        ELSIF week_idx = 3 THEN
          INSERT INTO public.events (user_id, person_id, date, title, start, "end", location, notes, reminder_minutes, metadata)
          VALUES (
            v_owner, 'kid-noah', d, 'Tannlege Noah', '16:00', '16:40', 'Sentrum tannklinikk',
            'Kontroll + bittskinne justering.', 60,
            jsonb_build_object(
              'participants', jsonb_build_array('kid-noah', 'fam-mamma'),
              'transport', jsonb_build_object('dropoffBy', 'fam-mamma', 'pickupBy', 'fam-mamma', 'dropoffMode', 'car', 'pickupMode', 'car'),
              'sourceId', 'seed-packed-month'
            )
          );
        ELSE
          INSERT INTO public.events (user_id, person_id, date, title, start, "end", location, reminder_minutes, metadata)
          VALUES (
            v_owner, 'fam-mamma', d, 'Tannlegekontroll voksen', '15:30', '16:10', 'Smil Tannklinikk', 30,
            jsonb_build_object('participants', jsonb_build_array('fam-mamma'), 'sourceId', 'seed-packed-month')
          );
        END IF;
      ELSIF iso_dow = 3 THEN
        -- Wednesday therapy / speech follow-up recurring group
        INSERT INTO public.events (
          user_id, person_id, date, title, start, "end", location, recurrence_group_id, metadata
        ) VALUES (
          v_owner,
          'kid-leo',
          d,
          'Logoped / språkoppfølging',
          '16:15',
          '17:00',
          'Familiesenteret rom 3',
          rg_therapy,
          jsonb_build_object(
            'participants', jsonb_build_array('kid-leo', 'fam-pappa'),
            'transport', jsonb_build_object('dropoffBy', 'fam-pappa', 'pickupBy', 'fam-pappa', 'dropoffMode', 'car', 'pickupMode', 'car', 'needsCarSeat', true),
            'sourceId', 'seed-packed-month'
          )
        );
      ELSIF iso_dow = 4 THEN
        -- Thursday parent meeting / school portal admin
        INSERT INTO public.events (
          user_id, person_id, date, title, start, "end", notes, reminder_minutes, metadata
        ) VALUES (
          v_owner,
          'fam-pappa',
          d,
          'Ukesync foreldre + skolemeldinger',
          '20:00',
          '20:45',
          'Gå gjennom ukeplaner, dugnad, meldinger fra kontaktlærer.',
          10,
          jsonb_build_object(
            'participants', jsonb_build_array('fam-mamma', 'fam-pappa'),
            'sourceId', 'seed-packed-month'
          )
        );
      ELSIF iso_dow = 5 THEN
        -- Friday social / family movie
        INSERT INTO public.events (
          user_id, person_id, date, title, start, "end", location, metadata
        ) VALUES (
          v_owner,
          'fam-mamma',
          d,
          'Familiekveld (film + taco)',
          '19:00',
          '21:00',
          'Hjemme',
          jsonb_build_object(
            'participants', jsonb_build_array('fam-mamma', 'fam-pappa', 'kid-emma', 'kid-leo', 'kid-noah'),
            'sourceId', 'seed-packed-month'
          )
        );
      END IF;
    ELSE
      -- Weekend pattern
      IF iso_dow = 6 THEN
        INSERT INTO public.events (user_id, person_id, date, title, start, "end", location, metadata)
        VALUES (
          v_owner,
          'fam-pappa',
          d,
          'Handling + ukesforberedelser',
          '10:00',
          '12:00',
          'Kiwi + apotek',
          jsonb_build_object(
            'participants', jsonb_build_array('fam-pappa', 'kid-leo'),
            'transport', jsonb_build_object('dropoffBy', 'fam-pappa', 'pickupBy', 'fam-pappa', 'dropoffMode', 'car', 'pickupMode', 'car', 'needsCarSeat', true),
            'sourceId', 'seed-packed-month'
          )
        );

        INSERT INTO public.events (user_id, person_id, date, title, start, "end", location, recurrence_group_id, metadata)
        VALUES (
          v_owner,
          'kid-noah',
          d,
          'Svømmetrening',
          '13:00',
          '14:15',
          'Bybadet',
          rg_swim,
          jsonb_build_object(
            'participants', jsonb_build_array('kid-noah', 'fam-mamma'),
            'transport', jsonb_build_object('dropoffBy', 'fam-mamma', 'pickupBy', 'fam-mamma', 'dropoffMode', 'car', 'pickupMode', 'car'),
            'sourceId', 'seed-packed-month'
          )
        );
      ELSE
        INSERT INTO public.events (user_id, person_id, date, title, start, "end", location, notes, metadata)
        VALUES (
          v_owner,
          'fam-mamma',
          d,
          'Søndag planlegging + matbokser',
          '17:30',
          '19:00',
          'Hjemme',
          'Planlegg skoleuke, pakk gymtøy, sjekk meldinger fra skole.',
          jsonb_build_object(
            'participants', jsonb_build_array('fam-mamma', 'fam-pappa'),
            'sourceId', 'seed-packed-month'
          )
        );
      END IF;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- Explicit recurrence examples (same group id across month)
  -- ---------------------------------------------------------------------------
  FOR d IN SELECT generate_series(v_month_start, v_month_end, interval '1 day')::date LOOP
    iso_dow := extract(isodow from d);

    -- SFO mornings every Tue/Thu
    IF iso_dow IN (2,4) THEN
      INSERT INTO public.events (
        user_id, person_id, date, title, start, "end", recurrence_group_id, metadata
      ) VALUES (
        v_owner,
        'kid-leo',
        d,
        'SFO morgen',
        '07:20',
        '08:20',
        rg_sfo,
        jsonb_build_object(
          'participants', jsonb_build_array('kid-leo', 'fam-pappa'),
          'transport', jsonb_build_object('dropoffBy', 'fam-pappa', 'dropoffMode', 'car', 'needsCarSeat', true),
          'sourceId', 'seed-packed-month'
        )
      );
    END IF;

    -- Math tutoring every Monday
    IF iso_dow = 1 THEN
      INSERT INTO public.events (
        user_id, person_id, date, title, start, "end", recurrence_group_id, reminder_minutes, metadata
      ) VALUES (
        v_owner,
        'kid-emma',
        d,
        'Mattehjelp',
        '15:30',
        '16:30',
        rg_math,
        30,
        jsonb_build_object(
          'participants', jsonb_build_array('kid-emma', 'fam-mamma'),
          'sourceId', 'seed-packed-month'
        )
      );
    END IF;
  END LOOP;

END $$;

-- Quick check queries (optional):
-- SELECT count(*) AS members FROM public.family_members WHERE user_id = '<your uuid>';
-- SELECT count(*) AS events_this_month FROM public.events
-- WHERE user_id = '<your uuid>'
--   AND date BETWEEN date_trunc('month', current_date)::date
--                AND (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
-- SELECT token, target_member_id, expires_at FROM public.family_invites
-- WHERE from_user_id = '<your uuid>' AND accepted_at IS NULL
-- ORDER BY created_at DESC;
