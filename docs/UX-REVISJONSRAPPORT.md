# UX-REVISJONSRAPPORT: Synka Familiekalender — Pre-beta, Mai 2026

> Basert på fullstendig statisk kodeanalyse av `src/components/`, `src/features/` og `src/App.tsx`.
> **Alvorlighetsgrader:** `KRITISK` = bruker gir opp/mister data · `ALVORLIG` = tydelig frustrasjon · `MINOR` = skavank

---

## DEL 1: PERSONA × SCENARIO

---

## PERSONA 1: MARTE (38) — Travail arbeidende mor, ikke teknisk, første gang

### S1 — Første gang åpne appen og registrere seg

**Steg:** Åpner appen → spinner med «Loading…» (engelsk) → ser innloggingsskjerm i `signin`-modus → finner liten tekstlenke «Ny bruker? Opprett konto» → fyller inn Navn/Familienavn/E-post/Passord → «Opprett konto» → suksessmelding om e-postbekreftelse → klikker lenke i e-post → returnerer til appen → **appen viser innloggingsskjerm igjen uten bekreftelse** → logger inn manuelt → `FamilySetupScreen` vises med teksten «ForeldrePortalen er bygd rundt barna» → legger til barn → **kalender åpnes uten en eneste forklaring** (`ENABLE_ONBOARDING = false` i `App.tsx:62`).

**Friksjon:**
- `KRITISK` — Onboarding-turen er hardkodet deaktivert. `OnboardingTour`-komponenten eksisterer men brukes aldri. Marte kastes rett inn i en tom kalender.
- `ALVORLIG` — Etter e-postbekreftelse vises ingen bekreftelsesmelding. Brukeren vet ikke om de skal logge inn igjen.
- `ALVORLIG` — `FamilySetupScreen.tsx:78` viser gammelt app-navn «ForeldrePortalen», ikke «Synka».
- `ALVORLIG` — Spinner-tekst `App.tsx:396` er på engelsk: «Loading…».
- `MINOR` — Standard-modus er innlogging, ikke registrering — ny bruker bruker tid på å finne «Opprett konto»-lenken.

---

### S2 — Legge til sin første kalenderhenelse

**Steg:** Trykker «+»-knapp øverst til høyre → liten meny med «Hendelse» / «Gjøremål» → velger «Hendelse» → `AddEventSheet` glir opp → ser «Hvem»-seksjonen med person-chips, **ingen er valgt som standard** → fyller ut tittel «Tannlege», endrer tid til 09:00–10:00 → trykker «Legg til» → **feilmelding: «Velg minst én person.»** → velger «Emma» → lagrer → arket lukkes stille.

**Friksjon:**
- `KRITISK` — Ingen person er forhåndsvalgt i `AddEventSheet.tsx:127`. `CalendarHomeTab` kaller `openAddEvent()` uten `mePersonId` som `initialPersonId`. Brukeren fyller ut hele skjemaet og møter veisperring til slutt.
- `ALVORLIG` — Etiketten «Hvem» er tvetydig — betyr det «hvem deltar», «hvem eier hendelsen» eller «hvem er ansvarlig»?
- `MINOR` — Ingen suksess-toast etter lagring. Arket forsvinner stille.

---

### S3 — Gjentakende ukentlig hendelse (fotball hver tirsdag)

**Steg:** Åpner AddEventSheet → fyller ut «Fotball» → leter etter gjentakelse → **finner det ikke** → oppdager til slutt «Mer (gjentak, påminnelse, transport)»-knappen → trykker → scroller ned → åpner «Gjentakelse»-dropdown → velger «Ukentlig» → et «Sluttdato»-felt dukker opp med standardverdi **12 uker frem**.

**Friksjon:**
- `ALVORLIG` — Gjentakelse er skjult bak en progressiv avsløring i `AddEventSheet.tsx:440`. Gjentakelse er en kjernebrukssak for barnefamilier — bør ikke være skjult.
- `ALVORLIG` — Standardsluttdato på 12 uker er upresis for sportssesonger (typisk 6–8 måneder). Ingen kontekstuell forklaring.
- `MINOR` — Ingen bekreftelse på antall opprettede hendelser etter lagring.

