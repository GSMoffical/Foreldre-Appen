# Synka — Operations Runbook

**Last updated:** <!-- update this date when the document changes -->
**Status:** Pre-beta
**Audience:** Technical team, Oslo Kommune procurement reviewers

---

## Architecture overview

| Component | Technology | Provider | Region |
|---|---|---|---|
| Frontend | React 18, TypeScript, Vite | Hostinger (static hosting) | EU |
| Database + Auth | Supabase (PostgreSQL + GoTrue) | Supabase | eu-west-1 (Ireland) |
| Realtime | Supabase Realtime | Supabase | eu-west-1 (Ireland) |
| AI document analysis | Python Flask (Tankestrøm) | Vercel | EU |
| Error monitoring | Sentry | Sentry (Germany — ingest.de) | EU |

All data is stored and processed within the EU.

---

## Monitoring

### Error monitoring — Sentry

All unhandled errors in the frontend are automatically captured by Sentry
and appear in the Sentry dashboard at https://sentry.io

**What is captured:**
- Unhandled JavaScript exceptions
- Tankestrøm analysis failures
- React rendering errors

**What is NOT captured (GDPR compliance):**
- User email addresses or names
- Event titles, task titles, or any calendar content
- Session replays or user behaviour recordings
- Auth tokens or session data

**Alerting:** Configure email alerts in the Sentry dashboard under
Project Settings → Alerts for any spike in error rate.

### Uptime monitoring

⚠️ Not yet configured — set up before beta launch.

Recommended: Use a free uptime monitor such as UptimeRobot (uptimerobot.com)
to ping the app URL every 5 minutes and alert via email if it goes down.

Add the following URLs to monitor:
- Frontend: your Hostinger domain
- Supabase API: your Supabase project URL + /rest/v1/
- Tankestrøm: your Vercel deployment URL + /api/health

---

## Incident response

### App is down (users cannot load the app)

1. Check Hostinger control panel for any deployment or server issues
2. Check https://status.supabase.com for Supabase incidents
3. Check https://www.vercel-status.com for Vercel incidents
4. Check Sentry for any error spike that preceded the outage
5. If a bad deployment caused the issue, roll back via Hostinger file manager
   by restoring the previous dist/ folder contents

### Database is unreachable

1. Check https://status.supabase.com
2. Check Supabase dashboard → Project Settings → Infrastructure for
   any paused project warning (free tier projects pause after 1 week
   of inactivity — upgrade to a paid plan before beta launch)
3. If the project is paused, click Restore in the dashboard

### A user reports their data is missing

1. Check Sentry for any errors around the time the data was lost
2. Check Supabase dashboard → Table Editor to verify the data exists
3. Check Supabase Auth → Users to confirm the user account is active
4. If data was accidentally deleted, contact Supabase support —
   point-in-time recovery is available on paid plans

### A user reports they cannot log in

1. Check Supabase Auth → Users — confirm the account exists
2. Check if the account email is confirmed (unconfirmed accounts cannot log in)
3. Ask the user to use the Forgot Password flow
4. If the account is locked due to too many failed attempts,
   it will unlock automatically after a cooldown period

### Suspected data breach or unauthorised access

1. Immediately go to Supabase dashboard → Auth → Users and disable
   the affected user account(s)
2. Rotate the Supabase service role key in Project Settings → API
3. Check Supabase logs for unusual query patterns
4. Notify Datatilsynet within 72 hours (GDPR Article 33 requirement)
   at https://www.datatilsynet.no/meld-fra/meld-avvik/
5. Document the incident in writing

---

## Maintenance

### Deploying a new version

1. Run `npm run build` locally and verify it succeeds
2. Run `npm run deploy:hostinger` to upload the dist/ folder to Hostinger
3. Verify the live app loads correctly after deploy
4. Check Sentry for any new errors in the 30 minutes after deploy

### Database migrations

All SQL changes are documented as .sql files in the repo root:
- `supabase-invites.sql` — invite system schema
- `supabase-security-patch-invite-token.sql` — invite token RPC hardening
- `supabase-delete-account.sql` — account deletion RPC
- `supabase-performance-indexes.sql` — performance indexes

To apply a migration: paste the SQL into Supabase SQL Editor and run it.
Run each statement separately if the file contains multiple statements.

⚠️ Before beta: migrate to Supabase CLI migrations for a proper audit trail.

### Rotating secrets

**Supabase anon key:** Update VITE_SUPABASE_ANON_KEY in Hostinger environment
variables and redeploy. The anon key is public-facing — rotating it requires
all active users to reload the app.

**Sentry DSN:** Update VITE_SENTRY_DSN in .env.local and redeploy.

---

## Capacity and limits

| Resource | Current limit | Action if reached |
|---|---|---|
| Supabase free tier database | 500 MB | Upgrade to Supabase Pro ($25/mo) |
| Supabase free tier API requests | 2M requests/mo | Upgrade to Supabase Pro |
| Supabase Realtime connections | 200 concurrent | Upgrade plan or optimise connection sharing |
| Sentry free tier errors | 5,000 errors/mo | Upgrade Sentry plan or resolve top errors |
| Vercel Tankestrøm (hobby) | 100 GB-hours/mo | Upgrade to Vercel Pro |
| Hostinger | Depends on plan | Check Hostinger dashboard |

**Recommendation before beta:** Upgrade Supabase to the Pro plan.
The free tier pauses after 1 week of inactivity — unacceptable for
a production app. Pro also includes point-in-time recovery for the
database, which is important for GDPR data recovery obligations.

---

## GDPR contacts and obligations

**Data controller:** [Your organisation name and address — fill this in]
**Contact for data requests:** [Email address — fill this in]
**Datatilsynet breach reporting:** https://www.datatilsynet.no/meld-fra/meld-avvik/
**Breach reporting deadline:** 72 hours from discovery (GDPR Article 33)

User data deletion requests must be fulfilled within 30 days (GDPR Article 17).
The account deletion feature in the app allows users to self-serve.
For users who cannot access their account, delete manually via:
Supabase dashboard → SQL Editor → run delete_user_account() with the user's ID.
