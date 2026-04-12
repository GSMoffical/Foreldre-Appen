-- =============================================================================
-- PACKED FAMILY SEED  — exercises every app feature at capacity
-- =============================================================================
-- Requires (run in this order first):
--   supabase-setup.sql
--   supabase-fix.sql
--   supabase-family-members-profile.sql
--   supabase-invites.sql
--   supabase-invite-target-member.sql
--   supabase-events-update-rpc.sql
--   supabase-family-members-rls-linked.sql
--   supabase-tasks.sql
--
-- BEFORE RUNNING:
--   Replace the placeholder UUID on the v_owner line with your real user id.
--   Dashboard → Authentication → Users → your row → copy UUID.
--
-- WHAT THIS CREATES:
--   Family:  2 parents (Kristin + Erik) + 3 children (Emma, Leo, Sofie)
--            — full work/school profiles, custom subjects, all five color slots
--   Events:  4 weeks of data (previous, current, next, week+2)
--            — recurring series, transport, participants, notes, location, reminders
--            — overlapping same-day events to stress the timeline layout
--   Tasks:   overdue (past week, open), today + this week, upcoming next week,
--            completed examples — with every combination of due_time / person fields
-- =============================================================================

DO $$
DECLARE
  -- !! Replace this with your auth.users UUID !!
  v_owner uuid := '11111111-1111-1111-1111-111111111111'::uuid;

  -- Week start anchors (ISO Monday = day 1)
  v_prev_mon  date := current_date - (extract(isodow from current_date)::int - 1) - 7;
  v_week_mon  date := current_date - (extract(isodow from current_date)::int - 1);
  v_next_mon  date := current_date - (extract(isodow from current_date)::int - 1) + 7;
  v_next2_mon date := current_date - (extract(isodow from current_date)::int - 1) + 14;

  -- Recurring series UUIDs (stable across all 4 weeks)
  rg_fotball  uuid := gen_random_uuid();  -- Emma fotball (Mon)
  rg_svom     uuid := gen_random_uuid();  -- Leo svømmeskole (Mon)
  rg_teater   uuid := gen_random_uuid();  -- Sofie teaterøvelse (Tue)
  rg_musikk   uuid := gen_random_uuid();  -- Emma musikk/piano (Wed)
  rg_sfo      uuid := gen_random_uuid();  -- Leo SFO morgenvakt (Thu)
  rg_speider  uuid := gen_random_uuid();  -- Leo speidermøte (Wed, starts next week)

BEGIN
  -- Guard: abort if placeholder UUID was not replaced
  IF v_owner = '11111111-1111-1111-1111-111111111111'::uuid THEN
    RAISE EXCEPTION
      'supabase-seed-packed-family.sql: replace v_owner with your real auth.users UUID.';
  END IF;

  -- Clean slate for this owner only
  DELETE FROM public.tasks          WHERE user_id = v_owner;
  DELETE FROM public.events         WHERE user_id = v_owner;
  DELETE FROM public.family_invites WHERE from_user_id = v_owner;
  DELETE FROM public.family_members WHERE user_id = v_owner;

