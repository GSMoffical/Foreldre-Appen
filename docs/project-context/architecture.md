# Arkitektur (høyt nivå)

## Stack

- **Foreldre-appen** er en **React + Vite** single-page applikasjon som kjører i nettleseren.

## Tankestrømmen og analyse

- Appen kaller Tankestrømmen via et **analyze-endepunkt** (konfigureres med miljøvariabler i build; se testing-and-ci.md).
- Svaret modelleres som en **proposal bundle** med kalender-/skole-/gjøremål-forslag avhengig av innholdstype.

## Importflyt (enden til enden)

1. Bruker åpner **Tankestrøm-import** fra innstillinger (eller tilsvarende inngang).
2. Bruker velger **tekst eller fil(er)** og starter **analyse**.
3. Innhold sendes til analyse-tjenesten; appen mottar en **proposal bundle**.
4. Appen **normaliserer, folder og beriker** forslag (arrangementer med `embeddedSchedule`, skoleprofiler, overlays, osv.).
5. Bruker ser **review/preview**, justerer valg og bekrefter **import**.
6. Valgte hendelser/gjøremål **persisteres** via eksisterende kalender-/oppgave-lag.

## Skill mellom lag

| Lag | Ansvar |
|-----|--------|
| **Tankestrømmen-output** | Rå struktur fra analyse-API (forslag, metadata, provenance) |
| **Foreldre-app: parsing/normalisering** | Dedupe, merge av arrangement-segmenter, defensive titler, skill mellom highlights og notater, osv. |
| **UI-rendering** | Dialog, kort, highlights, «Husk / ta med», betinget søndag/sluttspill, osv. |
| **Persist/import** | Opprettelse/oppdatering av hendelser og oppgaver i databasen etter brukerens godkjenning |

For dypt detaljnivå: følg dataflyten i kode fra dialog-hook til lagringsfunksjoner.

## Relevante mapper i repoet

| Mappe | Innhold (forenklet) |
|-------|---------------------|
| `src/features/tankestrom/` | Importdialog, `useTankestromImport`, typer og Tankestrøm-spesifikk UI |
| `src/lib/` | Delte biblioteker: embedded schedule, arrangement-merge, schedule details, notater, osv. |
| `e2e/` | Playwright-spesifikasjoner og fixtures for import-preview (f.eks. cup-scenarioer) |

Dette dokumentet er bevisst kort; produktroadmap og MVP-fokus står i øvrig repo-dokumentasjon der det finnes.
