# Security fixes report — exposed `public/` files + CSP/security headers

**Branch:** `feature/capacitor-native`
**Date:** 2026-06-23
**Scope:** Two HIGH-severity items from `CLEANUP_REPORT.md` (#1 exposed files, #2 unapplied headers).
**Commits (local, not pushed):**
- `d455cab` — `security: remove internal files exposed via public/ (morten pack.zip, vibe_coding_wip.docx)`
- `47c1528` — `security: apply CSP and security headers via .htaccess for Apache/Hostinger`

---

## Item 1 — Internal files were being served publicly from `public/`

### What was in `public/` (before)

| File | Size | Genuine web asset? | Action |
|---|---|---|---|
| `favicon.svg` | 181 B | ✅ icon | kept |
| `manifest.webmanifest` | 403 B | ✅ PWA manifest | kept |
| `synka-mark.svg` | 922 B | ✅ brand mark (used by `<img src="/synka-mark.svg">`) | kept |
| `.htaccess` | 25 B | ✅ server config (`AddDefaultCharset UTF-8`) | kept + extended (Item 2) |
| `_headers` | 581 B | ⚠️ Netlify/Cloudflare config, ignored by Apache | removed (Item 2) |
| **`morten pack.zip`** | **160 KB** | ❌ internal | **moved out** |
| **`vibe_coding_wip.docx`** | **12 KB** | ❌ internal | **moved out** |

Everything in `public/` is copied verbatim into `dist/` by Vite and served at the deploy
root. So both internal files were downloadable by anyone at
`https://<site>/morten%20pack.zip` and `https://<site>/vibe_coding_wip.docx`.

### What the exposed files contained (for sensitivity assessment)

- **`morten pack.zip`** — 8 files: `okonomiledelse_template.pptx` (a finance/"økonomiledelse"
  PowerPoint template), `linkedin-banner.png`, and brand logos (`logo-light/dark/icon` in PNG+SVG).
  → Internal branding/marketing material. **No credentials or secrets.**
- **`vibe_coding_wip.docx`** — a Word document with body text, footnotes/endnotes, and
  **tracked-changes comments** (`word/comments.xml`). A work-in-progress planning doc.
  → Internal notes. **No credentials**, but may contain internal plans / names — see scrub advice.

### What was done

1. Created top-level **`internal-docs/`** (outside the Vite build) and **moved** both files there
   (moved, not deleted — one is a WIP doc, so no work is lost).
2. Added **`internal-docs/`** to `.gitignore` so they can't be re-committed or re-deployed.
3. Removed both files from git tracking (they are no longer in HEAD or `dist/`).
4. **`.gitignore` repair (resolves `CLEANUP_REPORT.md` item #3):** the file's trailing rule was
   stored as **UTF-16LE bytes inside an ASCII file** (interleaved null bytes — git treated the
   whole file as binary and could not parse the rule). Re-encoded the entire file as clean UTF-8,
   re-added the intended **`Foreldre-Appen/`** rule, and added `internal-docs/`.

### ⚠️ Removing from the repo does NOT un-expose the live server

`scripts/deploy-hostinger.ps1` is **additive** for root files: it wipes and re-uploads only
`remote/assets` (`rm -rf <root>/assets`), then `put`/`scp`s root files **without deleting stale
ones**. So if these two files were ever deployed, **they are still live on the Hostinger server
root** and will NOT be removed by the next deploy (they're no longer in `dist/` to overwrite them).

**Action required (manual, server-side):** delete `morten pack.zip` and `vibe_coding_wip.docx`
from `public_html/` on Hostinger (hPanel File Manager, SFTP, or
`ssh … rm "<root>/morten pack.zip" "<root>/vibe_coding_wip.docx"`).

### Git history — is a scrub warranted?

Both files were committed in **`29631a3`** and **remain in git history**. Removing them from HEAD
stops *future* builds/exposure but does not remove them from past commits.

**Recommendation: a history rewrite is NOT required, with one conditional.**
- Neither file contains credentials/secrets (the real secrets live in `.env`, which is **not
  tracked** — verified with `git ls-files .env` → empty).
- Since they were publicly downloadable while the site was live, treat the contents as
  *potentially already disclosed*; no secret rotation is needed (there are none).
- **Conditional:** the app handles family/children data (GDPR-sensitive). **Inspect the
  `vibe_coding_wip.docx` comments and the `.pptx`** for real personal data or confidential
  strategy. If either contains data you need to be unrecoverable, *then* a coordinated scrub is
  justified:
  ```
  git filter-repo --path "public/morten pack.zip" --path "public/vibe_coding_wip.docx" --invert-paths
  ```
  This rewrites every commit hash from `29631a3` onward → force-push + all collaborators re-clone.
  **Not performed here** (destructive, needs team coordination and your go-ahead).

---

## Item 2 — Security headers now actually apply on Apache/Hostinger

### The problem

`public/_headers` (Netlify/Cloudflare-Pages format) defined a full CSP + header set, but
**Apache ignores `_headers`**. The real `public/.htaccess` only set `AddDefaultCharset UTF-8`.
Net effect: **production shipped with no CSP and none of the intended security headers.**

### The fix

Translated the header set into **`public/.htaccess`** using `mod_headers` (`Header always set …`).
Vite copies `public/.htaccess` → `dist/.htaccess` → deploys to the server root next to `index.html`.
**Verified `dist/.htaccess` is present after `vite build`.**

### Final header set (emitted by `.htaccess`)

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Strict-Transport-Security` | `max-age=31536000` *(new — see note)* |
| `Content-Security-Policy` | see below |

> **HSTS note:** added (was not in `_headers`). Deliberately **without** `includeSubDomains`/`preload`
> — add those only once every subdomain is confirmed HTTPS-only, since HSTS is sticky and hard to undo.

### Content-Security-Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.de.sentry.io https://*.vercel.app;
object-src 'none';
frame-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

### CSP origin list — what each allows and why (audited against real runtime egress)

| Directive / origin | Why it's needed |
|---|---|
| `default-src 'self'` | App's own Vite JS/CSS chunks, manifest, icons (all same-origin). |
| `script-src 'self'` | Only same-origin module scripts. **Built `dist/index.html` has no inline `<script>`** and **no bundled dep uses `eval`/`new Function`** (both verified against `dist/`), so neither `'unsafe-inline'` nor `'unsafe-eval'` is needed. |
| `style-src 'unsafe-inline'` | **framer-motion injects inline element styles** (and React `style={{…}}` props). Genuinely required. |
| `style-src https://fonts.googleapis.com` | Google Fonts CSS `<link>` in `index.html` (Inter). |
| `font-src https://fonts.gstatic.com` | The woff2 files the Google Fonts CSS references. |
| `connect-src https://*.supabase.co` | Supabase REST/auth (`VITE_SUPABASE_URL` → `*.supabase.co`); also storage/edge-functions share this host. |
| `connect-src wss://*.supabase.co` | Supabase Realtime websockets (`supabase.channel(...)` — 4 call sites). |
| `connect-src https://*.ingest.de.sentry.io` | Sentry EU error ingest (`VITE_SENTRY_DSN` → `…ingest.de.sentry.io`). Replay/tracing disabled, so no worker/blob transport. |
| `connect-src https://*.vercel.app` | **Tankestrøm AI analysis endpoint** (`VITE_TANKESTROM_ANALYZE_URL`, a per-branch Vercel deployment). Wildcard required — the host changes per deploy. |
| `img-src data: blob:` | Inline SVG / data-URI imagery and blob image previews. |
| `object-src 'none'`, `frame-src 'none'` | App embeds no plugins or iframes — hardening. |
| `frame-ancestors 'none'` | Clickjacking protection (modern equivalent of X-Frame-Options). |
| `base-uri 'self'`, `form-action 'self'` | Standard injection hardening. |

**Not contacted at runtime (verified, so deliberately excluded):** no analytics/telemetry beacons
(no PostHog/GA/Segment/sendBeacon), no remote images (no Supabase-storage `getPublicUrl`, no CDN/
gravatar), no web/service workers, no `<video>`/`<audio>`, no second Supabase host. `worker-src`,
`media-src`, and `manifest-src` are omitted and safely fall back to `default-src 'self'`.

### Deltas vs the old `_headers` CSP

| Change | Reason |
|---|---|
| **+ `https://*.vercel.app`** in `connect-src` | The old CSP **would have silently broken Tankestrøm** (its analyze endpoint is on Vercel). This is the most important fix. |
| **− `'unsafe-inline'`** from `script-src` | No inline scripts in the build; tightening per the brief ("avoid unsafe-inline unless required"). |
| **− `https://*.sentry.io`** from `connect-src` | Redundant — the EU ingest host is covered by `*.ingest.de.sentry.io`. |
| **+ `object-src 'none'` + `frame-src 'none'`** | Cheap hardening; app uses no plugins/iframes. |
| **+ `Strict-Transport-Security`** | HSTS hardening (conservative max-age, no preload). |

### SPA routing

The app uses **hash routing (`createHashRouter`)** — deep links live after `#` and resolve
client-side, so a server rewrite is **not strictly required**. A guarded `mod_rewrite` block is
included as a safety net (serve `index.html` for any non-file/non-dir request → app instead of 404).

### `_headers` decision: removed

The frontend deploys **only to Hostinger/Apache** (`scripts/deploy-hostinger.ps1`). There is **no
`netlify.toml`, `_redirects`, `wrangler.toml`, or `vercel.json`** for the frontend (the only Vercel
reference is the *separate* Tankestrøm backend service). So `_headers` was dead and was removed.

---

## How the CSP was verified (methodology)

A multi-agent adversarial audit traced the app's real runtime egress from three independent lenses
(network/`fetch`/WebSocket; scripts/styles/fonts/img/workers; bundled third-party SDKs), then a
two-verifier panel tried to find any origin the proposed CSP would block. Result: **0 blocked
origins** — the CSP allows everything the web build needs. Findings were re-verified by hand against
the **built `dist/` output** (the decisive evidence, not just source).

## Build verification

- `npm run build` (`tsc -b && vite build`) — **passes** (the only stderr is the pre-existing
  `vendor-date`/date-holidays >500 KB chunk-size warning, unrelated to this change).
- `dist/.htaccess` — **present**; `dist/_headers` — **absent**; neither internal file in `dist/`.
- `dist/index.html` — only an external `<script src="./assets/…">`, **no inline script**.
- `dist/assets/*.js` — **no `eval`/`new Function`**.

## Forward-looking caveats (CSP is env-dependent)

The CSP tracks current `VITE_*` values. **Update `connect-src` if** any of these change:
- `VITE_SUPABASE_URL` moves to a **custom domain** (not `*.supabase.co`).
- `VITE_TANKESTROM_ANALYZE_URL` moves **off Vercel** (custom domain, or a Supabase Edge Function host).
- The Sentry DSN **region changes** (e.g. US → `*.ingest.us.sentry.io`, which `*.ingest.de.sentry.io` won't match).
- Sentry **Session Replay/tracing is enabled** → add `worker-src 'self' blob:`.

## Outstanding manual actions (server-side, not in this PR)

1. **Delete `morten pack.zip` and `vibe_coding_wip.docx` from the Hostinger `public_html/` root** —
   the additive deploy will not remove them.
2. Inspect the two files for sensitive personal data; decide on a git-history scrub only if warranted.