-- =============================================================================
-- FAMILY MEMBERS
-- =============================================================================

  INSERT INTO public.family_members
    (id, user_id, name, color_tint, color_accent, sort_order, member_kind, profile)
  VALUES

  -- Parent: Kristin (you) — amber
  (
    'pk-kristin', v_owner, 'Kristin', '#fef3c7', '#f59e0b', 0, 'parent',
    jsonb_build_object(
      'work', jsonb_build_object(
        'weekdays', jsonb_build_object(
          '0', jsonb_build_object('start','08:30','end','15:30'),
          '1', jsonb_build_object('start','08:30','end','15:30'),
          '2', jsonb_build_object('start','08:30','end','15:30'),
          '3', jsonb_build_object('start','08:30','end','15:30'),
          '4', jsonb_build_object('start','08:30','end','13:00')
        )
      )
    )
  ),

  -- Parent: Erik (other parent, pending invite) — blue
  (
    'pk-erik', v_owner, 'Erik', '#dbeafe', '#3b82f6', 1, 'parent',
    jsonb_build_object(
      'work', jsonb_build_object(
        'weekdays', jsonb_build_object(
          '0', jsonb_build_object('start','07:30','end','16:00'),
          '1', jsonb_build_object('start','07:30','end','16:00'),
          '2', jsonb_build_object('start','07:30','end','16:00'),
          '3', jsonb_build_object('start','07:30','end','16:00'),
          '4', jsonb_build_object('start','07:30','end','14:00')
        )
      )
    )
  ),

  -- Child: Emma (10 år, grade 5-7) — green, detailed Monday + Thursday lessons
  (
    'pk-emma', v_owner, 'Emma', '#dcfce7', '#22c55e', 2, 'child',
    jsonb_build_object(
      'school', jsonb_build_object(
        'gradeBand', '5-7',
        'weekdays', jsonb_build_object(
          '0', jsonb_build_object(
            'useSimpleDay', false,
            'schoolStart','08:15','schoolEnd','14:30',
            'lessons', jsonb_build_array(
              jsonb_build_object('subjectKey','norsk',      'start','08:15','end','09:00'),
              jsonb_build_object('subjectKey','matematikk', 'start','09:15','end','10:15'),
              jsonb_build_object('subjectKey','english',    'start','10:30','end','11:15'),
              jsonb_build_object('subjectKey','naturfag',   'start','12:00','end','13:00'),
              jsonb_build_object('subjectKey','custom',
                'customLabel','Kunst og håndverk',         'start','13:15','end','14:30')
            )
          ),
          '1', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:15','schoolEnd','14:30'),
          '2', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:15','schoolEnd','13:45'),
          '3', jsonb_build_object(
            'useSimpleDay', false,
            'schoolStart','08:15','schoolEnd','14:30',
            'lessons', jsonb_build_array(
              jsonb_build_object('subjectKey','musikk',     'start','08:15','end','09:00'),
              jsonb_build_object('subjectKey','gym',        'start','09:15','end','10:30'),
              jsonb_build_object('subjectKey','matematikk', 'start','11:00','end','12:00'),
              jsonb_build_object('subjectKey','norsk',      'start','12:45','end','14:30')
            )
          ),
          '4', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:15','schoolEnd','13:00')
        )
      )
    )
  ),

  -- Child: Leo (7 år, grade 1-4) — purple, simple school days + SFO
  (
    'pk-leo', v_owner, 'Leo', '#ede9fe', '#8b5cf6', 3, 'child',
    jsonb_build_object(
      'school', jsonb_build_object(
        'gradeBand', '1-4',
        'weekdays', jsonb_build_object(
          '0', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:30','schoolEnd','13:00'),
          '1', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:30','schoolEnd','13:00'),
          '2', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:30','schoolEnd','12:00'),
          '3', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:30','schoolEnd','13:00'),
          '4', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:30','schoolEnd','12:30')
        )
      )
    )
  ),

  -- Child: Sofie (15 år, grade 8-10) — rose, full school days
  (
    'pk-sofie', v_owner, 'Sofie', '#fee2e2', '#ef4444', 4, 'child',
    jsonb_build_object(
      'school', jsonb_build_object(
        'gradeBand', '8-10',
        'weekdays', jsonb_build_object(
          '0', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:00','schoolEnd','15:30'),
          '1', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:00','schoolEnd','15:30'),
          '2', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:00','schoolEnd','14:45'),
          '3', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:00','schoolEnd','15:30'),
          '4', jsonb_build_object('useSimpleDay', true, 'schoolStart','08:00','schoolEnd','14:00')
        )
      )
    )
  );

-- =============================================================================
-- PENDING INVITE — Erik can claim his row by accepting this
-- =============================================================================

  INSERT INTO public.family_invites
    (from_user_id, token, invited_email, expires_at, accepted_at, target_member_id)
  VALUES (
    v_owner,
    'packed-erik-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text),1,8),
    NULL,
    now() + interval '30 days',
    NULL,
    'pk-erik'
  );

-- =============================================================================
-- EVENTS  (column order: user_id, person_id, date, title, start, "end",
--          notes, location, recurrence_group_id, reminder_minutes, metadata)
-- =============================================================================

