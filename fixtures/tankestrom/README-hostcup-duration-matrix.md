# Høstcup varighets-/tid-matrise (lokal test)

Kjører mange varianter av Høstcup-tekst og embedded-segment gjennom samme pipeline som import-dialogen:

`tekstvariant` × `segment-mutasjon` → canonical preview → edit-seed → export-tider → draft → validering/selection.

## Kjøring

```powershell
npm run eval:tankestrom:duration
```

Strict policy-invariants: `src/lib/tankestromEval/hostcupDurationPolicyInvariants.ts`

## Debug-output

Etter testen skrives:

- `tmp/tankestrom-duration-inference-hostcup/matrix-latest.json` (inkl. `summary` med totalCases, passedCases, sundayLeakCount, …)
- `tmp/tankestrom-duration-inference-hostcup/failures-latest.json` (kun ved policy-brudd)

Kjente case (`__son_leak_fri_1730`) feiler strict med «known failure remains» til produksjonslogikk er fikset.

Per dag i hver case:

| Felt | Betydning |
|------|-----------|
| `rawSegmentStart` / `rawSegmentEnd` | Rå JSON fra analyze/segment-mutasjon |
| `canonicalDisplayTime` | Preview hovedtid |
| `editSeedStart` / `editSeedEnd` | Seed til rediger-skjema |
| `exportResolvedStart` / `exportResolvedEnd` | `resolveEmbeddedScheduleSegmentTimesForCalendarExport` |
| `exportPolicy` / `usesSyntheticLayoutEnd` | Varighets-/slutt-policy |
| `draftStart` / `draftEnd` / `draftDurationMinutes` | Import-utkast |
| `draftHasStartWithoutEnd` | Tom slutt i utkast med start |
| `validationBlockers` | Eksport-blokkerere |
| `evalInvariantFailures` | Eksisterende Høstcup-invariants (normalize-eval-sti) |

## Utvide

- Tekstvarianter: `src/lib/tankestromEval/hostcupTextVariants.ts`
- Segment-mutasjoner: `src/lib/tankestromEval/hostcupSegmentMutations.ts`
- Harness: `src/lib/tankestromEval/hostcupDurationInferenceHarness.ts`
