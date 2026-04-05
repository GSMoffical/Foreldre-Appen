# UX-maling for foreldrekalender (MVP)

## Baseline-metrikker

Foreslatte primarmetrikker:

- `time_to_add_event_ms`
- `time_to_resolve_conflict_ms`
- `time_to_reassign_participant_ms`
- `flow_backtracks`
- `unresolved_conflicts_end_of_day`

## Implementert malepunkter i appen

- Add-flyt: starter nar bruker apner "Legg til", stopper ved lagring.
- Konfliktflyt: starter nar konfliktark apnes, stopper nar beslutning lagres.
- Reassign-flyt: maaler varighet ved transport-omfordeling i logistikkvisning.
- Backtrack: teller nar add-sheet lukkes uten lagring.
- Uavklarte konflikter ved dagskifte: logges nar bruker forlater dagens dato med uavklarte konflikter.

Merk: data lagres lokalt i `localStorage` under `ux-metrics-v1` for MVP-validering.

## 5 oppgaver for brukertest (10-15 min)

1. Legg inn "Henting skole" i dag kl 15:00 med riktig barn.
2. Aapne en konflikt i bakgrunnsdetaljer og velg prioritering.
3. Endre hvem som henter/leverer i logistikk.
4. Flytt en aktivitet til i morgen via "I dag"-strip.
5. Slett en aktivitet og bruk "Angre".

## Evalueringsskjema per oppgave

- Fullfort uten hjelp: Ja/Nei
- Tid brukt (sekunder)
- Antall feil/backtracks
- Selvsikkerhet (1-5)
- Kommentar fra forelder (fri tekst)
