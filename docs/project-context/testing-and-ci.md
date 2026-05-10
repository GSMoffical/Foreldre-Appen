# Testing og CI

## Lokale og CI-kommandoer

| Kommando | Formål |
|----------|--------|
| `npm test` | Unit- og integrasjonstester (Vitest) |
| `npm run build` | TypeScript-prosjekt + Vite produksjonsbuild |
| `npm run check:supabase-events-schema` | Valgfri **read-only** sjekk av at Supabase `events`-tabellen har kolonner appen bruker ved Tankestrom-import (krever eksplisitt flagg + URL/nøkkel) |

Begge forventes grønne før merge av endringer som berører applikasjonskode.

### Supabase `events`-skjema før deploy (anbefalt)

Standard `npm test` **kjører ikke** mot ekte Supabase og fanget derfor ikke manglende kolonner (`metadata`, `reminder_minutes`, `recurrence_group_id`) før manuell UI-test.

For å avdekke mismatch tidlig (mot **dev/staging** — ikke legg inn hemmeligheter i repo):

1. Sett `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY` (samme som i `.env.local`, eller hent fra Supabase Dashboard).
2. Sett **`RUN_SUPABASE_EVENTS_SCHEMA_CHECK=1`** (eller `true`) — uten dette hoppes integrasjonstesten over med vilje.
3. Kjør:

```bash
RUN_SUPABASE_EVENTS_SCHEMA_CHECK=1 npm run check:supabase-events-schema
```

På Windows (PowerShell):

```powershell
$env:RUN_SUPABASE_EVENTS_SCHEMA_CHECK='1'; npm run check:supabase-events-schema
```

Sjekken bruker PostgREST **OpenAPI** (`/rest/v1/`) som primærkilde (ingen hendelsesrader leses), med sekundær `select(...).limit(0)` hvis OpenAPI ikke lar seg parse.

**CI:** `test`-jobben har ikke Supabase-secrets; kjør kommandoen i en jobb som allerede har `VITE_SUPABASE_*` (f.eks. etter E2E-secrets) bare hvis dere eksplisitt ønsker det — bruk **staging**-prosjekt, ikke produksjon, med mindre det er bevisst.

## Playwright E2E

E2E dekker **reell brukerflyt** i nettleser, inkludert innlogging og **Tankestrøm-importdialog** med analyse og import-preview.

Typiske specs:

- `e2e/tankestrom-vaacup.spec.ts` — Vårcupen-scenario (kalenderdager, highlights, betinget søndag)
- `e2e/tankestrom-hostcup.spec.ts` — Høstcupen-scenario (titler, highlights, «Husk / ta med», notater)

Fixtures ligger under `e2e/fixtures/` (tekst + mock JSON der mock er aktivert). **Ikke commit** eller lim inn ekte private meldinger som fixture; bruk syntetiske eksempler.

### HEADED-kjøring lokalt

```bash
npx playwright test e2e/tankestrom-vaacup.spec.ts e2e/tankestrom-hostcup.spec.ts --headed
```

Uten innloggingsmiljø kan tester **hoppe over** innlogging — sett da miljøvariabler som dokumentert i `e2e/README.md`.

## GitHub Actions

Workflow-filen `.github/workflows/ci.yml` definerer tre jobber:

| Jobb-ID | På PR som check-navn (typisk) |
|---------|--------------------------------|
| `test` | **CI / test** |
| `build` | **CI / build** |
| `e2e` | **CI / e2e** |

`e2e` avhenger av `test` og `build`. Branch protection bør kreve at disse er grønne før merge (se organisasjonens innstillinger).

## GitHub Secrets for E2E i CI

E2E-jobben trenger **secrets** (navnene under — **ikke** verdier i repo eller i denne doc):

- `E2E_LOGIN_EMAIL`
- `E2E_LOGIN_PASSWORD`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TANKESTROM_ANALYZE_URL`

Konfigurer dem i repoets **Settings → Secrets and variables**. Lokalt brukes ofte `.env.local` som **ikke** skal committes.

## Nyttige referanser

- `e2e/README.md` — env-vars og kjøremønstre
- `playwright.config.ts` — prosjekter, base URL, webServer
