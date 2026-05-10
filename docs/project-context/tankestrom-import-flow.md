# Tankestrøm-importflyt — læringsnotater

## To mulige feilkilder

Ved feil i import eller preview: feilen kan ligge i **Tankestrømmens analyse-output**, i **Foreldre-appens normalisering/visning**, eller i **grensesnittet mellom dem**. Det er nyttig å skille:

1. Hva kom ut av API-et (struktur og felter)?
2. Hvordan ble det tolket, foldet og deduplisert i appen?
3. Hva rendrer UI faktisk (read-only vs redigerbar)?

## Viktige konsepter og felter

Disse dukker ofte opp i arrangement-/ukeprogram-import:

| Konsept | Kommentar |
|---------|-----------|
| `embeddedSchedule` | Per-dag segmenter under et parent-arrangement |
| `dayContent.highlights` | Dag-spesifikke høydepunkter der modellen bruker det |
| `tankestromHighlights` | Strukturerte tidslinjer (tid + label + type) per segment |
| `bringItems` | «Ta med» / pakkeliste — løftes ofte til egen UI-seksjon |
| `notes` | Fritekst-/punktnotater; må ikke dupliseres unødig mot rå visning |
| `timeWindowCandidates` / tid-vinduer | Brukes til å utlede eller vise tidsintervaller der det er relevant |
| `tentative` / `conditional` | «Foreløpig», sluttspill avhengig av tidligere resultater — skal ikke presenteres som fast endelig tid uten grunnlag |

Appens `src/lib/`-moduler (embedded schedule, arrangement-merge, schedule details, review-notater) utgjør mye av «oversettelsen» fra rå metadata til det brukeren ser.

## Tidligere problemklasser (nå delvis dekket av tester/regler)

- **Highlights forsvant** ved fold/merge av arrangement-segmenter — må bevare eller rekonstruere fra kildefelter.
- **`dayContent.highlights`** må leses/bevares der modellen leverer dem.
- **Dobbelt notes-rendering** i read-only visning — én strukturert blokk, ikke samme innhold to ganger.
- **Spond-frister** skal ikke feiltolkes som **programtid** i kalender-høydepunkter.
- **Søndag / sluttspill**: når teksten sier betinget eller ikke endelig avklart, skal UI ikke antyde fast kampstart uten grunnlag.

## Playwright som sikkerhetsnett

E2E-testene sjekker at **synlig struktur** (titler, highlights, «Husk / ta med», negative assertions) stemmer med forventet oppførsel for **kjente fixtures**. De erstatter ikke manuell vurdering av nye kildetyper, men hindrer regresjon på allerede avtalt UX.
