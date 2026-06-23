# Supabase SQL Consolidation — Mapping (Phase 4)

**Branch:** `feature/capacitor-native`
**Source of truth:** `CLEANUP_REPORT.md` Part B (dependency-ordering analysis, reused verbatim).
**This pass is file ORGANIZATION only** — no live/remote DB was touched, no SQL content was rewritten.

> The 26 original `supabase-*.sql` files are **intentionally left in place at the repo root** this pass.
> Each file below was **copied** (byte-identical — verified by MD5, 0 mismatches) to its new location.
> Confirm this mapping, then remove the originals in a follow-up.

## Timestamps

Migration filenames use placeholder timestamps `20240101NNNNNN_` with 1-minute spacing.
**The relative order is the contract, not the literal values.** A real monotonic-UTC renumber is
fine as long as it preserves this order.

---

## 1. Schema migrations → `supabase/migrations/` (apply in this order)

| # | Original root file | New migration file | Role |
|---|---|---|---|
| 1 | `supabase-setup.sql` | `20240101000100_init_events_and_family_members.sql` | Base tables `events`, `family_members` + RLS. **`DROP TABLE … CASCADE` at top — destructive on re-run; must be first.** |
| 2 | `supabase-fix.sql` | `20240101000200_events_add_notes_location_recurrence_columns.sql` | Idempotent additive columns on `events`. |
| 3 | `supabase-family-members-profile.sql` | `20240101000300_family_members_add_member_kind_and_profile.sql` | Adds `member_kind` + `profile`. |
| 4 | `supabase-family-members-guest-kind.sql` | `20240101000400_family_members_member_kind_allow_guest.sql` | Drops/recreates `member_kind` CHECK to add `guest`. |
| 5 | `supabase-invites.sql` | `20240101000500_family_links_invites_tables_and_rpcs.sql` | `family_links`, `family_invites`, base `get_invite_by_token`/`accept_invite`. |
| 6 | `supabase-family-members-rls-linked.sql` | `20240101000600_family_members_rls_owner_or_linked.sql` | Owner-or-linked `family_members` RLS; `CREATE TABLE IF NOT EXISTS family_links` (idempotent dup of #5). |
| 7 | `supabase-invite-fix.sql` | `20240101000700_accept_invite_remove_email_guard.sql` | `CREATE OR REPLACE accept_invite` (removes email guard). |
| 8 | `supabase-invite-target-member.sql` | `20240101000800_invites_target_member_linking.sql` | Adds `target_member_id`/`linked_auth_user_id`; **DROP+recreate** `get_invite_by_token` (new return shape) + `accept_invite`. |
| 9 | `supabase-security-patch-invite-token.sql` | `20240101000900_get_invite_by_token_drop_from_email.sql` | GDPR hardening. **Hard dep on #8** (return-type change). Last of invite chain. |
| 10 | `supabase-profiles.sql` | `20240101001000_profiles_table_and_policies.sql` | `profiles`; SELECT policy queries `family_links` → must follow #5. |
| 11 | `supabase-profiles-fix.sql` | `20240101001100_profiles_add_family_name_updated_at.sql` | Idempotent additive columns on `profiles`. |
| 12 | `supabase-tasks.sql` | `20240101001200_tasks_table_rls_and_calendar_rpc.sql` | `tasks` + indexes + trigger + RLS + `get_tasks_for_calendar`; needs `family_links`. |
| 13 | `supabase-tasks-task-intent.sql` | `20240101001300_tasks_add_task_intent.sql` | Idempotent `task_intent` column + CHECK. |
| 14 | `supabase-events-update-rpc.sql` | `20240101001400_events_calendar_read_and_update_rpcs.sql` | `get_events_for_calendar` + base `update_event(s)_keep_owner`. |
| 15 | `supabase-events-person-id-nullable.sql` | `20240101001500_events_person_id_nullable_and_rpc_null_handling.sql` | Drops NOT NULL on `person_id`; **overrides #14's two RPCs**. |
| 16 | `supabase-events-insert-recurring.sql` | `20240101001600_events_insert_recurring_rpc.sql` | `insert_recurring_events_keep_owner`. |
| 17 | `supabase-events-owner-lock.sql` | `20240101001700_events_keep_owner_update_trigger.sql` | Optional hardening trigger (user_id immutable on UPDATE). |
| 18 | `supabase-family-members-delete-rpc.sql` | `20240101001800_delete_family_member_and_events_rpc.sql` | `delete_family_member_and_events_keep_owner` RPC. |
| 19 | `supabase-notifications.sql` | `20240101001900_notifications_table_rls_realtime.sql` | `notifications` table + RLS + Realtime; INSERT policy refs `family_links`. |
| 20 | `supabase-performance-indexes.sql` | `20240101002000_performance_indexes.sql` | Idempotent `CREATE INDEX IF NOT EXISTS` across all tables; last among schema. |

## 2. Operational scripts → `supabase/scripts/` (run on demand — **never** auto-applied)

| # | Original root file | New file | Role |
|---|---|---|---|
| 21 | `supabase-delete-account.sql` | `delete_user_account.sql` | Account self-deletion RPC (deletes from `auth.users`). |
| 22 | `supabase-delete-all-events-owner-only.sql` | `delete_all_events_owner_only.sql` | Owner-only bulk-delete RPC. |
| 23 | `supabase-reset-all.sql` | `reset_all.sql` | Destructive `TRUNCATE … CASCADE` test reset. |

## 3. Seed data → `supabase/seed/` (hand-edit `v_owner` UUID first — **never** auto-applied)

| # | Original root file | New file | Role |
|---|---|---|---|
| 24 | `supabase-seed-demo-family.sql` | `seed_demo_family.sql` | 2 parents + 2 children + ~5 events for current week. |
| 25 | `supabase-seed-packed-family.sql` | `seed_packed_family.sql` | 5 members, ~30 events/4 weeks, ~24 tasks. Depends on `tasks` (#12). |
| 26 | `supabase-seed-packed-month.sql` | `seed_packed_month.sql` | Programmatic full-month event seed. |

> Seeds are deliberately **not** wired into `supabase/seed.sql` or `config.toml`'s `[db.seed]`
> (`sql_paths = ["./seed.sql"]`, a file that does not exist), so `supabase db reset` will **not**
> auto-run them. Each carries a `v_owner` placeholder UUID that `RAISE EXCEPTION`s until hand-edited.

---

## Ordering rationale (key points)

- **Tables → constraints/RLS → RPCs/indexes.** Base tables (`events`, `family_members`) first;
  additive column patches folded in immediately so later objects can rely on them.
- **`DROP TABLE` placement:** the only destructive `DROP TABLE … CASCADE` is in migration **#1**
  (`init_events_and_family_members`). It is first by design — it resets the two base tables on a
  fresh DB; no later state exists to wipe. (It is *not* idempotent on re-run — see caveats.)
- **Invite RPC chain is strict and load-bearing:** `invites(5) → invite-fix(7) →
  invite-target-member(8) → security-patch(9)`. #9's `get_invite_by_token` uses `CREATE OR REPLACE`,
  which cannot change a function's return type — it only succeeds because #8 already `DROP`+recreated
  that function with the new `target_member_id` signature. Verified: #8 has
  `DROP FUNCTION … get_invite_by_token` then recreate; #9 is a later `CREATE OR REPLACE`.
- **Near-cyclic resolved:** `profiles`(10) SELECT policy references `family_links`, created by
  `invites`(5), which itself needs `events`+`family_members`(1). Order 1 → 3–4 → 5 → 6 → 7–9 → 10
  satisfies all three.
- **Events RPC overrides:** `person-id-nullable`(15) follows `update-rpc`(14) because it
  `CREATE OR REPLACE`s the same two functions.
- **`notifications`(19) before `performance-indexes`(20)** because the index file indexes
  `notifications`; performance-indexes touches every table and is intentionally last.

## Static verification (Docker NOT available)

`docker` is not installed in this environment, so `supabase db reset` could not be run. Instead, a
static forward-reference check was performed against the copied migrations:

- **Table-creation map:** `events`/`family_members`→#1, `family_links`/`family_invites`→#5,
  `profiles`→#10, `tasks`→#12, `notifications`→#19. Every reference to each table appears only in
  the same or a **later** migration — **no forward references**.
- All FK `REFERENCES` target the built-in `auth.users(id)` — no cross-table FK ordering hazard.
- Invite-chain function DROP/CREATE order confirmed (#8 before #9).

**Result: ordering is internally consistent. PASS (static).** A live apply-verification still
requires Docker + a manual `npx supabase db reset`.

## Caveats (from CLEANUP_REPORT.md Part B §B.4, unchanged)

- Several base migrations are **not idempotent** on re-run: #1's `DROP TABLE` is destructive; #5/#10/#12/#19
  have unguarded `CREATE POLICY` / `ALTER PUBLICATION` that error with "already exists". They apply
  cleanly **once on a fresh DB** (which is exactly what `db reset` does). Content was preserved
  verbatim — **no idempotency guards were added** this pass.
- Redundant index: `notifications_target_unread_idx` (#19) and `idx_notifications_target_unread` (#20)
  are the same partial index under two names — candidate to dedupe later.

---

## Next step for the user

1. **Install/start Docker Desktop**, then from the repo root run:
   ```
   npx supabase db reset
   ```
   This applies migrations #1–#20 in order to a throwaway local DB. Expect it to apply cleanly on a
   fresh DB. (Seeds in `supabase/seed/` and ops in `supabase/scripts/` are **not** auto-run.)
2. If it applies cleanly, **then** remove the 26 original `supabase-*.sql` files from the repo root
   (they are duplicated into `supabase/` this pass on purpose, for review).
3. Before running anything in `supabase/seed/` or `supabase/scripts/`, hand-edit the `v_owner`
   placeholder UUID — they will `RAISE EXCEPTION` otherwise.
