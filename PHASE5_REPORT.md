# Phase 5 — Safe Codebase Cleanup Report

**Branch:** `feature/capacitor-native`
**Date:** 2026-06-23
**Build gate:** GREEN throughout. `npx tsc --noEmit` exit 0 and `npx vite build` exit 0 — verified before any change, after every commit, and at the end.

Follows the **"separate DO from REPORT"** rule. Mechanical, provably-safe changes were committed (each independently); everything needing human judgment or that could change behavior / break an external connection is documented here. **No behavioral changes were made.** Not pushed — local for review.

> **Note on repo drift since `CLEANUP_REPORT.md` (2026-06-22):** the repo moved on. The SQL consolidation (prior Part B) is partly done (`31773e9`), Phase 3 Familie build-out landed (`5fd2dba`), and two security commits (`fcf7ce5`, `d455cab`) resolved several prior Part D items. Every candidate below was **re-verified against the current tree**, not copied from the prior report. Where a prior finding is now fixed, that is noted.

---

## Commits made this pass (DO) — 6, each independent

| # | Commit | What | Verified |
|---|---|---|---|
| 1 | `chore(cleanup): remove orphaned /mer/tankestrom route + TankestrømPage` | Route + `TankestromRoute` + `ctx.tankestrom` + `TankestrømPage.tsx` + vite manualChunks entry | tsc + vite build |
| 2 | `chore(cleanup): remove dead Tankestrøm modules tankestromV2 + hostcupRichDurationHarness` | 2 unreferenced lib modules | tsc |
| 3 | `chore(cleanup): remove unused calendar hook useCalendarDerivedState` | 1 unreferenced hook | tsc |
| 4 | `chore(cleanup): remove unused components/ui barrel index.ts` | 1 unreferenced barrel | tsc |
| 5 | `chore(cleanup): remove orphaned DayTaskList component` | 1 unreferenced component | tsc |
| — | (this report) | `PHASE5_REPORT.md` | — |

`vite build` was re-run after the deletion batch (commits 2–5) — green (`✓ built in 10.3s`). Deleting an unimported file cannot affect the bundle, but it was verified regardless.

---

# Part A — Dead code

## A.1 — `/mer/tankestrom` route cluster — REMOVED ✅ (commit 1)

The task singled this out: *"the now-unlinked `/mer/tankestrom` route + `TankestromRoute` + `ctx.tankestrom` wiring (left in during Phase 3) — verify nothing reaches it and remove if truly orphaned."*

**Verified truly orphaned (high confidence):**
- **No in-app navigation reaches `/mer/tankestrom`.** Repo-wide grep for any `navigate('/mer/tankestrom')` / `<Link to>` / redirect → **zero matches**. `MerScreen.tsx` links only to `/mer/innstillinger` and `/mer/hjelp`.
- **The live Tankestrøm import flow does not use this route.** It runs through `TankestromImportDialog` (an overlay opened by `openTankestromImport('settings')` from `AddActionSheet` / `SettingsScreen`). The route's `TankestrømPage` was a parallel, superseded full-page version.
- **e2e specs use the dialog, not the route** — `e2e/tankestrom-hostcup.spec.ts` / `tankestrom-vaacup.spec.ts` drive `getByTestId('tankestrom-import-dialog')`, never the route.
- **Clean blast radius — no orphaned locals.** Every callback the removed `tankestrom: {…}` outlet block referenced (`people`, `controller.createEvent`, `taskController.createTask`, `controller.editEvent`, `getAnchoredForegroundEventsForMatching`, `prefetchEventsForDateRange`, `deleteEvent`, `updatePerson`, `openTankestromToast`) is **also** passed to `TankestromImportDialog` (App.tsx:810–818), so removing the block left no unused variables. `tsc` confirms.
- **Only references to `TankestrømPage` were:** router.tsx (the route), App.tsx (`TankestrømPageProps` type + the outlet block), `vite.config.ts` manualChunks, and docs. All handled.

**Removed:** the lazy `TankestrømPage` import + `TankestromRoute` wrapper + `{ path: 'tankestrom' }` entry (router.tsx); the `TankestrømPageProps` import + `tankestrom` field on `AppOutletContext` + the `tankestrom: {…}` construction (App.tsx); `src/features/tankestrom/TankestrømPage.tsx`; the `TankestrømPage.tsx` line from the `feature-tankestrom` manualChunks array (vite.config.ts — required, since the chunked file no longer exists; the other two chunk members, `useTankestromImport.ts` + `TankestromImportDialog.tsx`, are live and stay).

