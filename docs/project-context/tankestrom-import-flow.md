# Tankestrøm-importflyt

## Pipeline (én sannhet for preview)

```
Tankestrommen API
  → parsePortalImportProposalBundle (tankestromApi.ts)
  → defensive merge / dedupe (useTankestromImport)
  → buildDraftsFromItems (kalenderutkast per forslag)
  → buildEmbeddedChildCanonicalPreviewForReview (tankestromCanonicalPreview.ts)
  → TankestromImportDialog (visning, selection, validering, rediger-seed)
  → approveSelected → kalender/oppgaver
```

**Kanonisk preview-modell** (`src/lib/tankestromCanonicalPreview.ts`) er eneste sannhet for:

| Felt | Kilde |
|------|--------|
| Hovedtid / `Tid` i liste og detalj | `canonicalPreview.displayTime` / `timeLabel` |
| Highlights i preview | `canonicalPreview.normalized.highlights` |
| Forhåndsvalg (selection) | `canonicalPreview.isImportSelectable` |
| Import-telling | antall valgte barn der `isImportSelectable === true` |
| «Mangler sluttid»-blokker | kun valgte rader; foreløpige dager har tom start/slutt i draft |
| Rediger-seed (start/end) | `canonicalPreview.editSeed` — **ikke** rå `segment.start` |

## Råfelter som ikke skal brukes direkte i UI

Unngå parallelle avledninger fra:

- `segment.start` / `segment.end` for visning eller edit-seed
- `segment.tankestromHighlights` uten normalisering
- `presentEmbeddedChildNotesForReview` som eneste highlight-kilde når `originalImportText` + strukturerte highlights finnes
- `fallbackStartTime: segment.start` i modal

Disse kan være feil fra LLM (f.eks. fredag 17:45 på lørdag). Normalisering med dagsspesifikk `sourceTextForValidation` filtrerer lekkasje.

## Foreløpige / conditional dager

Regler (søndag, sluttspill uten bekreftet tid):

1. `isPreliminaryDay` / `isImportSelectable === false` → ikke i `initialSelectedIdsForGeneralImport`
2. Draft bygges med tom `start` og `end` (date-only)
3. Ingen `missing_end_time` når raden ikke er valgt
4. `displayTime` er `null`, `timeLabel` er `–`
5. Valgte fredag/lørdag blokkeres ikke av foreløpig søndag

Ved **manuell** avkrysning av foreløpig rad: bruker må fylle tid i rediger, eller behandle som info — eksisterende validering krever start/slutt ved eksport.

## Normalisering

`normalizeTankestromScheduleDetails` (tankestromScheduleDetails.ts):

- Dagseksjon fra `originalImportText` (ikke hele e-posten i `segment.notes` når det lekker)
- `correctMislabeledHighlightsAgainstSourceText` — dropper tider som ikke finnes i dagseksjonen
- `augmentHighlightsFromSourceText` — fyller manglende tider fra kilde når listen er tom

Kalled via `structuredDetailsFromSegment` → `buildEmbeddedChildStructuredScheduleDetailsForReview`.

## Tester

| Test | Dekning |
|------|---------|
| `tankestromCanonicalPreviewGolden.test.ts` | Exact Vårcup/Høstcup, selection, debug JSON |
| `tankestromCrossDayFallbackHighlight.test.ts` | Cross-day 17:45-lekkasje |
| `tankestromPreliminaryDayImport.test.ts` | Foreløpig søndag, import count |
| `e2e/tankestrom-vaacup.spec.ts`, `e2e/tankestrom-hostcup.spec.ts` | Synlig UI |

Debug ved feil: `tmp/tankestrom-preview-debug/*.json` (skrives av golden-tester via `tankestromCanonicalPreviewDebug.ts` — kun Node/test, ikke app-bundle).

## Manglende sluttid (start kjent)

Når utkast har **gyldig start** men tom slutt (ikke date-only, ikke fly med ukjent ankomst):

- Import **blokkeres ikke**; `buildPersistTimes` estimerer slutt (standard +60 min) ved persist.
- Metadata: `timePrecision: start_only`, `inferredEndTime: true`, `displayTimeLabel: Sluttid ikke oppgitt`.
- UI viser **amber** hint (`Sluttid ikke oppgitt – estimert ved import`), ikke rød «Mangler sluttid — Rediger».

## Tidligere problemklasser

- Highlights forsvant ved fold/merge
- Dobbelt notes-rendering
- Spond-frister som programtid
- Cross-day syntetiske highlights (17:45 på lørdag)
- Split mellom rå highlights for `timeLabel` og normaliserte highlights i detalj

## Playwright

E2E sjekker synlig struktur for kjente fixtures. Supplerer, erstatter ikke, golden unit-tester.
