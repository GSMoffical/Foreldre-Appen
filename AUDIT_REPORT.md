# Foreldre-Appen — Security & Scalability Audit Report

**Date:** 2026-06-07  
**App:** Foreldre-Appen (Norwegian family calendar and coordination app)  
**Stack:** React + TypeScript + Vite + Supabase (PostgreSQL, RLS, Edge Functions)  
**Auditor:** Automated security and scalability review  

---

## Plain-English Summary (Read This First)

Your app has a **solid security foundation**. You're using Supabase's Row Level Security (RLS) correctly for most things, which is the right approach. However, there is **one critical vulnerability that must be fixed before real users are invited**: a linked partner (a co-parent you've shared the calendar with) can delete every single event in the family calendar with a single API call, bypassing the app's interface entirely. The fix already exists in your codebase — it just needs to be wired up properly.

Beyond that, there are several medium-priority issues around how data is shared between linked partners, and scalability concerns around how much data is fetched at once and how real-time connections are managed.

**The three most important things to fix, in order:**

1. **Remove `deleteAllEventsForUser()` from production** — a linked partner can use it to wipe all family events (see Issue 1)
2. **Restrict the events RLS policy** so linked partners cannot delete events they don't own (see Issue 2)
3. **Add pagination to event fetching** — currently fetches unlimited events, which will crash or stall for families with years of history (see Issue 6)

---

## Overall Assessment

| Category | Rating | Notes |
|---|---|---|
| Authentication | Good | Supabase Auth handles this correctly |
| Authorization (RLS) | Needs work | One critical gap + design concerns |
| Data integrity | Acceptable | Minor gaps in referential integrity |
| Scalability | Needs work | Unbounded queries, potential subscription leaks |
| Secrets management | Good | No hardcoded secrets found in source |
| XSS / Injection | Good | React's default escaping + parameterized queries |

---

## TIER 1 — Fix Immediately

These are either security holes or issues that will cause data loss or outages.

---

### Issue 1 — CRITICAL: `deleteAllEventsForUser()` lets a linked partner wipe the entire family calendar

**File:** `src/lib/eventsApi.ts`, line 294  
**Confirmed by:** `supabase-invites.sql` line 145–155, `supabase-delete-all-events-owner-only.sql` line 6–9

**What is it?**

There are two functions for deleting all events:

```typescript
// DANGEROUS — eventsApi.ts:294
export async function deleteAllEventsForUser(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('user_id', userId)  // No server-side ownership check
  ...
}

// SAFE — eventsApi.ts:311
export async function deleteAllEventsOwnerOnly(): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_all_events_owner_only')
  ...
}
```

The app's Settings screen already calls the **safe** version (`deleteAllEventsOwnerOnly`). But the **dangerous** version is still exported and callable by anyone who can run JavaScript in the browser console.

The events RLS policy in `supabase-invites.sql` grants linked partners `FOR ALL` access on the owner's events — including DELETE. So the dangerous function would succeed if called by a partner.

The comment in `supabase-delete-all-events-owner-only.sql` confirms this explicitly:
> "a linked partner who calls the Supabase client directly (bypassing client-side guards) could delete ALL events for the shared family."

**What an attacker can do:** A co-parent opens the browser developer console and types:
```javascript
await deleteAllEventsForUser("owner-user-id")
```
Every event in the family calendar is gone. There is no undo at the database level.

**Severity:** CRITICAL

**Fix (small effort):**
1. Delete the `deleteAllEventsForUser` function from `eventsApi.ts` entirely
2. Confirm `supabase-delete-all-events-owner-only.sql` has been applied to your Supabase project (run it in SQL Editor if not)
3. Grep for any remaining calls to `deleteAllEventsForUser` and replace with `deleteAllEventsOwnerOnly`

---

### Issue 2 — HIGH: The events RLS policy is too broad — linked partners can DELETE individual events they don't own

**File:** `supabase-invites.sql`, lines 145–155  
**Affects:** All family calendar events

**What is it?**

The RLS policy that controls who can access events reads:

```sql
CREATE POLICY "Users can manage own events"
  ON public.events FOR ALL
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT linked_to_user_id FROM public.family_links WHERE user_id = auth.uid())
  )
  WITH CHECK ( ... same ... );
```

`FOR ALL` means this applies to SELECT, INSERT, UPDATE, and DELETE. The intention is calendar sharing — a partner should be able to see and add events. But the same policy also allows a partner to **delete or overwrite** any event they didn't create.

**What an attacker can do:** A co-parent who is angry or careless can delete any event in the family calendar via the API, even events created by the owner. No audit trail, no undo.

**Severity:** HIGH

**Fix (medium effort):** Split the policy into separate SELECT/INSERT/UPDATE/DELETE policies. Partners should have SELECT and INSERT, but DELETE and UPDATE should be limited to `user_id = auth.uid()` only (the event's own creator):

```sql
-- Partners can read and create, but not delete or update others' events
DROP POLICY IF EXISTS "Users can manage own events" ON public.events;

CREATE POLICY "events_select" ON public.events FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (
    SELECT linked_to_user_id FROM public.family_links WHERE user_id = auth.uid()
  ));

CREATE POLICY "events_insert" ON public.events FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "events_update" ON public.events FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "events_delete" ON public.events FOR DELETE
  USING (user_id = auth.uid());
```

> Note: This is a breaking change if your app currently lets partners edit shared events. Assess against intended UX first.

---

### Issue 3 — HIGH: Same overly-broad RLS applies to tasks

**File:** `supabase-tasks.sql`, lines 50–68

**What is it?**

The tasks table has the same pattern — `FOR ALL` grants linked partners full write and delete access to all tasks owned by the calendar owner. A partner can complete, modify, or delete any task in the family.

Unlike events, tasks have a `BEFORE UPDATE` trigger that prevents ownership reassignment, but DELETE is still unrestricted.

**Severity:** HIGH

**Fix:** Same approach as Issue 2 — split into separate policies. If collaborative task management is intended (partners should be able to tick off tasks), restrict DELETE to owner only at minimum:

```sql
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE
  USING (user_id = auth.uid());
```

---

## TIER 2 — Fix Before Launch

These issues won't cause immediate outages but are important for correctness and user trust.

---

### Issue 4 — MEDIUM: `person_id` in events is not validated against real family members

**Files:** `supabase-setup.sql` line 9, `src/lib/eventsApi.ts` (insert/update calls)

**What is it?**

The `events.person_id` column stores which family member an event belongs to, but it's just a `text` field with no foreign key constraint to `family_members`. An event can be created with a `person_id` that doesn't exist, or that belongs to a different family.

**Risk:** Data integrity issues. Events could reference phantom people. If any UI renders events grouped by person without validation, bogus person IDs could cause rendering errors or expose other families' member IDs.

**Fix (small):** Add a foreign key or use a check constraint. Since `family_members.id` is text and scoped to a `user_id`, a full FK is complex — at minimum, add a server-side validation in an RPC or trigger that rejects `person_id` values not found in the user's own `family_members`.

---

### Issue 5 — MEDIUM: Realtime subscriptions may not clean up properly, causing connection leaks

**File:** `src/features/sync/useRefreshTriggers.ts`

**What is it?**

Supabase Realtime subscriptions are managed via `useEffect`. If the cleanup function doesn't call `channel.unsubscribe()` before `supabase.removeChannel(channel)`, the WebSocket connection may linger even after the component unmounts.

At scale, each user maintains 2–3 realtime channels. If channels aren't cleaned up:
- Memory leaks on the client
- Supabase connection pool exhaustion (Supabase free tier allows 200 concurrent connections; Pro allows 500)
- Users who navigate rapidly between screens accumulate stacked subscriptions

**Fix (small):** Update all subscription cleanup to explicitly unsubscribe first:

```typescript
return () => {
  channel.unsubscribe()       // Add this line
  supabase.removeChannel(channel)
}
```

---

### Issue 6 — HIGH: Event fetching has no pagination or limit — will break at scale

**File:** `src/lib/eventsApi.ts` (fetchEventsForDateRange)

**What is it?**

The function that loads calendar events fetches everything in the requested date range with no `LIMIT` clause. For a family that has used the app for several years:

- 5 years × ~500 events/year = 2,500+ events
- All fetched in one JSON response
- JSON parse + React state update for 2,500 events can freeze the UI for seconds on mobile

**At scale with many users:** Each user making unbounded queries strains the Supabase database simultaneously.

**Fix (medium):**
1. Add `.limit(500)` as a safety cap immediately
2. Implement cursor-based pagination using `date` as the cursor — load 2–3 months at a time, fetch more as the user scrolls back in time
3. Cache loaded date ranges in state to avoid re-fetching already-seen data

---

### Issue 7 — MEDIUM: Family link is one-directional (Mom sees Dad's calendar, but not vice versa)

**File:** `supabase-invites.sql`, line 111–113 (the `family_links` insert)

**What is it?**

When an invite is accepted, only one row is inserted into `family_links`:

```sql
INSERT INTO public.family_links (user_id, linked_to_user_id)
VALUES (uid, inv.from_user_id)  -- Only: invitee → owner
```

This means:
- The person who was invited (Dad) can see the calendar owner's (Mom's) events
- The calendar owner (Mom) **cannot see Dad's events** unless he also creates events under her account

This may be intentional (one primary calendar per family), but it's asymmetric and can surprise users.

**Fix (small, if bidirectional sharing is desired):** Insert two rows on accept — one in each direction. This requires careful thought about whose events are "primary" and how the UI should blend them.

---

### Issue 8 — MEDIUM: No conflict detection for simultaneous edits

**Files:** All event/task update functions in `src/lib/eventsApi.ts`, `src/lib/tasksApi.ts`

**What is it?**

If two devices (e.g., Mom's phone and Dad's laptop) edit the same event at the same time, the second save silently overwrites the first. There's no version check or optimistic locking.

**Risk:** Silent data loss in collaborative families.

**Fix (medium):** The tasks table already has `updated_at`. Use it as an optimistic lock:
```typescript
// In update query, add:
.eq('updated_at', knownUpdatedAt)
// If no rows updated → conflict, refetch and show warning
```
Add `updated_at` to the events table with the same approach.

---

## TIER 3 — Fix After Launch

These are optimizations that improve performance and maintainability but won't cause failures in the near term.

---

### Issue 9 — Background events generated on every render (client CPU)

**File:** `src/lib/backgroundEvents.ts`

School schedule blocks and work-hour backgrounds are computed from profile data on every render. For large date ranges and many family members this is wasteful. Memoize with `useMemo` keyed on profile data hash, or compute once and cache.

**Effort:** Small

---

### Issue 10 — No caching layer between sessions

Every screen navigation fetches fresh data from Supabase. IndexedDB or a service worker cache would allow instant load from local storage while fresh data is fetched in the background. This dramatically improves perceived performance on slow mobile connections.

**Effort:** Large (architectural)

---

### Issue 11 — Tankestrøm import creates sequential API calls instead of batching

**File:** `src/features/tankestrom/useTankestromImport.ts`

Large imports (many events) create individual Supabase insert calls in sequence. A bulk insert RPC would be faster and reduce Supabase API round-trips.

**Effort:** Medium

---

## Prioritized Fix List

| Priority | Issue | File | Effort |
|---|---|---|---|
| **1** | Delete `deleteAllEventsForUser()` from production | `src/lib/eventsApi.ts:294` | Small |
| **2** | Split events RLS into separate read/write/delete policies | `supabase-invites.sql:145` | Medium |
| **3** | Split tasks RLS — restrict DELETE to owner | `supabase-tasks.sql:50` | Small |
| **4** | Add limit/pagination to event fetching | `src/lib/eventsApi.ts` | Medium |
| **5** | Fix realtime subscription cleanup (add `.unsubscribe()`) | `src/features/sync/useRefreshTriggers.ts` | Small |
| **6** | Validate `person_id` against real family members | `supabase-setup.sql:9` | Medium |
| **7** | Decide on bidirectional vs unidirectional family links | `supabase-invites.sql:111` | Small |
| **8** | Add optimistic locking for concurrent edits | `eventsApi.ts`, `tasksApi.ts` | Medium |
| **9** | Memoize background event generation | `src/lib/backgroundEvents.ts` | Small |
| **10** | Add IndexedDB caching layer | Architectural | Large |
| **11** | Batch Tankestrøm imports | `src/features/tankestrom/` | Medium |

---

## What Was Checked and Found Safe

- **SQL Injection:** Not possible. All Supabase queries use the PostgREST client with parameterized filters (`.eq()`, `.gte()`, etc.). No raw SQL string concatenation.
- **XSS (Cross-Site Scripting):** Not found. React escapes all rendered values by default. No `dangerouslySetInnerHTML` usage found in any component.
- **Hardcoded secrets:** None found in source code. `.env` file is `.gitignore`d. The Supabase anon key that ships in the browser bundle is intentional and expected for Supabase apps.
- **Authentication:** Supabase Auth handles this correctly. Password reset flow, session management, and token handling are all standard.
- **Invite token security:** The `accept_invite` RPC correctly validates token existence, expiry, and (when `invited_email` is set) email match before accepting. Token entropy is high (random UUID).
- **CSRF:** Not applicable. The app uses Bearer tokens (JWT), not cookies, so CSRF attacks are not possible.
- **Open redirects:** The password reset `redirectTo` uses `window.location.origin`, which browsers enforce — attackers cannot override it via URL parameters.