> This is the only change that alters a URL surface: `#/mer/tankestrom` no longer resolves. It was an unlinked, superseded duplicate of the dialog flow — exactly the leftover the task asked to remove. No runtime behavior of any reachable screen changed.

## A.2 — Unreferenced files — 5 REMOVED ✅, 3 DEFERRED ⚠️

Re-verified each of the 8 candidates from `CLEANUP_REPORT.md` §C2. `knip` / `ts-prune` remain **unavailable** (`node_modules/.bin` has neither; offline `npx` fails) — used import-graph grep across `src/`, `e2e/`, `tests/`, `scripts/`, config, and docs.

### Removed (high confidence — zero importers, no doc/comment implying live use)

| File | Evidence (current tree) | Commit |
|---|---|---|
| `src/lib/tankestromV2.ts` | No importer. `resolvePersonFromHints` is called only by `parseTankestromV2Response` **inside the same file**. | 2 |
| `src/lib/tankestromEval/hostcupRichDurationHarness.ts` | `runHostcupRichDurationCase` exported but imported by **no test**. | 2 |
| `src/features/calendar/hooks/useCalendarDerivedState.ts` | Zero importers; predates the KalenderScreen/CalendarHomeTab rewrite. Its `hideTodayActionStrip` state is file-local. | 3 |
| `src/components/ui/index.ts` | Barrel re-exporting `Button/Input/Textarea` with **zero importers** — every consumer imports `./ui/Button` / `./ui/Input` directly. | 4 |
| `src/features/tasks/components/DayTaskList.tsx` | Imported nowhere. Only external mention is a **legacy color-token occurrence count** in `docs/PRE-LAUNCH-RAPPORT.md:89` (`brandTeal` usage), not a usage. | 5 |

### Deferred to REPORT — UI components docs describe as *live* (reasonable doubt → left per task rule)

The import graph for these three is empty (no importer anywhere in `src/`), so deleting them changes **no runtime behavior** (the app already never renders them). They were *not* removed because multiple architecture/design docs treat them as live components — a signal they may be **recently-orphaned-pending-rewire** rather than abandoned, and the prior report itself flagged one with *"verify before deleting."* Per *"any doubt → leave it, add to the report; confidence must be high,"* these are for a human to confirm:

| File | Import-graph status | Doc signal creating doubt |
|---|---|---|
| `src/components/FamilyEditor.tsx` | Imported nowhere; only a **comment** in `FamilieScreen.tsx:39` ("mirrors COLOR_PRESETS in FamilyEditor.tsx") references it. | `docs/SYSTEM-OVERVIEW.md:112` says *"Settings — SettingsScreen + embedded `FamilyEditor`"* and `:174` says the per-row invite-link recovery UI ("Vis invitasjonslenke") lives in `FamilyEditor`. The code shows Settings does **not** import it (superseded by `FamilieScreen`), so the doc is stale — **but** if any invite-recovery affordance only exists in `FamilyEditor`, deleting it drops a feature. **Confirm the invite-link UI fully moved to `FamilieScreen` before deleting.** |
| `src/components/TodayActionStrip.tsx` | Imported nowhere; its `onMarkDone/onConfirmNext/onDelayNext/onMoveNext` props have no caller. | `docs/DESIGN-RAPPORT.md` reviews it as a live, rendered component in **8 places** (lines 22, 87, 99, 103, 182, 281, 375, 384) with specific behaviors/line numbers — strongly implies it was live very recently (pre nav-redesign). |
| `src/components/DayHeader.tsx` | `DayHeader` component imported nowhere. (The `DayHeaderMatch`/`collectDayHeaderMatches` hits in `tankestromScheduleDetails.ts` are unrelated local types.) | `README.md:80` lists `DayHeader` in the live `src/components` inventory. |

**Recommendation:** all three are very likely deletable (the nav redesign unwired them), but a human should confirm intentional removal — especially `FamilyEditor` (invite-recovery UI). They are pure presentational/editor components, so confirmation is a 2-minute check.

