# Codebase Cleanup Report

**Branch:** `chore/codebase-cleanup` (off `feature/nav-redesign`)
**Date:** 2026-06-22
**Build gate:** GREEN throughout — `tsc --noEmit` exit 0 and `vite build` exit 0, verified before any change and after the A1 commit.

This report follows the **"separate DO from REPORT"** rule. Mechanical, provably-safe changes were committed; everything requiring human judgment or that could alter behavior is documented here for review. **No behavioral changes were made.**

---

## 0. Important deviations from the task's premises

Three of the task's stated assumptions were **factually wrong** when checked against the live repo. Per the golden rule ("if what you find contradicts how it was described, surface that"), the affected items were re-classified from DO to REPORT:

1. **A2 — the nested `Foreldre-Appen/` folder is NOT an "empty leftover."** It is an **orphaned git *gitlink*** (mode `160000`, commit `72a69066…`) with its own `.git/`, a `.gitattributes`, and an 18-byte `README.md`. Blind `git rm -r` would have been wrong and could leave a phantom index entry. → **Deferred to §A2 below with exact safe steps.**

2. **A1 — `mockSchedule.ts` is NOT a "dead no-op."** Beyond the empty `PEOPLE` array it also exports `getEventsForDate()` / `getEventsForWeek()` with substantial template data. However, those functions were independently verified to have **zero external callers**, so the file is still safely deletable. (The `getEventsForDate` hits in `src/lib/schedule.ts` are an unrelated *local* closure parameter, not this module's export.) → **DO; completed (see §A1).**

3. **B — the Supabase CLI is unavailable** in this environment (`supabase` not installed; `npx supabase` fails offline). The task says: *"If the Supabase CLI isn't available, STOP this part and report it — don't fake the structure."* → **No `supabase/` structure was created.** The full file→migration mapping and ordering analysis (the judgment-heavy part) is in §B.

Additionally:

4. **A3 — there is no orphaned MonthView wiring to remove.** `MonthView` is cleanly lazy-loaded only by `KalenderScreen`. A3 is a **no-op**. (See §A3.)

---

## Commits made (DO)

| Commit | Scope | Files |
|---|---|---|
| `chore(cleanup): remove dead mockSchedule data module (A1)` | A1 only | `src/context/FamilyContext.tsx` (import → local empty const), delete `src/data/mockSchedule.ts` |
| `docs: add CLEANUP_REPORT.md` | report | `CLEANUP_REPORT.md` |

> Note on WIP: the branch was created off `feature/nav-redesign`, which carries uncommitted work (nav redesign + Capacitor/native integration: 8 modified + 9 untracked files). Cleanup commits stage **only** their own files; the WIP remains untouched and unstaged. The build gate passed *with* the WIP present.

## Items deferred to this report (REPORT), with reasons

| Item | Why deferred |
|---|---|
| A2 (nested folder) | Not empty — orphaned gitlink; needs careful `git rm --cached` ordering, not blind delete |
| A3 (MonthView wiring) | No-op — nothing orphaned exists to remove |
| B (SQL consolidation) | Supabase CLI unavailable; task says STOP + report; can't verify with `supabase db reset` |
| C1–C5 | Report-only by task definition |

---

# Part A — Dead-code deletions

## A1 — `src/data/mockSchedule.ts` — DONE ✅

**Verification (high confidence):**
- `mockSchedule.ts:11` is exactly `export const PEOPLE: Person[] = []` (empty array literal).
- Repo-wide, the **only** code importer is `FamilyContext.tsx:6` (`import { PEOPLE as DEFAULT_PEOPLE }`). One docs prose mention in `README.md:76` (non-code).
- `getEventsForWeek` — zero callers anywhere. `getEventsForDate` — only an internal call inside the file; the `src/lib/schedule.ts` references are a **local parameter** (`schedule.ts` imports only from `./time` and `./osloCalendar`).
- Dedicated greps in `e2e/`, `tests/`, `scripts/`, `fixtures/` for `mockSchedule|getEventsForDate|getEventsForWeek` → no matches. No `export *` barrels re-export it.
- All 6 `DEFAULT_PEOPLE` usages in `FamilyContext.tsx` (lines 50, 87, 110, 130, 149, 155) resolve to the empty array — including `DEFAULT_PEOPLE.map(...)` which builds the seed payload (an empty `[]` today, so `insert([])` inserts nothing). Behaviorally identical to a local empty array.

**Change made:** replaced the import with a local, typed `const DEFAULT_PEOPLE: Person[] = []` (kept the name so the 6 call sites and `.map`'s `Person` typing are unchanged), then deleted `src/data/mockSchedule.ts`. `tsc --noEmit` stays green.

**Left for a human (optional, docs):** `README.md:76` still references `src/data/mockSchedule.ts` — stale, but a docs-only edit, so not changed here.

## A2 — nested `Foreldre-Appen/` folder — REPORT (do NOT blind-delete) ⚠️

**What it is:** an accidentally-committed **embedded git repo surfacing as an orphaned gitlink**, not a submodule and not empty.

Evidence:
- `git ls-files -s` → `160000 72a69066e506358f419044f56a4d406e1502fb62 0  Foreldre-Appen` (mode `160000` = gitlink). Present in current `HEAD`.
- **No `.gitmodules`** → `git submodule status` fails (`no submodule mapping found … for path 'Foreldre-Appen'`). Gitlink without mapping = orphaned.
- Inner repo: own `Foreldre-Appen/.git/`, a 66-byte `.gitattributes` (LF boilerplate), an 18-byte `README.md` (`# Foreldre-Appen`). Single commit `72a6906 "Initial commit"`, branch `main`, **no remotes**, no stashes, `fsck` finds no unreachable objects, 4 objects / 329 bytes total.
- The parent repo does **not** contain the gitlink's target commit (`git branch --contains 72a6906…` → `no such commit`). Signature of an embedded repo committed as a gitlink, not a fetched submodule.
- This is a **recurring accident**: `git log -- Foreldre-Appen` shows prior removal commits (`ff82f9a`, `e938c33`, `ecec70e`) — it has been removed and re-added multiple times.
- It is **not effectively ignored**: the last line of `.gitignore` was saved as **UTF-16LE bytes inside an ASCII file**, so `git check-ignore -v Foreldre-Appen` returns exit 1 (not ignored). This broken ignore line is part of why it keeps returning.

**Exact safe removal steps (for a human, from repo root):**
1. Confirm nothing worth keeping: `git -C Foreldre-Appen log --all --oneline` (expect only `72a6906`), `git -C Foreldre-Appen remote -v` (empty), `git -C Foreldre-Appen reflog`, `git -C Foreldre-Appen fsck --unreachable --lost-found`, `git -C Foreldre-Appen status` (clean). If any shows a remote / extra commits / uncommitted files → STOP and review.
2. (Optional) back up outside the repo: `cp -r Foreldre-Appen /tmp/Foreldre-Appen-backup`.
3. Un-track the gitlink (index only): `git rm --cached Foreldre-Appen` (no `-r`, no trailing slash).
4. Delete from working tree: `rm -rf Foreldre-Appen` (removes the inner `.git/` — that is why step 1 matters).
5. Fix `.gitignore`: delete the corrupted UTF-16 last line, add a clean ASCII `Foreldre-Appen/`, keep the file UTF-8. Re-check with `git check-ignore -v Foreldre-Appen`.
6. Commit; then verify `git ls-files -s | grep 160000` is empty and `git status` is clean.

> Do **not** `git submodule deinit` (no mapping), and do **not** `rm -rf` before `git rm --cached` (would leave a phantom gitlink in the index).

## A3 — orphaned MonthView wiring — REPORT (no-op) ✅

No orphaned wiring exists. The `MonthView` component is referenced only by:
- its own definition (`src/components/MonthView.tsx`), and
- `src/features/calendar/KalenderScreen.tsx` (lazy import `:8-9`, doc comment `:33`, JSX render `:89` in the "Måned" zoom branch).

Verified that `main.tsx`, `router.tsx`, and `App.tsx` contain **no** lazy import / route / render of `MonthView`. The `month` outlet-context bundle in `App.tsx` is **not** orphaned — it is the live data source `KalenderScreen` destructures and passes into `<MonthView>`. The many other `MonthView` grep hits are the unrelated `showInMonthView` task field. **Nothing to remove.**

---

# Part B — SQL migration consolidation — REPORT (CLI unavailable)

The Supabase CLI is not installed and cannot be fetched offline, so per the task instruction the `supabase/` structure was **not** created and no files were moved. Below is the complete, ready-to-execute plan: read all 26 files, classified them, and resolved the cross-file dependency order. **Originals remain in place at repo root.**

## B.1 — Proposed structure

```
supabase/
  migrations/      ← 20 schema migrations (timestamped, applied in order)
  scripts/
    ops/           ← 3 operational RPC/reset scripts (run manually, never auto-applied)
    seed/          ← 3 demo/seed scripts (hand-edit v_owner; run manually)
```

> **Timestamps below (`20240101NNNNNN_`) are PLACEHOLDERS** using a sequential 100-second-spaced scheme. The **relative order is the contract**, not the literal values — a human/CLI must assign real monotonic UTC timestamps preserving this order.

## B.2 — Full file → destination mapping

### → `supabase/migrations/` (schema, in dependency order)

| # | Original root file | Proposed migration name | Role |
|---|---|---|---|
| 1 | `supabase-setup.sql` | `…000100_init_events_and_family_members.sql` | Base tables `events`, `family_members` + RLS. **DROP TABLE … CASCADE at top — destructive on re-run.** Must be first. |
| 2 | `supabase-fix.sql` | `…000200_events_add_notes_location_recurrence_columns.sql` | Idempotent additive columns on `events`. |
| 3 | `supabase-family-members-profile.sql` | `…000300_family_members_add_member_kind_and_profile.sql` | Adds `member_kind` + `profile`. |
| 4 | `supabase-family-members-guest-kind.sql` | `…000400_family_members_member_kind_allow_guest.sql` | Drops/recreates `member_kind` CHECK to add `guest`. |
| 5 | `supabase-invites.sql` | `…000500_family_links_invites_tables_and_rpcs.sql` | `family_links`, `family_invites`, base `get_invite_by_token`/`accept_invite`. |
| 6 | `supabase-family-members-rls-linked.sql` | `…000600_family_members_rls_owner_or_linked.sql` | Reconciles all `family_members` policies to one owner-or-linked policy. |
| 7 | `supabase-invite-fix.sql` | `…000700_accept_invite_remove_email_guard.sql` | `CREATE OR REPLACE accept_invite` (removes email guard). |
| 8 | `supabase-invite-target-member.sql` | `…000800_invites_target_member_linking.sql` | Adds `target_member_id`/`linked_auth_user_id`; **DROP+recreate** `get_invite_by_token` (new return shape) + `accept_invite`. |
| 9 | `supabase-security-patch-invite-token.sql` | `…000900_get_invite_by_token_drop_from_email.sql` | GDPR hardening. **Hard dep on #8** (see risks). Last of invite chain. |
| 10 | `supabase-profiles.sql` | `…001000_profiles_table_and_policies.sql` | `profiles`; its SELECT policy queries `family_links` → must follow #5. |
| 11 | `supabase-profiles-fix.sql` | `…001100_profiles_add_family_name_updated_at.sql` | Idempotent additive columns on `profiles`. |
| 12 | `supabase-tasks.sql` | `…001200_tasks_table_rls_and_calendar_rpc.sql` | `tasks` + indexes + trigger + RLS + `get_tasks_for_calendar`; needs `family_links`. |
| 13 | `supabase-tasks-task-intent.sql` | `…001300_tasks_add_task_intent.sql` | Idempotent `task_intent` column + CHECK. |
| 14 | `supabase-events-update-rpc.sql` | `…001400_events_calendar_read_and_update_rpcs.sql` | `get_events_for_calendar` + base `update_event(s)_keep_owner`. |
| 15 | `supabase-events-person-id-nullable.sql` | `…001500_events_person_id_nullable_and_rpc_null_handling.sql` | Drops NOT NULL on `person_id`; **overrides #14's two RPCs**. |
| 16 | `supabase-events-insert-recurring.sql` | `…001600_events_insert_recurring_rpc.sql` | `insert_recurring_events_keep_owner`. |
| 17 | `supabase-events-owner-lock.sql` | `…001700_events_keep_owner_update_trigger.sql` | Optional hardening trigger (user_id immutable on UPDATE). |
| 18 | `supabase-family-members-delete-rpc.sql` | `…001800_delete_family_member_and_events_rpc.sql` | `delete_family_member_and_events_keep_owner` RPC (schema object). |
| 19 | `supabase-notifications.sql` | `…001900_notifications_table_rls_realtime.sql` | `notifications` table + RLS + Realtime; INSERT policy refs `family_links`. |
| 20 | `supabase-performance-indexes.sql` | `…002000_performance_indexes.sql` | Idempotent `CREATE INDEX IF NOT EXISTS` across all tables; last among schema. |

### → `supabase/scripts/ops/` (operational, never auto-applied)

| # | Original root file | Proposed name | Role |
|---|---|---|---|
| 21 | `supabase-delete-account.sql` | `…002100_delete_user_account_rpc.sql` | Account self-deletion RPC (deletes from `auth.users`). |
| 22 | `supabase-delete-all-events-owner-only.sql` | `…002200_delete_all_events_owner_only_rpc.sql` | Owner-only bulk-delete RPC (the safe replacement flagged in `AUDIT_REPORT.md` Issue 1). |
| 23 | `supabase-reset-all.sql` | `…002300_reset_all_truncate.sql` | Destructive `TRUNCATE … CASCADE` test reset; manual `auth.users` step. |

### → `supabase/scripts/seed/` (demo data, hand-edit `v_owner` first)

| # | Original root file | Proposed name | Role |
|---|---|---|---|
| 24 | `supabase-seed-demo-family.sql` | `…002400_seed_demo_family.sql` | 2 parents + 2 children + ~5 events for current week. |
| 25 | `supabase-seed-packed-family.sql` | `…002500_seed_packed_family.sql` | 5 members, ~30 events/4 weeks, ~24 tasks. **Also depends on `tasks` (#12).** |
| 26 | `supabase-seed-packed-month.sql` | `…002600_seed_packed_month.sql` | Programmatic full-month event seed. Contains mojibake in Norwegian strings (data-only). |

## B.3 — Ordering rationale (key points)

- **Tables → constraints/RLS → RPCs/indexes.** Base tables (`events`, `family_members`) first; additive column patches folded in immediately (orders 2, 3) so later objects can rely on them.
- **Near-cyclic dependency resolved:** `profiles` (10) has a SELECT policy querying `family_links`, while `invites` (5, which creates `family_links`) itself requires `events` + `family_members` to pre-exist. Resolved by: setup(1) → fm columns(3-4) → invites/family_links(5) → fm owner-or-linked RLS(6) → invite RPC chain(7-9) → profiles(10-11).
- **Invite RPC chain is strict and load-bearing:** `invites(5) → invite-fix(7) → invite-target-member(8) → security-patch(9)`. `security-patch`'s `get_invite_by_token` uses `CREATE OR REPLACE`, which **cannot change a function's return type** — so it only succeeds if `target-member(8)` already `DROP`+recreated it with the `target_member_id` signature.
- **Events RPC overrides:** `person-id-nullable(15)` is sequenced right after `update-rpc(14)` because it `CREATE OR REPLACE`s the same two functions.
- **`notifications(19)` before `performance-indexes(20)`** because the index file indexes `notifications`; performance-indexes is intentionally last (touches every table).
- **`*-fix` files** were each folded immediately after the migration they patch (all idempotent). The invite patches are kept as distinct sequential migrations because each supersedes the prior function definition.

## B.4 — Risks / caveats (must read before applying)

1. **Several base migrations are NOT idempotent.** `supabase-setup.sql` starts with `DROP TABLE … CASCADE` (destructive on re-run, wipes data + dependent objects). `invites`, `profiles`, `tasks`, `notifications` have unguarded `CREATE POLICY` / `ALTER PUBLICATION` that error with "already exists" on re-run. As literal migrations they apply cleanly only **once on a fresh DB**. Making them re-runnable needs `DROP POLICY IF EXISTS` guards and removing the destructive `DROP TABLE`.
2. **#9 has a hard, non-obvious dependency on #8** (return-type change). If reordered/removed, #9 fails with `cannot change return type of existing function`. Preserve `8 → 9`.
3. **#10 cannot precede #5** (its SELECT policy references `family_links`).
4. **`family_links` is created in two places** (`invites` via `CREATE TABLE`, `family-members-rls-linked` via `CREATE TABLE IF NOT EXISTS`). Order `5 → 6` keeps this consistent.
5. **#7 is functionally overwritten by #8** (which redefines `accept_invite` and re-introduces an `invited_email` check). Net runtime behavior is determined by #8 — reviewers should confirm #8's `accept_invite` is the intended final semantics.
6. **Redundant index:** `notifications_target_unread_idx` (#19) and `idx_notifications_target_unread` (#20) are the same partial index with different names — wasteful, worth deduplicating.
7. **All seed/ops files carry a `v_owner` placeholder UUID guard** that `RAISE EXCEPTION` until hand-edited. They must **never** be auto-applied by a migration runner — routing them to `scripts/` (outside `migrations/`) is essential to avoid accidental destructive `DELETE`/`TRUNCATE` during deploys.
8. **Verification still required:** without the Supabase CLI, `supabase db reset` could not be run. A human must apply this set against a scratch DB to confirm it applies cleanly **before deleting the original root files** (per task B6, originals are intentionally left in place this pass).

---

# Part C — Structural & dead-code analysis (REPORT ONLY — no code changed)

## C1 — Flat `components/` → `features/` migration plan

Scope: **45 components + 1 colocated test** in flat `src/components/`, alongside the existing (correct) `src/components/ui/`. Invariant to preserve: **`features/ → components/` is one-directional today; `components/` never imports from `features/`** (verified zero matches).

### Proposed target buckets

| Target | Components |
|---|---|
| `features/calendar/components/` | `ActivityBlock`, `AddEventSheet`, `EditEventSheet`, `EventDetailSheet`*, `BackgroundDetailSheet`, `BackgroundBlock`, `TimelineGrid` (+`TimelineGrid.taskOpen.test`), `TimelineContainer`, `TimeRail`, `CurrentTimeIndicator`, `GapLabel`, `AllDayRow`, `WeeklyList`, `SwipeableEventRow`, `WeekStrip`, `WeekDayCard`, `MonthView`, `CalendarDayNote`, `FamilyFilterBar`, `SearchBar`, `ScheduleLoadingSkeleton`, `TodayActionStrip`†, `DayHeader`† |
| `features/tasks/` | `TasksScreen` (top-level entry) |
| `features/tankestrom/` | `TankestromImportPreviewBoundary` |
| `features/onboarding/` | `OnboardingTour` |
| **`features/family/` (NEW)** | `FamilieScreen`, `FamilyEditor`†, `WorkProfileFields`, `SchoolProfileFields`‡ |
| **`features/settings/` (NEW)** | `SettingsScreen`, `HjelpScreen`, `MerScreen` |
| **`features/auth/` (NEW)** | `AuthScreen` |
| `features/app/components/` | `AppShell`, `MobileFrame`, `BottomNav`, `DebugOverlay`, `AddActionSheet`, `AppNotice` |
| `components/ui/` (shared) | `SectionDots`, `EmptyState`, `ParticipantAvatarStrip`, `TankestromScheduleDetails`‡ |

`*` consider props/shared seam (see circular risks). `†` likely-dead, confirm before moving (see C2). `‡` shared seam — keep neutral, do **not** bury inside a feature.

### Circular-import risks (flag before moving)

- **`TankestromScheduleDetails` (HIGH):** imported by *both* `calendar` (`EventDetailSheet`) and `tankestrom` (`TankestromImportDialog` + test). Moving it into either feature risks a `calendar ↔ tankestrom` cycle. **Keep it shared** (`components/ui/` or `components/shared/`).
- **`EventDetailSheet → TankestromScheduleDetails` (MEDIUM):** becomes a `calendar → tankestrom` edge once `EventDetailSheet` moves, *unless* `TankestromScheduleDetails` stays shared. Also fix its `./ui/Button` relative import.
- **`SchoolProfileFields` (MEDIUM):** imported by `family` and `tankestrom`. If placed under `features/family`, creates `tankestrom → family` (acceptable only if strictly one-directional). Safer: keep shared.
- **`AddActionSheet` (LOW):** shell FAB that triggers calendar + tankestrom actions — keep at shell level (`features/app`) so features don't import it back.
- **TimelineGrid cluster (NONE):** `ActivityBlock`/`BackgroundBlock`/`GapLabel`/`CurrentTimeIndicator`/`TimeRail`/`TimelineContainer`/`TimelineGrid` form a self-contained subtree — safe to move together.

### Empty / stub / missing feature folders

- `features/invites/` — **stub** (only `hooks/useInviteAcceptance.ts`; no UI to migrate — invite logic lives in `lib/inviteApi.ts`).
- `features/sync/` — **stub** (only `useRefreshTriggers.ts`, a loose hook breaking the `hooks/` convention — align it).
- `features/app/` — **thin** (natural home for the shell components above).
- `features/onboarding/` — **thin** (add a `components/` subfolder; adopt `OnboardingTour`).
- **Must be created:** `features/family/`, `features/settings/`, `features/auth/`.

### Execution notes

- No barrel `index.ts` files exist in any feature folder yet — a flat move with import-path fixups is the lowest-risk path; consider adding per-feature barrels *after*.
- Highest fan-in importers to update: `src/App.tsx`, `src/router.tsx` (most screens/shells); `CalendarHomeTab.tsx`, `CalendarOverlays.tsx` (the calendar cluster).
- `src/components/ui/` (`Button`, `Input`) is already correct — **leave in place**.

## C2 — Dead code & unused exports

> Tooling: `knip` and `ts-prune` are **unavailable offline** (not in `node_modules/.bin`; `npx --no-install` fails). Used a custom static import-graph analysis over 255 `src` files + per-candidate `grep` verification. Conservative rules: dynamic imports, side-effect imports, and **test-file usage all count as USED**. No `export *` barrels exist (low false-positive risk). **Nothing deleted — candidates for human review.**

### Unreferenced files (high confidence — likely safe to delete)

| File | Evidence |
|---|---|
| `src/lib/tankestromV2.ts` | No importer; dead alternate v2 parse/person-resolve path. |
| `src/lib/tankestromEval/hostcupRichDurationHarness.ts` | Test harness imported by no test (the matching test uses a different harness). |
| `src/components/DayHeader.tsx` | `DayHeader` never imported. |
| `src/components/FamilyEditor.tsx` | Never imported; superseded by `FamilieScreen` (only a comment references it). **Verify it isn't wired before deleting.** |
| `src/components/TodayActionStrip.tsx` | Never imported; its props feed from the also-unreferenced `useCalendarDerivedState`. |
| `src/features/tasks/components/DayTaskList.tsx` | Never imported (survived a prior dead-code commit). |
| `src/features/calendar/hooks/useCalendarDerivedState.ts` | Never imported; predates the KalenderScreen/CalendarHomeTab rewrite. |
| `src/components/ui/index.ts` | Barrel re-exporting `Button/Input/Textarea` has **zero importers** (everyone imports `./ui/Button`/`./ui/Input` directly). |

### Unused exports — genuinely dead (high confidence)

`getEventsForWeek` (mockSchedule — removed in A1), `DayHeader`, `FamilyEditor`, `TodayActionStrip`, `DayTaskList`, `useCalendarDerivedState`, `runHostcupRichDurationCase`, `parseTankestromV2Response`, `resolvePersonFromHints`, `getInviteByToken`, `fetchLatestPendingInvite`, `fetchPendingInviteForTarget`, `deleteEventsByPerson` (`eventsApi`), `fetchFamilyMembers` (`familyApi`), `useProfile` (`ProfileContext` — provider mounted but hook never consumed), `resetOnboarding`, `getUxMetricsSnapshot`, `isIOS` (`capacitor.ts`), `norwegianDayHasCalendarHighlight`, `hostcupTextVariantById`, `TASK_INTENT_VALUES`, `DEFAULT_SCHOOL_REGION_LABEL`, `formatTankestromEstimatedEndReviewHint`, plus 11 unused Tailwind class-name constants in `src/lib/ui.ts` (`btnGhost`, `btnNeutral`, `btnSecondaryPill`, `cardBase`, `cardList`, `screenInner`, `screenPad`, `screenWrapper`, `sectionGap`, `typBodySm`, `typSubheading`).

**Verify-before-removing clusters:**
- `inviteApi.ts`: `getInviteByToken` / `fetchLatestPendingInvite` / `fetchPendingInviteForTarget` (+ types `InviteInfo`, `PendingInviteRow`) form a self-contained dead cluster — confirm no Supabase RPC/edge-function or planned invite UI needs them (the 2026-06-11 audit suggests they may be intentionally retired).
- `useProfile`: `ProfileProvider` is still mounted in `main.tsx` but nothing reads the hook — either wire consumers or drop provider+hook together.
- `eventsApi.deleteEventsByPerson`, `familyApi.fetchFamilyMembers`: confirm no realtime trigger / planned feature needs them.

### Not dead (don't touch)

- **~175 "exported but used only in own file" symbols** (redundant `export` keyword, not dead logic) — concentrated in the tankestrom subsystem (`useTankestromImport.ts`, `types.ts`, eval harnesses), likely kept for test access. Removing the `export` keyword is a separate, lower-priority cleanup; the symbols are live.
- The three onboarding systems (`OnboardingFlow`, `OnboardingTour`, `GettingStartedChecklist`) are **all actively rendered** — a UX-duplication concern (per `AUDIT_REPORT`), not dead code.
- `deleteAllEventsForUser` (flagged critical in `AUDIT_REPORT.md`) has **already been removed** from `eventsApi.ts`.

## C3 — Unused dependencies

Cross-checked all 14 deps + 13 devDeps against actual import sites (accounting for WIP).

| Dependency | Verdict | Evidence |
|---|---|---|
| `@capacitor/filesystem` | **Unused (high)** | Zero import sites anywhere, including WIP native files. |
| `@capacitor/haptics` | **Unused (high)** | Zero imports of the plugin; haptics are implemented via the browser `navigator.vibrate` Web API in `src/lib/haptics.ts`, not this plugin. |

> Treat removal as a **judgment call**: both were likely added speculatively alongside the Capacitor 7 stack and may be intended for future use. Everything else is used — including build/CLI-only deps `@capacitor/cli` (imported by `capacitor.config.ts`) and `@capacitor/ios` (consumed by `npx cap`/Xcode, no TS import expected). The other WIP deps (`@capacitor/core`, `/camera`, `/status-bar`, `/splash-screen`, `/push-notifications`, `react-router-dom`) are all wired up and correctly **not** flagged.

## C4 — Repo / product rename (`Foreldre-Appen`/`ForeldrePortalen`/`parenting-calendar` → `Synka`)

The product is **Synka**, but three old-name families persist. **Nothing renamed** (touches deploy/native config). Key inconsistency for a human: `capacitor.config.ts` + `index.html` already say **Synka**, but the **PWA manifest still says `ForeldrePortalen`** and **runtime notifications still fire under `ForeldrePortalen`** — a user sees both names depending on context.

### Highest priority — RUNTIME / USER-FACING `ForeldrePortalen`

| File:line | Occurrence |
|---|---|
| `src/features/calendar/CalendarOverlays.tsx:173` | `fireNotification('ForeldrePortalen', \`Ny hendelse: …\`)` |
| `src/features/calendar/CalendarOverlays.tsx:215` | `fireNotification('ForeldrePortalen', \`Nytt gjøremål: …\`)` |
| `src/hooks/usePartnerNotify.ts:58` | `fireNotification('ForeldrePortalen', body)` |
| `src/hooks/usePartnerNotify.ts:88` | `title: 'ForeldrePortalen'` (persisted DB notification title) |
| `public/manifest.webmanifest:2-3` | `"name"`/`"short_name": "ForeldrePortalen"` (PWA install name) |
| `tests/e2e/mobile-smoke.spec.ts:6` | asserts `ForeldrePortalen` as login heading (likely already stale vs "synka") |

### Config / package

| File:line | Occurrence |
|---|---|
| `package.json:2` | `"name": "parenting-calendar"` |
| `README.md:1,3,30` | `Family Calendar — Parenting Calendar App`, `cd parenting-calendar` |
| `SETUP.md:1,24` | `Parenting Calendar — Supabase setup`, `parenting-calendar` folder |

### Docs / comments (lower priority)

`AUDIT_REPORT.md:1,4`; `docs/AUDIT-2026-06-11.md`; `docs/SYSTEM-OVERVIEW.md:1`; `docs/PRODUCT.md`, `MVP-CHECKLIST.md`, `UX-PRINCIPLES.md` (`ForeldrePortalen` titles); `docs/project-context/architecture.md`, `README.md`; `e2e/README.md:61`; `src/lib/tankestromSegmentDurationFacts.ts:3`, `src/data/mockSchedule.ts:2` (deleted in A1), `src/types/index.ts:2` (`parenting calendar` comments); `.cursor/rules/foreldreportalen-product.mdc` (filename + content); the stray nested `Foreldre-Appen/README.md`; the mangled `.gitignore` line.

**Do not touch:** the `synka*` Tailwind tokens (`synkaPrimary`, `synkaCream`, `bg-synka*`, etc.) appear hundreds of times across `src/` and `tailwind.config.js` — these are the **established Synka design-token namespace**, not stale names.

**Stale doc reference:** `docs/UX-REVISJONSRAPPORT.md` (lines 16, 21, 372-375, 425) points at `FamilySetupScreen.tsx:78`, but that file is **not tracked in git** (removed/renamed) — the doc references are stale.

## C5 — Other findings

| # | Finding | Severity | Evidence |
|---|---|---|---|
| 1 | **Internal/non-public files served publicly.** `public/vibe_coding_wip.docx` (12 KB Word doc) and `public/morten pack.zip` (160 KB) are tracked under `public/`, so Vite copies them to `dist/` and serves them live. (Also `AUDIT-2026-06-11` item 4, unresolved.) | **HIGH** | `git ls-files public/` lists both; zip is the largest tracked asset. |
| 2 | **Security headers defined but not served.** `public/_headers` has a full CSP/X-Frame/etc. set, but that's Netlify/Cloudflare format — Apache/Hostinger ignores it. The real `public/.htaccess` contains only `AddDefaultCharset UTF-8`, so none of the intended headers reach the browser. | **HIGH** | `_headers` vs `.htaccess` contents. |
| 3 | **Corrupted `.gitignore` entry** — the intended `Foreldre-Appen/` ignore line is stored as UTF-16LE bytes inside an ASCII file, so Git can't parse it (`git check-ignore -v Foreldre-Appen` → exit 1). Part of why the nested gitlink keeps returning. | MEDIUM | Hexdump shows interleaved null bytes. |
| 4 | **21 generated soak-test fixtures tracked under `tmp/`** despite `tmp/` being gitignored (committed before the rule; tracked files win). Bloat + noisy diffs. | MEDIUM | `git ls-files tmp/` → 21 JSON files. |
| 5 | **26 loose `supabase-*.sql` at root** with no migrations framework / ordering / applied-state tracking — schema state non-reproducible (addressed by Part B plan). | MEDIUM | `ls supabase-*.sql` → 26. |
| 6 | **God-files in the Tankestrom path:** `TankestromImportDialog.tsx` (~300 KB) and `useTankestromImport.ts` (~248 KB) dominate the size ranking — hard to review/test. Decomposition candidate (not a bug). | LOW | Largest tracked source files. |
| 7 | **Two overlapping audit reports** (`AUDIT_REPORT.md` 2026-06-07 at root, `docs/AUDIT-2026-06-11.md` 2026-06-11 untracked). Reconcile + triage open HIGH items. | LOW | Both present; newer is untracked. |
| 8 | **Temporary debug/legacy TODOs** to clean: `useTankestromImport.ts:2558` (school-import debug), `schoolContext.ts:431,457` (`TODO(legacy)` fallbacks), `vite-env.d.ts:3` (build fingerprint "remove after deploy verification"). | LOW | Self-described temporary markers. |

---

## Appendix — verification commands run

```
npx tsc --noEmit              # exit 0 (before changes and after A1)
npx vite build                # exit 0 (✓ built)
git ls-files -s Foreldre-Appen        # 160000 … gitlink
git submodule status                   # no mapping (orphaned)
supabase --version / npx supabase      # unavailable offline
```

*Investigation performed read-only by a 15-agent fan-out; all findings re-verified by grep. This report is the only file changed for Parts A2/A3/B/C.*