-- ── PREVIOUS WEEK ────────────────────────────────────────────────────────────
-- Recurring anchors + two ad-hoc events so the week isn't empty

  INSERT INTO public.events
    (user_id, person_id, date, title, start, "end", notes, location, recurrence_group_id, reminder_minutes, metadata)
  VALUES
  -- Mon: Emma fotball (recurring)
  ( v_owner,'pk-emma', v_prev_mon+0, 'Fotball – trening',   '16:00','17:30',
    NULL, 'Idrettsbanen', rg_fotball, NULL,
    jsonb_build_object('transport',jsonb_build_object('dropoffBy','pk-kristin','pickupBy','pk-erik'),
                       'participants',jsonb_build_array('pk-emma')) ),
  -- Mon: Leo svømmeskole (recurring)
  ( v_owner,'pk-leo',  v_prev_mon+0, 'Svømmeskole',         '17:45','18:30',
    NULL, 'Badet', rg_svom, NULL,
    jsonb_build_object('transport',jsonb_build_object('dropoffBy','pk-erik','pickupBy','pk-erik')) ),
  -- Tue: Sofie teater (recurring)
  ( v_owner,'pk-sofie',v_prev_mon+1, 'Teaterøvelse',        '15:30','17:30',
    NULL, 'Kulturhuset', rg_teater, NULL,
    jsonb_build_object('transport',jsonb_build_object('pickupBy','pk-kristin')) ),
  -- Tue: Kristin – lege Leo
  ( v_owner,'pk-kristin',v_prev_mon+1,'Legesjekk – Leo',    '09:30','10:15',
    'Vaksine og vektkontroll', 'Helsesenteret', NULL, 15,
    jsonb_build_object('participants',jsonb_build_array('pk-kristin','pk-leo')) ),
  -- Wed: Emma musikk (recurring)
  ( v_owner,'pk-emma', v_prev_mon+2, 'Musikktimer – piano', '14:45','15:30',
    NULL, 'Musikkhuset, rom 3', rg_musikk, 15, NULL ),
  -- Thu: Leo SFO (recurring)
  ( v_owner,'pk-leo',  v_prev_mon+3, 'SFO morgenvakt',      '07:15','08:25',
    NULL, NULL, rg_sfo, NULL, NULL ),
  -- Fri: Erik – møte med skolen om Sofie
  ( v_owner,'pk-erik', v_prev_mon+4, 'Møte skole – Sofie',  '13:00','14:00',
    'IOP-gjennomgang med kontaktlærer', 'Skolen, møterom 2', NULL, 30, NULL );