## A.3 — Getting-started checklist dead link — REPORT (behavior change) ⚠️

The task asked to check *"the getting-started checklist item still pointing at `/mer`."*

**Finding (confirmed dead link):**
- `GettingStartedChecklist.tsx` row "Inviter partneren din" (line 129, `showInvite`) calls `onNavigateToMer` (line 166).
- That callback is wired in `App.tsx:575` to `navigate('/mer')`.
- **`/mer` (`MerScreen`) has no invite affordance** — it shows only Innstillinger + Hjelp.
- The **actual invite flow lives at `/familie`** (`FamilieScreen.openInvitePartner`, line 135; `getOrCreateInviteForTarget` + `buildInviteUrl` + "Inviter partner" button). So tapping "Inviter partneren din" lands the user on a screen with no way to invite.

**Why not changed:** repointing navigation is a **user-facing behavior change**, which the hard constraints exclude. The task permits the specific `/mer`→`/familie` repoint *"if obvious,"* and it is obvious — but the callback is named `onNavigateToMer` and threaded App → CalendarHomeTab → GettingStartedChecklist, so a clean fix also renames the prop (3 files). Deferred for the human.

**Exact recommended fix (one line, minimal):** change `App.tsx:575` from `onNavigateToMer: () => navigate('/mer')` to `() => navigate('/familie')`. Optionally rename `onNavigateToMer` → `onNavigateToInvite` across `App.tsx` / `CalendarHomeTab.tsx` / `GettingStartedChecklist.tsx` so the name matches the destination. Verify: complete onboarding to the invite step, tap the row, confirm it opens the Familie invite flow.

---

# Part B — Unused dependencies — REPORT ONLY (zero removals)

Re-checked all 9 `@capacitor/*` + 5 other deps + 13 devDeps against static **and dynamic** import sites. **Nothing removed.** Rationale per dependency class below.

### Capacitor / native plugins — NEVER removed (conservative rule)

Capacitor **auto-registers installed plugins natively from `package.json`** — `npx cap sync` reads the dependency list to install CocoaPods/Gradle modules, so a plugin with **no JS import can still be wired into the native shell**. The native side is **not visible in this repo**: there are **no `ios/` or `android/` folders** (and they are *not* gitignored — simply not added yet), so `npx cap add` has not been run here or the platforms live elsewhere. Per the task (*"a `@capacitor/*` package unused in JS but possibly wired natively → DO NOT remove, report"*), **all Capacitor deps are report-only.**

| Dependency | JS usage | Disposition |
|---|---|---|
| `@capacitor/core` | `src/lib/capacitor.ts:1` (static) | **Keep** — used. |
| `@capacitor/camera` | `src/lib/nativeCamera.ts:11` (**dynamic** `import('@capacitor/camera')`) | **Keep** — used. (Missed by static-import grep — illustrates why static grep alone is unsafe for Capacitor.) |
| `@capacitor/cli` | `capacitor.config.ts:1` (type import) | **Keep** — build/CLI. |
| `@capacitor/ios` | none in JS (consumed by `npx cap` / Xcode) | **Keep** — native toolchain. |
| `@capacitor/push-notifications` | none in JS; **registered natively** in `capacitor.config.ts:13` (`PushNotifications`) | **Keep** — native-registered. |
| `@capacitor/splash-screen` | none in JS; **registered natively** in `capacitor.config.ts:16` (`SplashScreen`) | **Keep** — native-registered. |
| `@capacitor/status-bar` | none found in JS | **Report** — likely used by the native shell; do not remove without checking the native project. |
| `@capacitor/filesystem` | **none** (no static or dynamic import; not in `capacitor.config.ts` plugins) | **Report — candidate unused, but DO NOT remove unattended.** Confirm against the native shell first (it auto-registers from package.json). |
| `@capacitor/haptics` | **none** (plugin never imported; the `hapticsEnabled` setting in `UserPreferencesContext`/`SettingsScreen` is unrelated — haptics fire via the browser `navigator.vibrate` Web API in `src/lib/haptics.ts`) | **Report — candidate unused, but DO NOT remove unattended.** Same reasoning. |

