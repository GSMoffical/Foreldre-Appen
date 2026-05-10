# Prosjektkontekst (Foreldre-appen)

Denne mappen er **prosjektminne og kontekst** for utviklere og agenter (Cursor m.m.). Målet er at viktig arkitektur, test/CI, Tankestrøm-flyt, personvern og arbeidsflyt ikke går tapt når chat-historikk eller personer skifter.

## Kort om produktet

**Foreldre-appen** er frontend/portal for familie- og kalenderflyt: hendelser, gjøremål og tilknyttet innhold leses og redigeres i nettleseren.

Appen bruker **Tankestrømmen** (ekstern analyse) til å importere **tekst, PDF eller bilde** og få tilbake strukturerte **forslag** som brukeren **forhåndsviser og godkjenner** før noe lagres.

## Viktige deler

| Område | Rolle |
|--------|--------|
| Kalender / hendelser | Kjerne-UI og lagring av familieaktiviteter |
| Tankestrøm-importdialog | Opplasting/innliming, analyse, review og import |
| Review / preview | Normalisert visning før bruker bekrefter import |
| Supabase | Autentisering og database |
| Playwright E2E | Automatisert verifikasjon av import-preview og sentrale UI-scenarioer |
| Sentry | Valgfri frontend-feilovervåkning (kun med `VITE_SENTRY_DSN`) |
| GitHub Actions CI | `test`, `build`, `e2e` på PR og push |

## Videre lesning

- [architecture.md](./architecture.md) — lagdeling og hvor ting bor i repoet
- [testing-and-ci.md](./testing-and-ci.md) — tester, CI og secrets (uten verdier)
- [tankestrom-import-flow.md](./tankestrom-import-flow.md) — analyse vs app vs persist
- [sentry-and-privacy.md](./sentry-and-privacy.md) — overvåkning og personvern
- [agent-pr-flow.md](./agent-pr-flow.md) — arbeidsflyt for agenter og PR-er