---

### S4 — Legge til et gjøremål med frist

**Steg:** Trykker «+» → «Gjøremål» → `AddTaskSheet` åpnes → fyller inn tittel, dato, tid.

**Friksjon:**
- `ALVORLIG` — Gjøremål-konseptet er ikke forklart noe sted. Hva er forskjellen på en «hendelse» og et «gjøremål»? Ingen onboarding-tekst.
- `MINOR` — Gjøremål-ikonet i `BottomNav` er `IconCheck` — ikke intuitivt representativt for en to-do-liste.

---

### S5 — Markere et gjøremål som ferdig

**Steg:** Navigerer til «Gjøremål»-fanen → finner gjøremålet → trykker tom sirkel til venstre → gjøremålet **forsvinner fra listen** → Marte er usikker på om det ble slettet eller fullført.

**Friksjon:**
- `ALVORLIG` — I `TasksScreen.tsx` flyttes fullførte gjøremål til en «Ferdige»-seksjon som er kollapset som standard. Ingenting informerer brukeren om at gjøremålet er fullført, ikke slettet. Ingen angre-toast.
- `MINOR` — Angre-funksjonalitet (trykk sirkelen igjen) er usynlig — brukeren vet ikke at den finnes.

---

### S6 — Importere skolerute via Tankestrøm

**Steg:** «Mer» → «Tankestrøm» → ny side åpnes → ser opplastingssone med tekst «PDF, bilde, **eller lim inn tekst**» → **ingen tekstboks er synlig** → laster opp bilde av ukeplanen → spinner «Analyserer…» → liste over foreslåtte hendelser vises → alle er forhåndsvalgt → trykker «Legg til X hendelser» → toast: «Importert til kalenderen».

**Friksjon:**
- `KRITISK` — `TankestrømPage.tsx:164` lover «lim inn tekst» men ingen `<textarea>` er implementert. Tekst-paste-funksjonen er et brutt løfte.
- `ALVORLIG` — Ingen forklaring på hva Tankestrøm er eller hvordan det fungerer. Ingen «Slik gjør du det»-tekst.
- `ALVORLIG` — Hvem hendelsene er tilknyttet er knapt synlig (bare en tynn fargekant — `borderLeftColor: personColor`). Marte vet ikke hvem hendelsene er for.

---

### S7 — Invitere et familiemedlem (Erik)

**Steg:** «Mer» → «Familie» → «Legg til person» → Wizard Steg 1: navn + farge → «Neste» → Steg 2: arbeidstid (hva er dette?) → «Neste» → Steg 3: «Generer invitasjonslenke» → kopierer lenke → sender til Erik via SMS. **6 navigasjonstrinn fra kalendervisning.**

**Friksjon:**
- `KRITISK` — Invitasjonsflyten er 4+ nivåer dypt begravet (`MerScreen` → `FamilieScreen` → `PersonWizard` → Step 3). Ingen snarvei for «Inviter partner».
- `ALVORLIG` — Ingen forklaring i Steg 2 på hva «Arbeidstid» gjør eller om det er obligatorisk.
- `ALVORLIG` — Ingen «Inviter partner»-prompt for nye brukere uten koblet partner.

---

### S8 — Redigere en eksisterende hendelse

**Steg:** Trykker hendelse i tidslinje → `EventDetailSheet` glir opp → «Rediger» → `EditEventSheet` → endrer tittel → «Lagre».

**Friksjon:**
- `MINOR` — For gjentakende hendelser: valget «Bare denne» vs «Alle» i serien er funksjonelt korrekt, men ordlyden er ikke umiddelbart tydelig for ikke-tekniske brukere.

---

### S9 — Navigere fra måneds- til dagvisning

**Steg:** Trykker «Måned» i bunnavigasjon → månedsgrid med hendelsesprikker → trykker en dato (f.eks. 15. juni) → datoen **markeres i gridet, hendelsessammendrag vises under** → **ingenting skjer med «I dag»-fanen** → Marte forventer å se full dagvisning → ingenting skjer.

