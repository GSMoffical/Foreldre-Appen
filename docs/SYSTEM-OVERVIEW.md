# ForeldrePortalen / parenting-calendar — system overview

This document describes how the app is structured end-to-end so a new developer or AI assistant can navigate the codebase quickly. Product direction (MVP, roadmap) lives in `docs/PRODUCT.md`.

---

## 1. What the app is

- **Single-page React app** (Vite + TypeScript + Tailwind) backed by **Supabase** (Postgres + Auth + Row Level Security).
- **Norwegian** UI copy throughout.
- Core job: **family calendar** — events per person, week/day views, logistics (transport), optional **school/work background blocks** generated from child/parent profiles.
- **Two-parent model**: one **calendar owner** (`user_id` in DB); an **invited parent** links to the owner’s data via `family_links` and sees/edits the same events and family list (with permission limits).

---

## 2. Tech stack

| Layer | Choice |
|--------|--------|
| UI | React 18, functional components |
| Build | Vite 5, `tsc -b` then `vite build` |
| Styling | Tailwind CSS (`src/index.css`, utility classes in components) |
| Motion | Framer Motion (sheets, small transitions) |
| Backend | Supabase JS client (`src/lib/supabaseClient.ts`) |
| Tests | Vitest (`npm test`), tests under `src/**/__tests__/` |
| Holidays | `date-holidays` (Norwegian public holidays where used) |

There is **no** React Router: navigation is **tab state** in `App.tsx` (`navTab`: today/week flow, month, logistics, settings).

---

## 3. React provider tree

Order matters (outer → inner) in `src/main.tsx`:

1. **ErrorBoundary** — catches render errors.
2. **AuthProvider** — Supabase session, `user`, sign in/out.
3. **EffectiveUserIdProvider** — resolves **whose data** to load (self vs linked family owner); see §4.
4. **FamilyProvider** — loads `family_members` for `effectiveUserId`, CRUD, optional seed, realtime refresh.
5. **ProfileProvider** — display name / profile helpers.
6. **UserPreferencesProvider** — persisted preferences (e.g. `currentPersonId` “me” chip, haptics).
7. **UndoProvider** — toast-style undo for destructive actions.
8. **App** — main shell, tabs, schedule, modals.

---

## 4. Identity: `effectiveUserId` and linked parents

### Calendar owner

- Data in Postgres is keyed by **`user_id`** = the Supabase auth user who **owns** that row (events, family_members for that household).

### Invited parent (`family_links`)

- Table **`family_links`**: `user_id` = invited user, `linked_to_user_id` = owner’s user id.
- **EffectiveUserIdContext** (`src/context/EffectiveUserIdContext.tsx`):
  - `effectiveUserId = linkedToUserId ?? user.id` — when linked, all reads/writes for “the family” use the **owner’s** `user_id`.
  - `isLinked === true` when a row exists in `family_links`.
  - `unlink()` deletes the link row (invited user goes back to their own empty calendar until they link again).

### Claiming a pre-created parent row (`linked_auth_user_id`)

- **`family_members`** can have **`linked_auth_user_id`** (uuid → `auth.users`) set when the invitee accepts an invite that names **`target_member_id`** (that parent’s `family_members.id` on the owner’s side).
- **Invite API** (`src/lib/inviteApi.ts`): `createInvite`, `getOrCreateInviteForTarget`, `fetchLatestPendingInvite`, `fetchPendingInviteForTarget`, `acceptInvite`, `getMyLink`, `buildInviteUrl`.
- **Permissions** (`src/hooks/usePermissions.ts`): invited users cannot add/remove arbitrary family members; they can edit **their** row — either legacy `self-<authUserId>` or the row where `linkedAuthUserId === auth.uid()`.
- **Me resolution** (`src/hooks/useResolvedMePersonId.ts`): prefers the person row whose `linkedAuthUserId` matches the current user, else `self-<userId>`, else saved preference.

Run SQL migrations in order documented in repo root `supabase-*.sql` files (see §6).

---

## 5. Data model (TypeScript)

Canonical definitions: **`src/types/index.ts`**.

