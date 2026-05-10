# Testing og CI

## Lokale og CI-kommandoer

| Kommando | Formål |
|----------|--------|
| `npm test` | Unit- og integrasjonstester (Vitest) |
| `npm run build` | TypeScript-prosjekt + Vite produksjonsbuild |

Begge forventes grønne før merge av endringer som berører applikasjonskode.

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
