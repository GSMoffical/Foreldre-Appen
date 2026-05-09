## Hva er endret?
<!-- Kort, konkret oppsummering av endringen. -->


## Hvorfor?
<!-- Bakgrunn, issue-lenke, produkt-/teknisk motivasjon. -->


## Hvordan er det testet?
<!-- Lokale kommandoer, manuelle steg, fixtures. -->


## CI-status
<!-- Lim inn kort status eller lenke til siste grønne/røde kjøring. -->
- [ ] `test` / `build` / `e2e` (etter relevant) er grønn på siste push


## Risiko
<!-- Regresjon, ytelse, migrering, avhengigheter, brukerflyt. -->


## Personvern / secrets-sjekk
- [ ] Ingen hemmeligheter, tokens eller rå persondata committet
- [ ] Miljøvariabler og hemmeligheter kun via trygge kanaler (GitHub Secrets, lokalt `.env` som ikke committes)
- [ ] Endringer som berører logging/overvåkning er vurdert (f.eks. Sentry, ingen unødvendig PII)


## Manuell sjekk før merge
- [ ] 
- [ ] 


## Braintrust / eval (kun hvis Tankestrømmen-analyse, scorers eller modellvalg er berørt)
<!-- Lenke til eval-run, scorer-endring, modellversjon, eller «ikke aktuelt». -->
- [ ] Ikke aktuelt (Tankestrøm-backend / analyse / scorers er ikke berørt)
- [ ] Aktuelt: dokumentert under (lenke eller kort beskrivelse)


## Playwright / E2E (kun hvis Foreldre-app UI eller Tankestrøm-import er berørt)
- [ ] Ikke aktuelt (UI/import-flyt er ikke berørt)
- [ ] Aktuelt: relevante E2E-spesifikasjoner kjørt og grønne (eller begrunnelse ved unntak)


## Sjekkliste (generelt)
- [ ] Endringen er innenfor PR-ens scope (ingen unødvendig «scope creep»)
- [ ] Kode følger eksisterende mønstre i repoet
- [ ] Dokumentasjon / kommentarer oppdatert der det trengs for vedlikehold