**Friksjon:**
- `KRITISK` — I `App.tsx:574` er `onSelectDate` bare `setSelectedDate(date)` — ingen tab-bytte. Brukeren forventer å «zoome inn» på dagen, men det skjer ikke. De må manuelt trykke «I dag» i bunnavigasjonen som et ekstra steg.
- `MINOR` — Agenda-visning under gridet er nyttig men skjules av grid-høyde på en 6-raders måned.

---

### S10 — Søke etter en spesifikk hendelse

**Steg:** Trykker forstørrelsesglassikonet i «I dag»-headeren → søkefelt åpnes → skriver «tannlege» → **«Ingen treff denne uken»** — tannlegeavtalen er 3 uker frem i tid.

**Friksjon:**
- `KRITISK` — `SearchBar.tsx:43–54` søker KUN i `weekLayoutData` (inneværende uke). Ingen advarsel om begrensningen. Brukeren tror søk er ødelagt.
- `ALVORLIG` — Søkefeltet finnes kun på «I dag»-fanen, ikke i måneds- eller gjøremålsvisning.

---

### S11 — Endre synlighet per familiemedlem i filteret

**Steg:** Ser filtrerings-chips i `CalendarHomeTab`-header → trykker «Emma» → Emmas hendelser skjules ✅ → trykker «Alle» → alt vises ✅.

**Friksjon:**
- `MINOR` — `FamilyFilterBar.tsx:33` (tom tilstand) sier «Gå til **Innstillinger** for å legge til foreldre og barn» — feil sti. Riktig er «Mer → Familie».
- `MINOR` — Filtervalg persisteres ikke mellom sesjoner. Sofie (Persona 3) opplever dette som et kritisk problem.

---

### S12 — Bytte mellom Dag og Uke visning

**Steg:** Ser liten «Dag | Uke»-toggle i CalendarHomeTab-header ROW 4 → trykker «Uke» → ser `WeeklyList` → trykker «Dag» for å gå tilbake.

**Friksjon:**
- `MINOR` — Toggle er liten (caption-størrelse) og befinner seg i en hektisk header-rad. Lett å overse.
- `MINOR` — «Uke»-visningen er en listoversikt, ikke en 7-dagers tidslinje. Noen brukere forventer Google-kalender-stil ukevisning.

---

### S13 — Finne og endre varslingsinnstillinger

**Steg:** «Mer» → «Innstillinger» → seksjonen «Varsler» → «Skru på påminnelser» → nettleserdialog → godkjenner → «Varsler er skrudd på» ✅.

**Men:** Marte vil sette standard varslingstid (f.eks. 15 min på alle hendelser):

**Friksjon:**
- `ALVORLIG` — Ingen global standard varslingstid. Individuelle påminnelser settes kun per hendelse under «Mer»-disclosure i AddEventSheet. Dette finner de fleste aldri.
- `ALVORLIG` — `SettingsScreen.tsx:101`: «Varsler er blokkert. Skru dem på i nettleserens innstillinger.» Ingen veiledning på *hvordan* — spesielt kritisk for Safari iOS og Chrome Android.
- `MINOR` — `HjelpScreen.tsx:43`: «Vis gjennomgang på nytt»-knappen viser en «Kommer snart»-toast — men `SettingsScreen` har en fungerende versjon av samme funksjon. Inkonsistens.

---

### S14 — Logge ut og inn igjen

**Steg:** «Mer» → «Innstillinger» → scroller til bunn → trykker «Logg ut» → **logges umiddelbart ut uten bekreftelse** → `AuthScreen` vises.

**Friksjon:**
- `MAJOR` — `SettingsScreen.tsx:203`: `onClick={() => signOut()}` — ingen bekreftelsesdialog. Et feiltrykk logger brukeren ut umiddelbart.

---

### S15 — Bruke appen med dårlig internett

**Steg:** Dårlig 4G på tog → åpner appen → spinner «Loading…» i 10–20 sekunder → ingen timeout-melding → prøver å legge til hendelse → «Lagrer…» spinner → nettverk feiler → feilmelding: «Kunne ikke lagre hendelsen.»