> The two specifically flagged (`filesystem`, `haptics`) are genuinely unused in JS today. They were likely added speculatively with the Capacitor 7 stack. Removal is plausible **only** after confirming neither is referenced by the native iOS/Android project (Podfile/Gradle, plugin registration, native code) — which is not in this repo. A safe removal also requires re-running `npx cap sync` and a native build, neither of which can run here.

### Non-Capacitor deps — all used (spot-verified)

`@sentry/react` (`src/lib/sentry.ts:1`), `@supabase/supabase-js`, `@tabler/icons-react`, `date-holidays` (dynamic import in `norwegianSchoolCalendar.ts`), `framer-motion`, `react`, `react-dom`, `react-router-dom` — all imported. devDeps (`@playwright/test`, testing-library, `@types/*`, `@vitejs/plugin-react`, `autoprefixer`/`postcss`/`tailwindcss`, `happy-dom`, `typescript`, `vite`, `vitest`) are all toolchain/test deps in active use. **No removals.**

---

# Part C — Project rename `Foreldre-Appen` / `ForeldrePortalen` / `parenting-calendar` → `Synka` — REPORT ONLY (not executed)

The product is **Synka**. Three legacy name families remain. **Nothing renamed** — this touches deploy identity, the PWA install name, runtime notifications, the Supabase project ref, and the GitHub remote. Below is a complete, risk-classified, ordered plan to execute later **with a human watching**.

**Already correct (no action):** `index.html` `<title>` + `apple-mobile-web-app-title` = `Synka`; `capacitor.config.ts` `appName = 'Synka'`. The `synka*` Tailwind tokens (`synkaPrimary`, `synkaCream`, `bg-synka*`, …) are the **established design-token namespace — do NOT touch.**

### Risk legend
**SAFE** = cosmetic text. **MEDIUM** = internal identifier, no external binding. **HIGH** = external identity/connection — changing it can break store registration, deploys, the Supabase project, or the git remote.

### C.1 — Runtime / user-facing (highest priority; each is a behavior change)

| File:line | Occurrence | Risk |
|---|---|---|
| `public/manifest.webmanifest:2-3` | `"name"` / `"short_name": "ForeldrePortalen"` — the **PWA install name** users see | MEDIUM (cosmetic but user-visible; safe string change, no external binding) |
| `src/hooks/usePartnerNotify.ts:58` | `fireNotification('ForeldrePortalen', body)` — push/local notification title | MEDIUM |
| `src/hooks/usePartnerNotify.ts:88` | `title: 'ForeldrePortalen'` — **persisted** notification title written to DB | MEDIUM (old rows keep the old title; cosmetic) |
| `src/features/calendar/CalendarOverlays.tsx:173` | `fireNotification('ForeldrePortalen', \`Ny hendelse: …\`)` | MEDIUM |
| `src/features/calendar/CalendarOverlays.tsx:215` | `fireNotification('ForeldrePortalen', \`Nytt gjøremål: …\`)` | MEDIUM |
| `tests/e2e/mobile-smoke.spec.ts` | asserts `ForeldrePortalen` (likely already stale vs the live "Synka" login UI) | SAFE (test) |

> These five `ForeldrePortalen` strings are the inconsistency a user actually notices: the app is branded Synka everywhere except notifications and the PWA install name. Fixing them is low-risk but **behavioral**, hence report-only.

### C.2 — Config / package (internal identifiers)