-- ── CURRENT WEEK ─────────────────────────────────────────────────────────────

  INSERT INTO public.events
    (user_id, person_id, date, title, start, "end", notes, location, recurrence_group_id, reminder_minutes, metadata)
  VALUES
  -- Mon: Emma fotball (recurring) — Kristin drops, Erik picks
  ( v_owner,'pk-emma', v_week_mon+0, 'Fotball – trening',   '16:00','17:30',
    NULL, 'Idrettsbanen', rg_fotball, NULL,
    jsonb_build_object('transport',jsonb_build_object('dropoffBy','pk-kristin','pickupBy','pk-erik'),
                       'participants',jsonb_build_array('pk-emma')) ),
  -- Mon: Leo svømmeskole (recurring)
  ( v_owner,'pk-leo',  v_week_mon+0, 'Svømmeskole',         '17:45','18:30',
    NULL, 'Badet', rg_svom, NULL,
    jsonb_build_object('transport',jsonb_build_object('dropoffBy','pk-erik','pickupBy','pk-erik')) ),
  -- Mon: Kristin – tannlege (Emma er med)
  ( v_owner,'pk-kristin',v_week_mon+0,'Tannlege – Emma',    '10:00','10:45',
    'Kontroll + røntgen', 'Tannklinikken Storgata', NULL, 30,
    jsonb_build_object('participants',jsonb_build_array('pk-kristin','pk-emma')) ),

  -- Tue: Sofie teater (recurring)
  ( v_owner,'pk-sofie',v_week_mon+1, 'Teaterøvelse',        '15:30','17:30',
    'Husk manuset!', 'Kulturhuset', rg_teater, NULL,
    jsonb_build_object('transport',jsonb_build_object('pickupBy','pk-kristin')) ),
  -- Tue: Kristin – foreldremøte barneskolen
  ( v_owner,'pk-kristin',v_week_mon+1,'Foreldremøte',       '18:00','19:30',
    'Tema: digitale hjelpemidler på skolen', 'Barneskolen, gymsal', NULL, 20, NULL ),

  -- Wed: Emma musikk (recurring)
  ( v_owner,'pk-emma', v_week_mon+2, 'Musikktimer – piano', '14:45','15:30',
    NULL, 'Musikkhuset, rom 3', rg_musikk, 15, NULL ),
  -- Wed: Leo – besøk venn
  ( v_owner,'pk-leo',  v_week_mon+2, 'Besøk: Mathias',      '14:00','16:30',
    'Leo er hjemme hos Mathias', 'Furubakken 12', NULL, NULL, NULL ),
  -- Wed: Familiemiddag (alle er med)
  ( v_owner,'pk-kristin',v_week_mon+2,'Familiemiddag',      '17:30','19:30',
    'Bestefar og bestemor kommer', NULL, NULL, NULL,
    jsonb_build_object('participants',
      jsonb_build_array('pk-kristin','pk-erik','pk-emma','pk-leo','pk-sofie')) ),

  -- Thu: Leo SFO (recurring)
  ( v_owner,'pk-leo',  v_week_mon+3, 'SFO morgenvakt',      '07:15','08:25',
    NULL, NULL, rg_sfo, NULL, NULL ),
  -- Thu: Sofie – regionsmesterskap gym
  ( v_owner,'pk-sofie',v_week_mon+3, 'Gym-konkurranse',     '14:30','16:30',
    'Regionsmesterskap – husk niste og drikke', 'Kommunalhallen', NULL, 30, NULL ),
  -- Thu: Erik – lege kontroll (overlaps work hours — tests stacking)
  ( v_owner,'pk-erik', v_week_mon+3, 'Lege – kontroll',     '12:00','12:45',
    'Fastlegen Dr. Sandvik', 'Legesenteret', NULL, 30, NULL ),

  -- Fri: Sofie – bursdagsselskap venninne Julie
  ( v_owner,'pk-sofie',v_week_mon+4, 'Bursdagsselskap – Julie','16:00','21:00',
    'Hentes kl 21:00 skarpt', 'Rosenveien 8', NULL, NULL,
    jsonb_build_object('transport',jsonb_build_object('dropoffBy','pk-erik','pickupBy','pk-kristin')) ),
  -- Fri: Kristin + de to yngste – pizza-kveld
  ( v_owner,'pk-kristin',v_week_mon+4,'Pizza-kveld hjemme', '18:00','20:00',
    'Fredagsfilm etterpå', NULL, NULL, NULL,
    jsonb_build_object('participants',jsonb_build_array('pk-kristin','pk-emma','pk-leo')) );