**Friksjon:**
- `KRITISK` — Ingen offline-deteksjon eller nettverksstatusindikator noe sted i appen. Brukeren tror appen er ødelagt.
- `ALVORLIG` — Feilmeldingen «Kunne ikke lagre hendelsen» mangler handlingsanvisning («Prøv igjen»-knapp, ingen retry-logikk).
- `MINOR` — Skjemadata beholdes i AddEventSheet etter feil — dette er positivt, men det kommuniseres ikke eksplisitt.

---

## PERSONA 2: ERIK (41) — Bli med via invitasjonslenke

### S1 — Registrere seg via invitasjonslenke

**Steg:** Mottar lenke fra Marte → banner: «Du har blitt invitert til en familie» → «Voksen/Barn»-valg, «Voksen» forhåndsvalgt ✅ → fyller ut navn/e-post/passord (ingen familienavn-felt siden han er invitert ✅) → e-postbekreftelse → logger inn → koblet til Martes kalender.

**Friksjon:**
- `ALVORLIG` — Samme problem som Marte: ingen tilbakemelding etter e-postverifisering.
- `MINOR` — «Voksen»/«Barn» i invitasjonsskjermen vs «Forelder»/«Barn» i PersonWizard-en er inkonsistent terminologi.

### S7 — Invitere et familiemedlem

Erik er «invitert forelder» (`canManageFamilyMembers = false`). Ingen «Legg til person»-knapp vises.

**Friksjon:**
- `ALVORLIG` — Ingen melding om *hvorfor* Erik ikke kan invitere. FamilieScreen viser bare en tom liste uten forklaring på manglende rettigheter. Erik tror appen er feil.

### S14 — Logge ut og inn igjen
Identisk problem som Marte — ingen bekreftelsesdialog.

---

## PERSONA 3: SOFIE (16) — Teknisk kyndig, vil kun se sin kalender

### S1 — Første gang åpne appen

**Steg:** Registrerer seg uten problemer → `FamilySetupScreen` vises: «Legg til første barn» → **Sofie ER barnet** → forstår ikke skjermens formål → trykker «Hopp over for nå».

**Friksjon:**
- `KRITISK` — `FamilySetupScreen` antar at brukeren er forelder. En tenåring som registrerer seg alene havner i en foreldreoppsettsskjerm.

### S11 — Filtere på seg selv

**Steg:** Trykker sitt eget navn i filteret → ser kun sine hendelser ✅ → lukker appen → åpner neste dag → **filteret er nullstilt til «Alle»**.

**Friksjon:**
- `ALVORLIG` — `selectedPersonIds` er in-memory state med ingen persistering. Sofie re-filtrerer ved hvert besøk.

### S6 — Tankestrøm-import

Sofie er tech-savvy og finner funksjonen raskt. Men hun ønsker bare å *se* kalenderen — ikke importere.

**Friksjon:**
- `MINOR` — Ingen «les-kun»-modus. Sofie kan ved uhell slette familiens hendelser.

---

## PERSONA 4: THOMAS (45) — Enslig far, bruker appen alene

### S3 — Gjentakende ukentlig hendelse

Thomas setter opp «Fotball» for Jonas. Samme utfordringer som Marte (gjentakelse skjult, sluttdato uklar). Greier det til slutt.

### S7 — Invitere «familiemedlem» (bestemor)

**Steg:** Vil at bestemor Ingrid skal se kalenderen → «Legg til person» → wizard steg 1 → velger «Forelder» for bestemor (ingen annet alternativ).

**Friksjon:**
- `ALVORLIG` — Ingen «Observatør»/«Gjest»-rolle. Ingrid legges til som «Forelder» og får full redigeringstilgang i hele familiekalenderen.

### S10 — Søke etter hendelse

Thomas søker etter «Legerunde Jonas» — samme uke-begrensning som alle andre. Finner ikke hendelsen.

### S15 — Dårlig internett

Thomas er alene — ingen partner å koordinere med. Men samme offline-problematikk som øvrige personas.

---

## PERSONA 5: BESTEMOR INGRID (67) — Ikke teknisk, invitert til å se familiekalenderen

### S1 — Registrere seg via invitasjonslenke