- **Person** — `id`, `name`, `colorTint`, `colorAccent`, `memberKind` (`parent` | `child`), optional `school` / `work` profiles, optional **`linkedAuthUserId`**.
- **Event** — `id`, `personId`, `title`, `start` / `end` as **`HH:mm` strings (24h)**, `date` stored in DB per row; optional `recurrenceGroupId`, `reminderMinutes`, **`metadata`** (`EventMetadata`).
- **EventMetadata** — `transport`, `participants`, `sourceId`, `calendarLayer` (`foreground` | `background`), `backgroundKind`, etc. Designed for future automation (Tankestrømmen, mail scraper).

---

## 6. Supabase: tables and SQL files

Apply SQL in the **Supabase SQL Editor** in a sensible order. Typical progression:

| File | Purpose |
|------|---------|
| `supabase-setup.sql` | Base `events`, `family_members` (older policy names may be superseded later). |
| `supabase-profiles.sql` / `profiles` fixes | User profile display names, etc. |
| `supabase-family-members-profile.sql` | `member_kind`, `profile` JSON on `family_members`. |
| `supabase-invites.sql` | `family_links`, `family_invites`, `get_invite_by_token`, `accept_invite`, RLS updates for events/family. |
| `supabase-family-members-rls-linked.sql` | Ensures linked parents can read/write owner’s `family_members` / links. |
| `supabase-invite-target-member.sql` | `target_member_id` on invites, `linked_auth_user_id` on `family_members`, updated RPCs. **Requires DROP** if changing `get_invite_by_token` return shape. |
| `supabase-events-update-rpc.sql` / `supabase-events-owner-lock.sql` | RPCs for events (e.g. linked users editing events while preserving `user_id`). |
| `supabase-events-insert-recurring.sql` | Atomic recurring inserts (`insert_recurring_events_keep_owner`) so a full series succeeds/fails together. |
| `supabase-family-members-delete-rpc.sql` | Atomic family-member removal (`delete_family_member_and_events_keep_owner`) so member + their events are deleted together. |


**RLS** is central: policies are per-table; linked users must be explicitly allowed in `supabase-invites.sql` / `supabase-family-members-rls-linked.sql` patterns.

---

## 7. Frontend architecture

### 7.1 Entry and shell

- **`src/main.tsx`** — providers + `App`.
- **`src/App.tsx`** — auth gate, invite token handling (`?invite=` → `acceptInvite`), notices, **bottom nav**, tab content:
  - **Today / week list** — `FamilyFilterBar`, `WeekStrip`, `TimelineContainer` or `WeeklyList`, search, add/edit sheets.
  - **Month** — `MonthView`.
  - **Logistics** — `LogisticsScreen` (transport assignments).
  - **Settings** — `SettingsScreen` + embedded `FamilyEditor`.
- **`AppShell` / `MobileFrame`** — viewport height (`100dvh`), safe areas, overflow discipline for mobile.

### 7.2 Schedule logic (heart of the calendar)

- **`src/hooks/useScheduleState.ts`** — owns selected week, loaded events map, merge with **background** events, layout (pixels, overlaps), gaps, filters, CRUD through **`eventsApi`** using **`effectiveUserId`**. Uses **`useFamily().people`** to build school/work background rows via **`buildBackgroundEventsForDate`** (`src/lib/backgroundEvents.ts`).
- **`src/lib/schedule.ts`** — visibility, gaps, summaries, participant helpers.
- **`src/lib/overlaps.ts`** — column layout for overlapping events.
- **`src/lib/time.ts`** — `PIXELS_PER_HOUR`, time arithmetic.
- **`src/lib/eventLayer.ts`** — separates foreground vs background for display/interaction.

### 7.3 UI components (selected)

| Area | Files |
|------|--------|
| Timeline | `TimelineContainer.tsx`, `TimelineGrid.tsx`, `ActivityBlock.tsx`, `BackgroundBlock.tsx`, `TimeRail.tsx` |
| Events | `AddEventSheet.tsx`, `EditEventSheet.tsx`, `EventDetailSheet.tsx` |
| Family | `FamilyEditor.tsx`, `FamilyFilterBar.tsx`, `SchoolProfileFields.tsx`, `WorkProfileFields.tsx` |
| Settings | `SettingsScreen.tsx` |
| Auth | `AuthScreen.tsx` |