| File:line | Occurrence | Risk |
|---|---|---|
| `package.json:2` | `"name": "parenting-calendar"` | MEDIUM (internal; not published to npm — `private: true`) |
| `package-lock.json` | mirrors the `package.json` name | MEDIUM (regenerated by `npm install` after the `package.json` change — don't hand-edit) |
| `supabase/config.toml:5` | `project_id = "Foreldre-Appen"` | **HIGH** — this is the Supabase **project ref** used by `supabase link` / `db push`. Changing it can desync the CLI from the linked cloud project. **Do not change casually**; only alongside a deliberate Supabase project re-link. |

### C.3 — External identity (do NOT change casually)

| Target | Current | Risk |
|---|---|---|
| **Capacitor `appId`** (`capacitor.config.ts:4`) | `no.synka.app` — already Synka-aligned | **HIGH** — the app's store identity. Already correct; **leave it.** Changing `appId` after any App Store / Play registration breaks the app's identity and updates. Listed here only to flag "do not touch." |
| **Git remote** (`origin`) | `https://github.com/GSMoffical/Foreldre-Appen.git` | **HIGH** — renaming the GitHub repo changes the remote URL. Requires a deliberate GitHub repo rename + `git remote set-url` + updating any CI/deploy hooks/webhooks that reference the old URL. Coordinate; do not do unattended. |
| **Hostinger deploy** (`scripts/deploy-hostinger.ps1`, `package.json` `deploy:hostinger*` scripts) | deploy target paths | **HIGH if** any path/host embeds the old name — verify before touching; a wrong deploy path publishes to the wrong directory. (No `Foreldre-Appen`/`parenting-calendar` literal was found in the deploy scripts in this pass; verify the host config separately.) |

### C.4 — Docs / comments / misc (SAFE — cosmetic)

`README.md`, `SETUP.md`, `AUDIT_REPORT.md`, `docs/AUDIT-2026-06-11.md`, `docs/SYSTEM-OVERVIEW.md`, `docs/UX-PRINCIPLES.md`, `docs/PRODUCT.md`, `docs/MVP-CHECKLIST.md`, `docs/UX-REVISJONSRAPPORT.md`, `docs/project-context/architecture.md` + `README.md`, `e2e/README.md`, `SECURITY-HEADERS-REPORT.md`, `src/lib/tankestromSegmentDurationFacts.ts:3` (comment), `.cursor/rules/foreldreportalen-product.mdc` (filename + content), the nested `Foreldre-Appen/README.md` (see D.1). All SAFE text edits.

### C.5 — Recommended order + verification

1. **SAFE batch first** (C.4 docs + the two e2e asserts) — no runtime/identity impact. Verify: build still green, e2e still passes.
2. **`package.json` name** (C.2) → run `npm install` to regenerate `package-lock.json`. Verify: `tsc` + `vite build` green.
3. **Runtime strings** (C.1): manifest + the 4 notification titles. Verify: install PWA → check name; fire a notification → check title. (Old persisted notification rows keep the old title — acceptable.)
4. **HIGH-risk items, individually and deliberately, watching:** Supabase `project_id` (only with a project re-link), GitHub repo rename + `git remote set-url` (+ CI/webhooks), Hostinger deploy paths. Verify each against its external service before the next.
5. **Leave `capacitor.config.ts appId` (`no.synka.app`) and the `synka*` Tailwind tokens untouched.**

---

# Part D — Other findings (REPORT ONLY)

### Resolved since `CLEANUP_REPORT.md` (no action needed) ✅
- **Internal files removed from `public/`** — `public/morten pack.zip` and `public/vibe_coding_wip.docx` are no longer tracked (commit `d455cab`). `git ls-files public/` now lists only `.htaccess`, `favicon.svg`, `manifest.webmanifest`, `synka-mark.svg`.
- **Security headers now actually served** — `public/_headers` (Netlify format, ignored by Apache) was removed; `public/.htaccess` now carries the full CSP + `X-Frame-Options` + `X-Content-Type-Options` + `Referrer-Policy` + `Permissions-Policy` + HSTS set, copied verbatim into `dist/` by Vite (commit `fcf7ce5`). See `SECURITY-HEADERS-REPORT.md`.
- **`.gitignore` UTF-16 corruption fixed** — the `Foreldre-Appen/` ignore line is now clean UTF-8 ASCII.

### Still open

| # | Finding | Severity | Evidence |
|---|---|---|---|
| D.1 | **Nested `Foreldre-Appen/` gitlink still tracked.** `git ls-files -s` → `160000 72a69066… Foreldre-Appen` (orphaned embedded repo, no `.gitmodules`). The `.gitignore` fix does **not** remove it: Git ignores rules for already-tracked paths, so `git check-ignore -v Foreldre-Appen` still exits 1. Needs the explicit removal from `CLEANUP_REPORT.md` §A2 (`git rm --cached Foreldre-Appen` → `rm -rf Foreldre-Appen` → commit). Not done here: deleting a tracked gitlink + its inner `.git/` is destructive and outside mechanical cleanup. | MEDIUM | `git ls-files -s` |
| D.2 | **SQL duplicated, not migrated.** `31773e9` created `supabase/` (20 migrations + scripts + seed + `config.toml` + `MIGRATION_MAPPING.md`), but the **26 original `supabase-*.sql` files remain at repo root** (`git ls-files supabase-*.sql` → 26). Schema now lives in two places. Reconciling = delete the 26 root originals once `supabase db reset` confirms the migrations apply cleanly — a judgment call (docs/`OPERATIONS.md` and several `src/lib/*` reference the old filenames in prose), so report-only. | MEDIUM | 26 root vs `supabase/migrations/` (20) |
| D.3 | **21 generated soak-test fixtures tracked under `tmp/`** despite `tmp/` being gitignored (committed before the rule; tracked files win). Bloat. Fix: `git rm -r --cached tmp/`. Report-only (a delete). | MEDIUM | `git ls-files tmp/` → 21 |
| D.4 | **God-files in the Tankestrøm path** — `useTankestromImport.ts` (6,221 lines) and `TankestromImportDialog.tsx` (5,740 lines) dominate the source-size ranking; hard to review/test. Decomposition candidate (not a bug). | LOW | `git ls-files \| wc -l` ranking |
| D.5 | **Two overlapping audit reports** — `AUDIT_REPORT.md` (root, older) and `docs/AUDIT-2026-06-11.md`. Reconcile + triage open HIGH items. | LOW | both present |
| D.6 | **Self-described temporary markers to clean post-deploy** — build fingerprint (`src/vite-env.d.ts:3` + `vite.config.ts:10` "remove after deploy verification" + `BuildFingerprintMarker`/`AppShell`); plus the prior report's `schoolContext.ts` `TODO(legacy)` fallbacks and the `useTankestromImport.ts` school-import debug. All self-flagged temporary. | LOW | inline TODO comments |
| D.7 | **Three onboarding systems coexist** — `OnboardingFlow`, `OnboardingTour`, `GettingStartedChecklist` are all actively rendered (a UX-duplication concern from `AUDIT_REPORT`, not dead code). Combined with A.3's dead invite link, the onboarding surface is worth a deliberate UX review. | LOW | all three imported/rendered |

### `components/` → `features/` migration (structural — NOT executed)
The prior report's §C1 migration plan (45 flat `src/components/` files → feature buckets, with the `TankestromScheduleDetails` / `SchoolProfileFields` "keep-shared" circular-import cautions) still stands as the reference plan. **No file moves were performed** — structural moves are report-only and out of scope for an unattended pass. Note: this Phase 5 pass removed `FamilyEditor`-candidate from the "move" set into the "confirm-then-delete" set (A.2), and deleted `DayTaskList` outright, so the migration's component inventory shrinks slightly.

---

## Summary

**Done (6 commits, build green throughout, not pushed):**
1. Removed orphaned `/mer/tankestrom` route cluster (route + wrapper + outlet bundle + page + manualChunks entry) — proven unreachable, superseded by `TankestromImportDialog`.
2–5. Removed 5 unreferenced files: `tankestromV2.ts`, `hostcupRichDurationHarness.ts`, `useCalendarDerivedState.ts`, `components/ui/index.ts`, `DayTaskList.tsx`.

**Deferred to report, with reasons:**
- **A.2** — `FamilyEditor`, `TodayActionStrip`, `DayHeader`: import-graph-dead but docs describe as live → confirm intentional removal (esp. `FamilyEditor`'s invite-recovery UI).
- **A.3** — getting-started "Inviter partner" → `/mer` is a dead link; correct target `/familie`. Behavior change → exact one-line fix given.
- **B** — `@capacitor/filesystem` + `@capacitor/haptics` unused in JS but Capacitor plugins (auto-registered natively; no native folders visible) → never removed unattended. All other deps used.
- **C** — full risk-classified `→ Synka` rename plan; HIGH-risk items (Supabase `project_id`, git remote, Hostinger deploy, Capacitor `appId`) flagged do-not-touch-casually.
- **D** — nested gitlink, SQL duplication, `tmp/` fixtures, god-files, audit-report overlap, temp markers, onboarding duplication. Several prior items (public internal files, security headers, `.gitignore` encoding) now resolved.

**Hard constraints honored:** build green after every commit; no behavioral changes; no rename executed; no `components/`→`features/` moves; no external-service/deploy config touched; no Capacitor plugin removed; every commit independent; uncertain items reported, not changed. Local only — not pushed.