-- ── NEXT WEEK ─────────────────────────────────────────────────────────────────

  INSERT INTO public.events
    (user_id, person_id, date, title, start, "end", notes, location, recurrence_group_id, reminder_minutes, metadata)
  VALUES
  -- Mon: recurring
  ( v_owner,'pk-emma', v_next_mon+0, 'Fotball – trening',   '16:00','17:30',
    NULL, 'Idrettsbanen', rg_fotball, NULL,
    jsonb_build_object('transport',jsonb_build_object('dropoffBy','pk-erik','pickupBy','pk-kristin'),
                       'participants',jsonb_build_array('pk-emma')) ),
  ( v_owner,'pk-leo',  v_next_mon+0, 'Svømmeskole',         '17:45','18:30',
    NULL, 'Badet', rg_svom, NULL,
    jsonb_build_object('transport',jsonb_build_object('dropoffBy','pk-kristin','pickupBy','pk-kristin')) ),
  -- Tue: recurring
  ( v_owner,'pk-sofie',v_next_mon+1, 'Teaterøvelse',        '15:30','17:30',
    NULL, 'Kulturhuset', rg_teater, NULL,
    jsonb_build_object('transport',jsonb_build_object('pickupBy','pk-erik')) ),
  -- Wed: recurring + speidermøte (first occurrence)
  ( v_owner,'pk-emma', v_next_mon+2, 'Musikktimer – piano', '14:45','15:30',
    NULL, 'Musikkhuset, rom 3', rg_musikk, 15, NULL ),
  ( v_owner,'pk-leo',  v_next_mon+2, 'Speidermøte',         '17:00','18:30',
    'Ta med kniv og sovepose', 'Speiderhulen', rg_speider, NULL, NULL ),
  -- Thu: recurring + skoleutflukt Emma + Sofie presentasjon
  ( v_owner,'pk-leo',  v_next_mon+3, 'SFO morgenvakt',      '07:15','08:25',
    NULL, NULL, rg_sfo, NULL, NULL ),
  ( v_owner,'pk-emma', v_next_mon+3, 'Skoleutflukt – Bymuseet','08:30','14:30',
    'Husk matpakke, regnjakke og lommepenger', 'Bymuseet', NULL, 60, NULL ),
  ( v_owner,'pk-sofie',v_next_mon+3, 'Presentasjon i klassen','09:00','10:30',
    'Geografi – Sør-Amerika', NULL, NULL, 20, NULL ),
  -- Fri: Kristin arbeidsmøte ute + Erik planleggingsdag
  ( v_owner,'pk-kristin',v_next_mon+4,'Arbeidsmøte – konferanse','09:00','16:00',
    'Kan ikke hente unger – Erik tar over', 'Holmenkollen Park Hotel', NULL, 30, NULL ),
  ( v_owner,'pk-erik', v_next_mon+4, 'Planleggingsdag (fridag)','08:00','15:00',
    'Henter Leo og Emma + handling', NULL, NULL, NULL, NULL );

-- ── WEEK AFTER NEXT ───────────────────────────────────────────────────────────

  INSERT INTO public.events
    (user_id, person_id, date, title, start, "end", notes, location, recurrence_group_id, reminder_minutes, metadata)
  VALUES
  -- Mon: recurring
  ( v_owner,'pk-emma', v_next2_mon+0,'Fotball – trening',   '16:00','17:30',
    NULL, 'Idrettsbanen', rg_fotball, NULL,
    jsonb_build_object('transport',jsonb_build_object('dropoffBy','pk-kristin','pickupBy','pk-erik'),
                       'participants',jsonb_build_array('pk-emma')) ),
  ( v_owner,'pk-leo',  v_next2_mon+0,'Svømmeskole',         '17:45','18:30',
    NULL, 'Badet', rg_svom, NULL, NULL ),
  -- Tue: recurring
  ( v_owner,'pk-sofie',v_next2_mon+1,'Teaterøvelse',        '15:30','17:30',
    NULL, 'Kulturhuset', rg_teater, NULL,
    jsonb_build_object('transport',jsonb_build_object('pickupBy','pk-kristin')) ),
  -- Wed: recurring + speidermøte (second occurrence) + halvårssamtaler (both parents!)
  ( v_owner,'pk-emma', v_next2_mon+2,'Musikktimer – piano', '14:45','15:30',
    NULL, 'Musikkhuset, rom 3', rg_musikk, 15, NULL ),
  ( v_owner,'pk-leo',  v_next2_mon+2,'Speidermøte',         '17:00','18:30',
    NULL, 'Speiderhulen', rg_speider, NULL, NULL ),
  ( v_owner,'pk-kristin',v_next2_mon+2,'Halvårssamtale Emma','13:30','14:00',
    'Kontaktlærer: Frk. Dahl', 'Barneskolen', NULL, 60,
    jsonb_build_object('participants',jsonb_build_array('pk-kristin','pk-emma')) ),
  ( v_owner,'pk-erik', v_next2_mon+2,'Halvårssamtale Leo',  '14:15','14:45',
    'Kontaktlærer: Hr. Bakken', 'Barneskolen', NULL, 60,
    jsonb_build_object('participants',jsonb_build_array('pk-erik','pk-leo')) ),
  -- Thu: recurring
  ( v_owner,'pk-leo',  v_next2_mon+3,'SFO morgenvakt',      '07:15','08:25',
    NULL, NULL, rg_sfo, NULL, NULL ),
  -- Sat: Sofie fotballkamp (whole family attends) + Leo fritidsaktivitet
  ( v_owner,'pk-sofie',v_next2_mon+5,'Fotballkamp – seriekamp','11:00','12:30',
    'Hjemmekamp – heie! Ta med sitteunderlag', 'Kommunalbanen', NULL, 30,
    jsonb_build_object('participants',
      jsonb_build_array('pk-sofie','pk-kristin','pk-erik','pk-emma','pk-leo')) ),
  ( v_owner,'pk-sofie',v_next2_mon+5,'Pianoopptreden – høstkonsert','14:00','16:00',
    'Formelt antrekk. Inviter besteforeldre!', 'Kulturhuset – Stor sal', NULL, 120, NULL );