### 7.4 Contexts (summary)

| Context | Role |
|---------|------|
| `AuthContext` | Session |
| `EffectiveUserIdContext` | Owner id for all calendar/family queries when linked |
| `FamilyContext` | `people`, mutations, seeding, realtime on `family_members` |
| `UserPreferencesContext` | LocalStorage-backed prefs |
| `ProfileContext` | Profile display |
| `UndoContext` | Undo snackbars |

---

## 8. API modules (`src/lib/`)

| Module | Responsibility |
|--------|----------------|
| `supabaseClient.ts` | Supabase client singleton |
| `eventsApi.ts` | CRUD, date ranges, recurrence group updates, `clearAllEvents` |
| `familyApi.ts` | Map DB rows ↔ `Person`, CRUD `family_members` |
| `inviteApi.ts` | Invites, links, URL builder |
| `profileApi.ts` | Profile fetch/update |
| `backgroundEvents.ts` | Derive school/work blocks from profiles + Norwegian subject catalog |
| `norwegianSubjects.ts` / `data/` | Grade bands, subject keys, custom subject label |
| `supabaseErrors.ts` | User-facing Norwegian error strings |

---

## 9. Permissions (app-level)

Implemented in **`usePermissions`** + checks inside **`FamilyContext`** (`updatePerson` / `addPerson` / `removePerson`):

- **Owner**: full family management, invites, clear-all-events (if exposed).
- **Invited parent**: edit activities; edit **only** own family row (self chip or `linkedAuthUserId` row); cannot add/remove other members or send generic owner-only actions where disabled in UI.

---

## 10. Invites (UX summary)

- **Generic invite** (Settings): `createInvite(ownerId, email?)` — optional `target_member_id` null.
- **Parent-specific invite** (after adding a parent): `getOrCreateInviteForTarget(ownerId, email, memberId)` — ties token to **`family_invites.target_member_id`**; accept sets **`linked_auth_user_id`** on that `family_members` row.
- Recovery: **`fetchLatestPendingInvite`** (latest any) and **`fetchPendingInviteForTarget`** / per-row **“Vis invitasjonslenke”** in `FamilyEditor`.

---

## 11. Testing and quality

- **`npm test`** — Vitest unit tests (`schedule`, `time`, `overlaps`, `isoWeek`, recurrence, etc.).
- **`npm run build`** — Typecheck + production bundle.

---

## 12. Conventions for changes

- Prefer **small, focused diffs**; match existing patterns and naming.
- **Norwegian** user-visible strings.
- **`Event.metadata`** / **`sourceId`** — preserve for future AI/mail integrations.
- **No** hardcoded “mom/dad/two kids” — `Person`/`memberKind` stay flexible.
- SQL migrations: **non-destructive** where possible; document new columns/RPCs in the same `supabase-*.sql` files or new numbered migration files if you split them.

---

## 13. Quick file map

```
src/
  App.tsx                 # Tabs, invite URL handling, main calendar shell
  main.tsx                # Provider order
  components/             # UI (see §7.3)
  context/                # React contexts
  hooks/                  # useScheduleState, usePermissions, useResolvedMePersonId, reminders, etc.
  lib/                    # Supabase API, schedule math, background events
  data/                   # Static data (subjects, breaks, mock templates)
  types/index.ts          # Domain types
docs/
  PRODUCT.md              # Product strategy & roadmap
  SYSTEM-OVERVIEW.md      # This file
supabase-*.sql            # Database DDL/RLS/RPC (run in Supabase)
```

---

## 14. Environment

- Vite env vars in **`.env.local`** (not committed): **`VITE_SUPABASE_URL`**, **`VITE_SUPABASE_ANON_KEY`** — see `src/lib/supabaseClient.ts`.
- Calendar date keys (`YYYY-MM-DD`) are interpreted in **`Europe/Oslo`** to keep the family on one Norwegian day model, even when a user is traveling.
- Separate dev/prod Supabase projects are **not** fully documented in repo; treat migrations as the source of truth for schema.

---

*Last updated to reflect codebase patterns for onboarding editors and AI tools. Update this file when you change auth, invites, RLS, or core schedule architecture.*