**Steg:** Mottar lenke → «Voksen/Barn»-valg, forstår ikke (hun er bestemor, ikke forelder) → leter etter «Opprett konto» → ser den lille tekstlenken → fyller ut skjema med hjelp → e-postbekreftelse → **tilbake til appen uten bekreftelse** → prøver å logge inn → lykkes → Martes kalender.

**Friksjon:**
- `KRITISK` — Registreringsflyt er ikke utformet for ikke-tekniske brukere. Ingen steg-for-steg-veiledning, ingen inngangsillustrasjon, ingen tooltips.
- `ALVORLIG` — «Ny bruker? Opprett konto» er en tekstlenke, ikke en knapp. For brukere med dårlig syn eller lav digital erfaring er dette nesten usynlig.

### S9 — Navigere fra måneds- til dagvisning

**Steg:** Trykker «Måned» → ser månedsgrid → trykker en dato → **ingenting skjer med dagvisningen** → prøver igjen → klikker rundt → gir opp.

**Friksjon:**
- `KRITISK` — Blindvei. Ingrid forstår ikke at hun må trykke «I dag» i bunnavigasjonen separat.

### S10 — Søke etter hendelse

**Steg:** Finner søk-ikonet (etter litt leting) → søker «bursdag» → «Ingen treff denne uken» → bursdagen er neste måned.

**Friksjon:**
- `KRITISK` — Søk er ubrukelig for Ingrids typiske brukscase (se fremtidige hendelser). Appen kommuniserer ikke begrensningen.

### S13 — Finne og endre varslingsinnstillinger

**Steg:** «Mer» → «Innstillinger» → «Skru på påminnelser» → nettleserdialog → Ingrid trykker «Ikke tillat» av usikkerhet → teksten: «Varsler er blokkert. Skru dem på i nettleserens innstillinger.»

**Friksjon:**
- `KRITISK` — Ingen forklaring på *hva* «nettleserens innstillinger» betyr, *hvor* de finnes, eller *hvordan* man endrer dem for iOS Safari, Android Chrome eller Firefox. Ingrid er fullstendig hjelpeløs.

### S15 — Dårlig internett

**Steg:** Treigt hjemmenett → appen laster i 15+ sekunder → ingen melding → Ingrid tror appen er ødelagt og ringer Thomas.

**Friksjon:**
- `KRITISK` — Ingen nettverksstatusindikator. Spinner uten timeout-melding. `App.tsx:394`-spinnerens tekst «Loading…» er dessuten på engelsk.

---

## DEL 2: TVERRGÅENDE ANALYSE

---

### TOP 10 KRITISKE UX-PROBLEMER (rangert etter brukerimpakt)

---

**#1 — Onboarding er fullstendig deaktivert**
`App.tsx:62` — `const ENABLE_ONBOARDING = false`

`OnboardingTour`-komponenten eksisterer og er gjennomarbeidet, men hardkodet deaktivert. Alle nye brukere — uansett digitalt erfaringsnivå — kastes rett inn i appen uten én eneste forklaring på navigasjon, filtrering, «+»-knapp, Dag/Uke-toggle, Gjøremål-konseptet eller Tankestrøm. Dette er appens absolutt største UX-feil i pre-beta.

**Fix:** Sett `ENABLE_ONBOARDING = true`. Valider at `SHORT_TOUR_STEPS` er à jour med gjeldende UI.

---

**#2 — Søk er begrenset til inneværende uke uten noen advarsel**
`SearchBar.tsx:43–54` — søker kun i `weekLayoutData`

Søkefunksjonen kommuniserer ikke begrensningen sin. «Ingen treff denne uken» er eneste hint. For brukere som søker etter en hendelse neste måned oppleves søk som ødelagt. Selvom funksjonen er korrekt implementert teknisk, er den forventningsmessig katastrofalt dårlig kommunisert.

**Fix:** Legg til forklaring: *«Søk fungerer for inneværende uke. Naviger til riktig uke og søk der.»* Eller: utvid søk til å dekke minimum 4 uker frem/tilbake.

---

**#3 — Måneds-til-dag-navigasjon navigerer ikke**
`App.tsx:574` — `onSelectDate={(date) => { setSelectedDate(date) }}`