-- =============================================================================
-- TASKS
-- =============================================================================

-- ── Past week — OVERDUE (open, past due date) ─────────────────────────────────

  INSERT INTO public.tasks
    (user_id, title, date, due_time, assigned_to_person_id, child_person_id, notes)
  VALUES
  ( v_owner, 'Bestill time hos tannlege – Leo',
    v_prev_mon+1, '09:00', 'pk-kristin', 'pk-leo',
    NULL ),
  ( v_owner, 'Hent resept på apotek – Erik',
    v_prev_mon+2, '12:00', 'pk-erik', NULL,
    'Hvit pose i blodtrykksmedisiner (Dr. Sandvik)' ),
  ( v_owner, 'Kjøp fotballsko til Emma (str 36)',
    v_prev_mon+3, NULL, 'pk-kristin', 'pk-emma',
    'Intersport – halv pris, sjekk salg' ),
  ( v_owner, 'Send inn samtykkeskjema – skoletur',
    v_prev_mon+4, '15:00', 'pk-kristin', 'pk-emma',
    'Lenke kom på e-post fra Frk. Dahl' );

-- ── Past week — COMPLETED ─────────────────────────────────────────────────────

  INSERT INTO public.tasks
    (user_id, title, date, assigned_to_person_id, child_person_id, completed_at)
  VALUES
  ( v_owner, 'Handle til familiemiddag',
    v_prev_mon+2, 'pk-kristin', NULL,    now() - interval '5 days' ),
  ( v_owner, 'Betale aktivitetspenger – Emma',
    v_prev_mon+0, 'pk-kristin', 'pk-emma', now() - interval '6 days' ),
  ( v_owner, 'Levere Leo-ryggsekk til vasken',
    v_prev_mon+1, 'pk-erik',   'pk-leo',  now() - interval '5 days' );

-- ── Current week — OPEN ───────────────────────────────────────────────────────

  INSERT INTO public.tasks
    (user_id, title, date, due_time, assigned_to_person_id, child_person_id, notes)
  VALUES
  ( v_owner, 'Ring skolen ang. Sofie fraværsdag',
    v_week_mon+0, '10:00', 'pk-kristin', 'pk-sofie',
    NULL ),
  ( v_owner, 'Sende ukemeny til SFO (Schoollink)',
    v_week_mon+0, NULL, 'pk-erik', 'pk-leo',
    'Åpne Schoollink-appen og velg uke' ),
  ( v_owner, 'Hente Emma fra fotball (backup hvis Erik ikke kan)',
    v_week_mon+1, '17:30', 'pk-kristin', 'pk-emma',
    NULL ),
  ( v_owner, 'Fikse sykkel – Leo, punktering',
    v_week_mon+2, NULL, 'pk-erik', 'pk-leo',
    'Pump i boden – prøv først. Ellers sykkelverksted.' ),
  ( v_owner, 'Kjøp bursdagsgave til Julie',
    v_week_mon+3, '16:00', 'pk-kristin', 'pk-sofie',
    'Ønskeliste: gavekort Boozt, parfyme Zara, eller bok' ),
  ( v_owner, 'Skriv under IKT-regler (Sofie)',
    v_week_mon+3, NULL, 'pk-erik', 'pk-sofie',
    NULL ),
  ( v_owner, 'Rydde kjellerbod – sportsrom',
    v_week_mon+4, NULL, 'pk-kristin', NULL,
    'Finn hockeyhjelm + ski-støvler til Leo, lagre sommergreier' ),
  ( v_owner, 'Fylle ut egenmeldingsskjema',
    v_week_mon+4, '12:00', 'pk-kristin', NULL,
    NULL );

