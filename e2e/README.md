# E2E-tester (Tankestrøm import)

Disse testene krever innlogging mot appen. Sett miljøvariabler lokalt før kjøring:

- `E2E_LOGIN_EMAIL`
- `E2E_LOGIN_PASSWORD`

Eksempel (PowerShell):

```powershell
$env:E2E_LOGIN_EMAIL="deg@example.com"
$env:E2E_LOGIN_PASSWORD="veldig-hemmelig"
```

Ikke legg inn ekte passord/secrets i repo.

## Kjør tester

Vårcupen:

```bash
npx playwright test e2e/tankestrom-vaacup.spec.ts
```

Høstcupen:

```bash
npx playwright test e2e/tankestrom-hostcup.spec.ts
```

Begge:

```bash
npx playwright test e2e/tankestrom-vaacup.spec.ts e2e/tankestrom-hostcup.spec.ts
```

Kjør med synlig browser (`--headed`):

```bash
npx playwright test e2e/tankestrom-vaacup.spec.ts --headed
npx playwright test e2e/tankestrom-hostcup.spec.ts --headed
```

## Rapporter og trace

Åpne Playwright-rapport:

```bash
npx playwright show-report
```

Åpne trace ved feil:

```bash
npx playwright show-trace <path-to-trace.zip>
```

## Om teststrategi

- `tankestrom-vaacup.spec.ts`: kan kjøres mot faktisk analyseflyt hvis miljøet er satt opp for det.
- `tankestrom-hostcup.spec.ts`: bruker mock-respons fra `e2e/fixtures/hostcup-analyze-response.json` og validerer primært Foreldre-appens rendering/import-preview.