Å trykke en dato i månedsgridet forventes å åpne dagvisningen. Det skjer ikke — `navTab` forblir `'month'`. Brukeren ser en markert dato og et hendelsessammendrag under gridet, men ingenting i «I dag»-fanen endres før de manuelt bytter fane.

**Fix:** Endre `onSelectDate` i `App.tsx` til å også kalle `setNavTab('today')` og `setShowListView(false)`.

---

**#4 — Ingen forhåndsvalgt person ved hendelsesoppretting**
`AddEventSheet.tsx:127` — `useState<PersonId[]>(initialPersonId ? [initialPersonId] : [])`

`CalendarHomeTab` kaller `openAddEvent()` uten `mePersonId`. Resultatet: ingen chips er valgt som standard. Brukeren fyller ut tittel, tid og eventuelt notat, trykker «Legg til» — og møter feilmeldingen «Velg minst én person.»

**Fix:** I `CalendarHomeTab.tsx`: send `mePersonId` som `initialPersonId` i `openAddEvent`-kallet.

---

**#5 — «Lim inn tekst» i Tankestrøm er lovet men ikke implementert**
`TankestrømPage.tsx:164` — «PDF, bilde, eller lim inn tekst»

Opplastingssonen nevner tekst-paste som mulighet, men ingen `<textarea>` finnes i komponenten. En av de viktigste brukscasene for norske foreldre (kopiere SMS fra skolen direkte) er et brutt løfte.

**Fix:** Legg til en `<textarea>` under upload-sonen med en «Analyser tekst»-knapp, eller fjern omtalen av tekst-paste.

---

**#6 — Invitasjonsflyten er 4–6 navigasjonstrinn dypt**
`MerScreen.tsx` → `FamilieScreen.tsx` → `PersonWizard` → Step 3

Å invitere en partner krever: Mer → Familie → Legg til person → Steg 1 → Steg 2 → Steg 3. Det er ingen snarvei fra kalendervisningen. For en ny bruker som vil dele med ektefellen er dette en urimelig lang vei.

**Fix:** Legg til en «Inviter partner»-snarvei direkte fra `FamilySetupScreen` (etter barnoppsett) eller som et kontekstuelt banner på kalender for nye brukere uten koblet partner.

---

**#7 — Gjentakelse er skjult bak progressiv avsløring**
`AddEventSheet.tsx:440–452` — «Mer (gjentak, påminnelse, transport)»-knapp

Gjentakelse er en kjernebrukssak for barnefamilier (fotball tirsdager, pianoleksjoner onsdager). Å skjule den bak en disclosure-knapp betyr at mange brukere oppretter hendelser uten gjentakelse og manuelt lager duplikater for hver uke.

**Fix:** Flytt «Gjentakelse» til første nivå i skjemaet som et synlig felt, for eksempel som en dropdown rett under tids-feltet.

---

**#8 — Ingen lesebeskyttet tilgangsrolle**
`FamilieScreen.tsx` — kun `'parent'` og `'child'` roller

Bestemor Ingrid og tenåringen Sofie har begge full redigeringstilgang. Det finnes ingen «Observatør»-rolle. En bestemor som uforvarende sletter alle hendelser i en families kalender er ikke utenkelig.

**Fix:** Legg til en `'observer'`-rolle i `MemberKind`-typen, `usePermissions`-hook og invitasjonsflyten. Observatører kan lese men ikke skrive.

---

**#9 — Utlogging mangler bekreftelsesdialog**
`SettingsScreen.tsx:203` — `onClick={() => signOut()}`

Et feiltrykk nær bunnen av Innstillinger-skjermen logger brukeren ut øyeblikkelig. Å logge inn igjen er en prosess som kan ta flere minutter for ikke-tekniske brukere. Ingen sammenlignbar destruktiv handling i appen mangler bekreftelse (se «Forlat familie»-flyten i linje 80–93 som er korrekt implementert).

**Fix:** Kopier bekreftelsesmønsteret fra `confirmUnlink`-flyten i `SettingsScreen.tsx:80–93`.

---

**#10 — Gammelt app-navn «ForeldrePortalen» i FamilySetupScreen**
`FamilySetupScreen.tsx:78` — «ForeldrePortalen er bygd rundt barna»