-- ── Current week — COMPLETED ─────────────────────────────────────────────────

  INSERT INTO public.tasks
    (user_id, title, date, assigned_to_person_id, child_person_id, completed_at)
  VALUES
  ( v_owner, 'Bestille bøker til Emma – bokhandelen',
    v_week_mon+0, 'pk-kristin', 'pk-emma', now() - interval '3 hours' ),
  ( v_owner, 'Melde Emma på sommerleir (frist i dag)',
    v_week_mon+1, 'pk-kristin', 'pk-emma', now() - interval '1 day' );

-- ── Next week — UPCOMING ──────────────────────────────────────────────────────

  INSERT INTO public.tasks
    (user_id, title, date, due_time, assigned_to_person_id, child_person_id, notes)
  VALUES
  ( v_owner, 'Hente Sofie etter teateropptreden',
    v_next_mon+1, '19:30', 'pk-erik', 'pk-sofie',
    NULL ),
  ( v_owner, 'Betale klassetur – Sofie (Vipps)',
    v_next_mon+2, NULL, 'pk-kristin', 'pk-sofie',
    'Vipps kr 490 til kontaktlærer, merk «Klassetur Sofie»' ),
  ( v_owner, 'Pakke niste + regnjakke – skoleutflukt Emma',
    v_next_mon+3, '07:30', 'pk-kristin', 'pk-emma',
    NULL ),
  ( v_owner, 'Sjekke om Leo trenger ny vinterdress',
    v_next_mon+2, NULL, 'pk-kristin', 'pk-leo',
    'Prøv den røde fra i fjor – kanskje for liten' ),
  ( v_owner, 'Storhandel weekend (se liste på kjøleskap)',
    v_next_mon+4, NULL, 'pk-erik', NULL,
    NULL );

END $$;

-- =============================================================================
-- AFTER RUNNING — what you should see:
--
--   People bar: 5 members (Kristin amber, Erik blue, Emma green, Leo purple, Sofie rose)
--
--   School/work backgrounds:
--     • Emma: Monday detailed subjects (Norsk, Matte, Engelsk, Naturfag, Kunst&H)
--     • Emma: Thursday detailed subjects (Musikk, Gym, Matte, Norsk)
--     • Emma/Leo/Sofie: simple Skole blocks other days
--     • Kristin/Erik: work blocks Mon–Fri (background layer)
--
--   Recurring events across all 4 weeks:
--     • Monday:    Emma fotball (Kristin drops / Erik picks) + Leo svømmeskole
--     • Tuesday:   Sofie teaterøvelse (Kristin or Erik picks)
--     • Wednesday: Emma musikk/piano + Leo speidermøte (next 2 weeks only)
--     • Thursday:  Leo SFO morgenvakt
--
--   Transport indicators: color stripes on Emma fotball, Leo svømmeskole,
--     Sofie teater, Sofie bursdagsselskap, Emma skoleutflukt
--
--   Multi-participant events: familiemiddag, Sofie fotballkamp (alle med),
--     halvårssamtaler (Kristin+Emma / Erik+Leo in same time slot same day)
--
--   Tasks surface:
--     • Forfalt (past week): 4 open overdue tasks across Mon–Fri
--     • I dag / denne uken: 8 open tasks + 2 completed
--     • Kommende (neste uke): 5 upcoming tasks
--     • Ferdige toggle: 5 completed total
--
-- To get the Erik invite link (so a second browser tab can accept it):
--   SELECT token FROM public.family_invites
--   WHERE from_user_id = '<YOUR-UUID>' AND accepted_at IS NULL
--   ORDER BY created_at DESC LIMIT 1;
-- =============================================================================
