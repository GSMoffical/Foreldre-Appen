# ForeldrePortalen – MVP checklist

Use this to finish the polished MVP (simple parenting calendar) before adding Tankestrømmen, mail scraper, or school integrations.

---

## 1. Database & auth (do first)

- [ ] **Profiles table**  
  App expects `profiles` with columns: `id` (uuid, PK), `display_name`, `family_name`, `updated_at`.  
  If your table has `id` but is missing `family_name` or `updated_at`, run **`supabase-profiles-fix.sql`** in the SQL Editor.

- [ ] **Events table**  
  App needs: `recurrence_group_id` (uuid), `reminder_minutes` (int), `metadata` (jsonb).  
  If missing, run **`supabase-fix.sql`** (it now adds these as well as notes/location).

- [ ] **Sign-up flow**  
  After the profile fix: create a new account and confirm sign-up works (including “sjekk e-posten”-message).  
  Check that the header shows “Du er: [navn]” and (if you set family name) “Familien [navn]”.

- [ ] **Invite flow**  
  As owner: create invite link in Innstillinger → copy → open in incognito (or another browser), sign up with the invite token in the URL.  
  Confirm the second user sees the same family and calendar.

---

## 2. Core calendar flows

- [ ] **Add event**  
  Legg til → fill title, person, time, optional notes/location/reminder → save.  
  Event appears on the correct day in I dag / Uke.

- [ ] **Edit & delete event**  
  Open event → endre → change and save; open again → slett (this occurrence or whole series if recurring).  
  No crashes; list/timeline updates.

- [ ] **Recurring event**  
  Add event with “Gjentakelse” (e.g. weekly) and end date.  
  Multiple occurrences appear; editing “alle forekomster” updates all.

- [ ] **Logistikk**  
  Add event → in edit/detail, set “L”/“H” (or use “Jeg kan ta start/slutt” on Logistikk).  
  “Alle oppdrag” vs “Bare mine oppdrag” filters the list and stats.

---

## 3. Family & settings

- [ ] **Family members**  
  Innstillinger → add/edit/remove family members.  
  After removing a person, their events are gone; filter bar and logistics still work.

- [ ] **Notifications**  
  Innstillinger → enable notifications; add event with “Påminnelse”.  
  When the reminder time is reached (or you move device time), a browser notification appears (if allowed).

- [ ] **Clear all events**  
  Innstillinger → Fareområde → Slett alle aktiviteter → confirm.  
  Calendar is empty; family members remain.

- [ ] **Forlat familie**  
  As linked user: Innstillinger → Forlat familie → confirm.  
  You’re back on your own (empty) calendar.

---

## 4. Polish & edge cases

- [ ] **Empty states**  
  Empty day and empty week show the correct copy and “Legg til aktivitet” (or filter hint).

- [ ] **Loading**  
  Week load shows skeleton or clear loading; no long blank screen.

- [ ] **Errors**  
  Wrong credentials, network error, or missing Supabase config show a clear message (no white screen).  
  Family load error message is visible in the main content area.

- [ ] **Mobile frame**  
  App fits the device frame; zoom works; bottom nav and main actions are usable at 375px width.

- [ ] **Norwegian copy**  
  All user-facing strings in Norwegian; tone consistent with “ForeldrePortalen”.

---

## 5. Before calling MVP “done”

- [ ] Run through the full journey once: **sign up → add family members → add a few events (including one with transport) → invite second parent → accept invite → see shared calendar → edit event as second user → open Logistikk and use “Bare mine oppdrag”.**
- [ ] Decide if you want a **short onboarding** (e.g. one-time tooltip or welcome line like “Legg til familiemedlemmer og aktiviteter for å komme i gang”) or keep the first screen as-is.
- [ ] **Required handover note** in README (or deploy docs): Supabase env vars, run order for SQL files, and that profiles table must have `id` (or be adapted per `supabase-profiles-fix.sql`).

---

When all items above are checked and the full journey works, the MVP is ready for real users. After that you can plan Tankestrømmen, mail scraper, and school integrations.