Brukeren ser «synka» i innloggingsskjerm og header, men «ForeldrePortalen» i den første onboarding-skjermen. Merkevareinkonsistens som ser uprofesjonelt og konfunderende ut i en pre-beta-kontekst.

**Fix:** Endre til «Synka er bygd rundt barna» eller tilsvarende.

---

### HVILKE PERSONAS ER DÅRLIGST IVARETATT?

**#1 Bestemor Ingrid (67)** — mest underservert av alle.
Rammer: deaktivert onboarding, ødelagt måned→dag-navigasjon, søk ubrukelig for hennes brukscase, offline-situasjoner er uforståelige, blokkerte varsler gir ingen veiledning, og ingen lesebeskyttet tilgangsmodus. Appen er funksjonelt utilgjengelig for brukergruppen.

**#2 Sofie (16)** — teknisk kyndig, men konseptuelt feilpasset.
`FamilySetupScreen` er orientert mot foreldre. Filtervalg persisteres ikke. Ingen «bare meg»-modus. Ingenting stopper henne fra å redigere/slette familiens hendelser.

**#3 Marte (38)** — greier seg med utholdenhet, men den initiale erfaringen er stressende nok til at mange vil avinstallere.

---

### HARDEST OPPDAGBARE FUNKSJONER

1. **Gjentakende hendelser** — Skjult bak «Mer»-disclosure i AddEventSheet (3 trinn).
2. **Invitere familiemedlem** — Begravet 4–5 navigasjonstrinn dypt under «Mer».
3. **Søkefunksjonen** — Lite forstørrelsesglassikon i «I dag»-header, ingen etikettekst.
4. **Tankestrøm** — Fremmed AI-navn, begravet under «Mer»-fanen.
5. **Varsler per hendelse** — Kun synlig i AddEventSheet/EditEventSheet under «Mer»-disclosure.

---

### FLYTENE MED FLEST TRINN (og foreslått forenkling)

| Flyt | Nåværende trinn | Foreslått maks |
|------|----------------|----------------|
| Invitere partner | 6 | 2–3 |
| Sette opp gjentakende hendelse | 5 | 3 |
| Sette varsel per hendelse | 4 | 2 |
| Tankestrøm-import | 5 | 3 |
| Navigere fra måneds- til dagvisning | 2 (manuelt) | 1 (automatisk) |

---

### KOMPONENT-NIVÅ ANBEFALINGER

| Fil | Linje | Problem | Fix |
|-----|-------|---------|-----|
| `App.tsx` | 62 | `ENABLE_ONBOARDING = false` | Sett `true` |
| `App.tsx` | 574 | `onSelectDate` bytter ikke tab | Legg til `setNavTab('today')` |
| `App.tsx` | 396 | «Loading…» på engelsk | Endre til «Laster…» |
| `AddEventSheet.tsx` | 127 | Ingen forhåndsvalgt person | Send `mePersonId` som `initialPersonId` |
| `AddEventSheet.tsx` | 440 | Gjentakelse skjult | Flytt til første skjemanivå |
| `SearchBar.tsx` | 43–54 | Søk kun inneværende uke | Kommuniser begrensning tydelig |
| `FamilySetupScreen.tsx` | 78 | «ForeldrePortalen» | Endre til «Synka» |
| `FamilyFilterBar.tsx` | 33 | Feil sti til innstillinger | Endre til «Mer → Familie» |
| `SettingsScreen.tsx` | 203 | Ingen logg-ut-bekreftelse | Kopier `confirmUnlink`-mønster |
| `SettingsScreen.tsx` | 101 | Blokkert-varsel mangler veiledning | Legg til nettleserspesifikk hjelp |
| `HjelpScreen.tsx` | 43–47 | «Vis gjennomgang» → «Kommer snart» | Koble til `onRestartOnboarding` |
| `TankestrømPage.tsx` | 164 | «Lim inn tekst» ikke implementert | Legg til `<textarea>` eller fjern teksten |

---

*Rapport versjon 1.0 · Synka v0.1.0-beta · Kodebase analysert mai 2026*
