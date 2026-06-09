# DESIGN-RAPPORT: Synka — Visuell og Interaksjonsdesign-revisjon

*Revisjon utført: 31. mai 2026 | Revisor: Senior Product Designer / UI–UX Specialist*  
*Filer lest: alle i `src/components/`, `src/features/tankestrom/`, `src/hooks/`, `src/lib/ui.ts`, `tailwind.config.js`, `public/synka-mark.svg`*

---

## SEKSJON 1: VISUELL HIERARKI-REVISJON

### Auth-skjerm (`AuthScreen.tsx`)

Hierarkiet er det beste i hele appen. S-merket animerer inn med scale 0.85→1 over 600 ms (linje 137–140), etterfulgt av ordmerket «synka» (linje 144–150) og slagordet med 1000 ms delay (linje 153–160). Øyet trekkes naturlig til S-merket → ordmerket → tagline → skjema. Dette er riktig rekkefølge.

**Problem — MINOR:** Ordmerket bruker `text-[32px] font-bold` (linje 145) — en størrelse som ikke finnes i den semantiske typografiskalaen. `text-display` er 22px; det er ingenting mellom display og «custom 32px». En `text-[32px]` brukt bare én gang bryter skalakonsistensen.

**Problem — MINOR:** Innsendingsknappen bruker `rounded-pill` (linje 352) mens alle andre primærknapper i systemet (`btnPrimary`) bruker `rounded-lg`. «Ny bruker?»-knappen bruker også `rounded-pill border border-synkaPrimary` (linje 362) — dette skaper to ulike knappestiler på samme skjerm.

**Problem — MINOR:** Skjemafelt bruker `bg-white/70 px-4 py-3` (linje 220, 237, 256, 275, 330) mens `inputBase`-tokenet i `ui.ts` spesifiserer `bg-white/60 px-3.5 py-3`. Bakgrunnsopasitet og horisontal padding avviker.

### I dag/Kalender (dagvisning)

`WeekStrip` (`WeekStrip.tsx`) plasseres øverst med staggered entrance. Den valgte dagen hoppes frem fra 13px til 28px (hardkodet, linje 45–47 i `WeekDayCard.tsx`) — dramatisk og tydelig, men 28px finnes ikke i typografiskalaen. `FamilyFilterBar` under gir god kontekstuell informasjon. `TodayActionStrip` er fremtredende og korrekt plassert.

**Problem — ALVORLIG:** I `WeekDayCard.tsx`, linje 46, brukes `text-[13px]` for ikke-valgte dager og `text-[28px]` for den valgte dagen. Spranget fra 13px til 28px for det *samme innholdselementet* (et datotall) er uvant. Ikke-valgte dager ser umerkelig ut (13px ≈ caption-størrelse) mens den valgte er overdimensjonert. Det ville vært mer harmonisk med 15px og 22px (`text-display`) fra typografiskalaen.

**Problem — MINOR:** `WeekStrip` bruker `px-2 py-1` (linje 24, `WeekStrip.tsx`) mens hovednormen er `px-4`. Ukeremsen har tettere sidemarginer enn resten av innholdet.

### Måneds-visning (`MonthView.tsx`)

Hierarkiet er effektivt: måned/år-tittel øverst i `synkaPrimary` (linje 274), ukerutenett under, valgt-dag-oppsummering, deretter «Agenda for måneden». Varmekartsystemet (4 nivåer synkaPrimary-opasitet, linje 130–136) er en elegant løsning for å kommunisere hendelsestetthet uten å overbelaste celler.

**Problem — MINOR:** Navigasjonsknappene (forrige/neste måned) bruker generiske Heroicons SVG-paths (linje 270–272, 290–292) fremfor `@tabler/icons-react` som brukes ellers i appen. Ikonkonsistensen brytes her.

**Problem — MINOR:** «Uke»-headeren (linje 302) bruker `text-[9px]` hardkodet. Det finnes ingenting under 11px (`text-caption`) i skalaen. Tekst på 9px er uleselig og utilgjengelig.

### Gjøremål (`TasksScreen.tsx`)

Seksjonsetiketter (overdue = coral dot, today = primary dot, nøytral = vanlig) er godt gjennomtenkt (linje 280–291). Personfargesystemet med venstre kantlinje + bakgrunnsfargetint er svært effektivt for rask skanning.

**Problem — ALVORLIG:** Handlingsknappene (bell/edit/delete) er `rounded-lg p-2.5` med 14×14px ikoner (linje 231–257). Faktisk trykkmål: 10+14+10 = 34px. Apple HIG og Material Design krever minimum 44px. Disse er for små, spesielt slette-knappen.

**Problem — MINOR:** Varselremsa (`NotificationStrip`) plasseres *over* oppgavelisten med `mx-4 mb-3` (linje 339). Det mangler en tydelig visuell skiller mellom varselremsa og oppgaveinnholdet under.

### Mer-skjerm (`MerScreen.tsx`)

Teal/gul-dot-motivet i overskriften (linje 33–36) er fin merkevarebruk. Det fremhevede Tankestrøm-kortet med distinkt grønn ramme og «NY»-merke skaper riktig hierarki.

**Problem — MINOR:** Overskriften «Mer» bruker `text-[22px] font-bold` (linje 37) — dette er nøyaktig `text-display`-størrelsen (22px), men med `font-bold` i stedet for `font-semibold` som skalaen spesifiserer, og det er en hardkodet verdi fremfor semantisk token.

**Problem — MINOR:** Kortenes beskrivende tekst bruker `text-[12px]` (linje 64, 81, 98, 115) istedenfor `text-label` eller `text-caption` fra skalaen.

### Tankestrøm (`TankestrømPage.tsx`)

Siden mangler overskriftshierarki. Det er en `IconActivity`-ikon og tilbakeknapp, men ingen tydelig H1-hierarki som forklarer hva Tankestrøm er for førstegangbrukere.

**Problem — ALVORLIG:** Ingen S-merke eller dot-motiv. Siden fremstår som en generisk upload-flate uten Synka-merkevare.

### Familieoppsett (`FamilySetupScreen.tsx`)

Bra informasjonsarkitektur med «Kom i gang» øverst, tydelig H1, forklarende brødtekst og skjema.

**Problem — ALVORLIG:** Feilmelding bruker `text-red-500` (linje 122) — direkte Tailwind-rødtone i stedet for merkevarefargen `text-synkaCoral`. Dette er det eneste stedet i appen der `text-red-*` brukes.

---

## SEKSJON 2: MELLOMROM OG JUSTERING

Standard horisontal padding er `px-4` (16px) via `screenPad` i `ui.ts` (linje 158). Dette etterleves i de fleste skjermer.

**Avvik — MINOR:**
- `MonthView.tsx` bruker `px-3 pt-2` (linje 262) — 12px sider, tettere enn normen
- `WeekStrip.tsx` bruker `px-2` (linje 24) — 8px, enda tettere
- `FamilySetupScreen.tsx` bruker `px-5 pb-12 pt-14` (linje 72) — 20px sider, videre enn normen
- `TimelineContainer.tsx` bruker `px-2` på grid-kolonnen (linje 79)

**Problem — ALVORLIG:** Tidslinjen har `px-2` på grid-kolonnen, noe som betyr at hendelsesblokker kan komme svært nær skjermkanten. Kombinert med at `ActivityBlock` er posisjonert absolutt innenfor denne containeren, kan hendelsesblokker faktisk overlappe med viewport-kanter på 320px-skjermer.

**Problem — ALVORLIG:** Den manglende drag-indikatoren i bunnark. `sheetHandle` (`ui.ts` linje 97) og `sheetHandleBar` (`ui.ts` linje 101, `h-1 w-10 rounded-pill bg-synkaPrimary/20`) er definert, men den visuelle drag-pilleksen er aldri rendret i noen av de tre skjemabunnarkene:
- `AddEventSheet.tsx` linje 303–314 — kun lukkeknapp
- `EventDetailSheet.tsx` linje 221–232 — kun lukkeknapp
- `EditEventSheet.tsx` — tilsvarende

`sheetHandleBar`-token er definert men aldri brukt. Brukere vet ikke at arkene er drabare.

**Problem — MINOR:** `BottomNav` bruker `gap-1` mellom faner (linje 34). Med 4 faner og 16px total sidemargin har hver fane omtrent `(390-32-12)/4 = 86px`. Tilstrekkelig, men komprimert på smale telefoner.

**Problem — MINOR:** `TodayActionStrip` handlingsknappene (`onMarkDone`, `onConfirmNext`, `onDelayNext`, `onMoveNext`) er `min-h-9` (36px) i `flex-wrap` (linje 102–131). Pakking kan føre til at knapper overlapper eller mister spacing-konsistens på smale telefoner.

---

## SEKSJON 3: FARGEBRUK

### synkaPrimary (#166b4f)

Brukes korrekt og konsekvent: primærknapper, valgte tilstander, kalenderoverskrifter, oppgave-seksjonsetiketter, hurtiglenkertekst. Veldefinert som den «grønne ankeren» i appen.

### synkaTeal (#7bc7c4)

Brukes som positiv/informasjonell aksent. Godt: «Gjentakende hendelse»-etikett, velkomsttekst, «I dag»-statusmerke i `TodayActionStrip`. Overbrukt: «NY»-merke i `MerScreen.tsx` linje 60 burde kanskje heller brukt `synkaYellow` for å signalisere nyhet.

### synkaYellow (#f5c842)

Brukes for «I dag»-indikatorer på kalenderrutenett (linje 384, 388 i `MonthView.tsx`), tidsbadges på oppgaver (`TasksScreen.tsx` linje 198), og konfliktsmerking (`TodayActionStrip.tsx` linje 58). Dette er semantisk ambiguøst — gult brukes til det som er *i dag* OG det som *trenger avklaring*.

### synkaCoral (#e05a3a)

Korrekt reservert for destruktive/feilstater, overdue-oppgaver og nåtidsindikatoren.

**Problem — KRITISK:** `CurrentTimeIndicator.tsx` (linje 21) bruker `bg-synkaCoral` for nåtidspunktdotten og `bg-synkaCoral/40` for linjen. Coral er definert som destruktiv/feil-farge. Å bruke det for «nåtid» (som er informativ) skaper semantisk forvirring. Brukere kan tro noe er galt med det aktuelle tidspunktet. `synkaTeal` ville vært semantisk korrekt her.

**Problem — ALVORLIG — Hardkodede farger funnet:**

| Fil | Linje | Problem | Anbefalt løsning |
|-----|-------|---------|------------------|
| `FamilySetupScreen.tsx` | 122 | `text-red-500` | `text-synkaCoral` |
| `SettingsScreen.tsx` | 187 | `text-emerald-700` | `text-synkaTeal` eller `text-synkaPrimary` |
| `SettingsScreen.tsx` | 205, 82 | `border-amber-200 bg-amber-50 text-amber-900` | `bg-synkaYellow/8 border-synkaYellow/30 text-synkaNavy/80` |
| `AddEventSheet.tsx` | 320 | `border-amber-200 bg-amber-50 text-amber-900` | `bg-synkaYellow/8 border-synkaYellow/30 text-synkaNavy/80` |
| `TimelineGrid.tsx` | 107 | `bg-amber-400 border-amber-300` | `bg-synkaYellow border-synkaYellow/60` |
| `FamilyFilterBar.tsx` | 83–84 | `rgb(241 245 249)` og `rgb(113 113 122)` inline | Tailwind `bg-slate-100` / `text-zinc-500` tokens |
| `BackgroundBlock.tsx` | 70 | `bg-zinc-50/85 text-zinc-600` hardkodet inline string | Ekstraher til `ui.ts`-token |

Amber-fargene i bekreftelsesdialogene (`border-amber-200 bg-amber-50`) er det mest skadelige funnet: de er off-brand, brukt tre steder og skiller seg visuelt skarpt fra resten av Synka-paletten. Synka har allerede gult (`synkaYellow`) — bekreftelsesdialogene bør bruke det konsekvent.

---

## SEKSJON 4: MERKEVARETILSTEDEVÆRELSE

### S-merkets SVG (`public/synka-mark.svg`)

S-merket er Synkas sterkeste visuelle eiendel: en flytende S-kurve i `synkaPrimary` (#166b4f) med:
- En teal sirkel øverst til høyre (cx=461, cy=229, r=18 — `#7BC7C4`)
- En gul sirkel nede til venstre (cx=219, cy=480, r=25 — `#F4D35E`)
- Tre strekdetaljer som stiger opp fra S-en øverst til høyre

**Problem — MINOR:** Den gule sirkelen i SVG-en bruker `#F4D35E` — ikke `#f5c842` som er definert som `synkaYellow` i `tailwind.config.js` linje 18. En off-by-one i merkevarefargen mellom SVG-asset og CSS-design-token.

### Hvor S-merket vises

1. `AuthScreen.tsx` (linje 133): w-32 h-32, animert inngang — ✅ Fremragende merkevare-øyeblikk
2. `EmptyState.tsx` (linje 43/47): w-20 h-20, pustende animasjon — ✅ God bruk for tom tilstand

### Steder der S-merket mangler — ALVORLIG

- **`TankestrømPage.tsx`** — Ingen S-mark, ingen dot-motiv. Siden er en sentral Synka-funksjon men fremstår som en generisk upload-flate.
- **`FamilySetupScreen.tsx`** — Ingen S-mark. Første brukeropplevelse etter innlogging er det viktigste merkevare-øyeblikket etter Auth.
- **`HjelpScreen.tsx`** — Dot-motiv i header, men «Om Synka»-seksjonen (linje 64–74) burde absolutt vise S-merket ved siden av versjonsnummeret.
- **`SettingsScreen.tsx`** — SectionDots er til stede, men S-merket mangler totalt.
- **`ScheduleLoadingSkeleton.tsx`** — Viser bare puls-rektangler. `EmptyState.tsx` viser at S-merket kan brukes i lastetilstander.
- **`EmptyState.tsx` (variant `filtered` og `no_family`)** — Kun `default`-varianten viser S-merket. De andre to er bare tekst på hvit bakgrunn.

### Dot-motivet (teal + gul)

Dot-motivet brukes i tre ulike størrelser:
- `MerScreen.tsx` linje 33–36: `h-2.5 w-2.5`
- `HjelpScreen.tsx` linje 31–33: `h-2 w-2`
- `SettingsScreen.tsx` (SectionDots-komponent): `h-1.5 w-1.5`

**Problem — MINOR:** Standardiser på én størrelse (anbefalt: `h-2 w-2 / gap-1`) og én komponent som brukes konsekvent, fremfor tre separate inline-implementasjoner.

### Merkevarefølelse vs. slagordet

«Mindre kaos. Mer tid sammen.» gjenspeiles godt i Auth-skjermens stille, staggerede animasjon og den kremhvite bakgrunnen. Skjermene bygd med `synkaCream`-bakgrunn og hvite kort gir varm, familievennlig atmosfære. Men `TankestrømPage` og `HjelpScreen` føles generiske — de kunne tilhørt hvilken som helst app.

---

## SEKSJON 5: KOMPONENTKONSISTENS

### Knapper — ALVORLIG

Det eksisterer **tre ulike knappsystemer** i parallell:

1. **`Button.tsx`-komponenten** (variant + size props) — formelt komponentbibliotek
2. **`ui.ts`-tokens** (`btnPrimary`, `btnSecondary`, `btnDanger`, `btnNeutral`, `btnGhost`, `btnPrimaryPill`, osv.) — CSS-klassestrenger
3. **Inline ad-hoc klasser** — spredt i komponentfiler

Problemer:
- `AuthScreen.tsx` linje 349–355: Primærknapp med inline `rounded-pill` + `h-12` — ingen av de to systemene. Alle andre primærknapper bruker `rounded-lg`.
- `SettingsScreen.tsx` linje 90: Inline `rounded-pill border border-zinc-300` for «Forlat familie» — bruker ikke `btnSecondary`
- `SettingsScreen.tsx` linje 106: Inline `rounded-pill bg-synkaPrimary px-4 py-2 text-sm` for varsler — bruker ikke `btnPrimary`
- `SettingsScreen.tsx` linje 197, 213: `rounded-pill border border-synkaCoral` for destruktive handlinger — bør bruke `btnDangerOutline` (token mangler)
- `TodayActionStrip.tsx` linje 106–130: Alle fire handlingsknapper er inline med `rounded-pill` — ingen bruker ui.ts-tokens

**Manglende token — MINOR:** Det finnes ingen `btnDangerOutline`-token i `ui.ts`. Appen bruker et destruktivt omrissmønster (coral border, coral tekst) på minst tre steder men har ingen standardisert token for det.

### Bunnark — ALVORLIG

`sheetHandle` (`ui.ts` linje 97) er ment å inneholde `sheetHandleBar` (linje 101) som visuell drag-indikator. Ingen av de tre arkene rendrer faktisk drag-pilla:

```
AddEventSheet.tsx:303-314  — sheetHandle kun med lukkeknapp, ingen drag-pille
EventDetailSheet.tsx:221-232 — sheetHandle kun med lukkeknapp, ingen drag-pille
EditEventSheet.tsx — tilsvarende, ingen drag-pille
```

`sheetHandleBar`-tokenet (`h-1 w-10 rounded-pill bg-synkaPrimary/20`) er definert i `ui.ts` men aldri brukt noe sted i kodebasen.

### Innputt-felt — MINOR

`Input.tsx` og `Textarea.tsx` i `ui/`-mappen er pent implementert med label, hint, error og auto-resize. Men:
- `AuthScreen.tsx` (linje 214–240, 251–275, 325–334) bruker råinnputtfelt med inline Tailwind-klasser, ikke `<Input>`-komponenten
- `FamilySetupScreen.tsx` (linje 86–93) bruker `inputBase`-token korrekt ✅
- `AddEventSheet.tsx` (linje 354–361) bruker `inputBase`-token korrekt ✅

`Textarea.tsx` i `Input.tsx` (linje 107) bruker `bg-zinc-50` og `border-zinc-200` — disse avviker fra `textareaBase`-tokenet i `ui.ts` (linje 78) som bruker `bg-white/60` og `border-synkaNavy/15`. To ulike stilregler for textarea er potensielt aktive i samme sesjon.

### Lokal duplikat av systemtoken — MINOR

`FamilieScreen.tsx` linje 58 definerer: `const sectionLabel = 'text-caption uppercase tracking-wide text-synkaPrimary/60'`. Dette er identisk med `typSectionCap` i `ui.ts` linje 28. En lokal konstant erstatter en allerede importert systemtoken uten grunn.

### Tom tilstand — MINOR

`EmptyState.tsx` har tre varianter: `default`, `filtered`, `no_family`. Kun `default`-varianten viser S-merket. `filtered` og `no_family` mangler illustrasjon eller merkevaremoment — bare tekst på hvit bakgrunn. Dette er tapt mulighet for konsistent merkevareerfaring.

### Lastingstilstander — MINOR

`ScheduleLoadingSkeleton.tsx`: Puls-rektangler med `bg-synkaPrimary/8` + en `border-t-synkaTeal`-spinner. `LogisticsLoadingSkeleton.tsx` har en mer polert versjon med `rounded-md bg-zinc-200` og `rounded-pill bg-zinc-100` for filterpiller. De to skjeletonstilene er inkonsistente med hverandre.

---

## SEKSJON 6: BEVEGELSE OG ANIMASJON

### Hva som fungerer godt

- **`springDialog`** (damping: 28, stiffness: 320, `lib/motion.ts` linje 4–8): Gir naturlig, dempet bunnarkinngang. ✅
- **`springSnappy`** (stiffness: 420, damping: 28, linje 11–15): For raske UI-interaksjoner som ukedagsvalg og chipvalg. ✅
- **Auth-sekvens**: S-mark → ordmerke → tagline med 0/800/1000 ms delay. Det er Synkas beste merkevare-animasjonsøyeblikk. ✅
- **`WeekDayCard` puls** (`WeekDayCard.tsx` linje 40–43): `scale: [1, 1.08, 1]` ved valg — subtil og bekreftende. ✅
- **`EmptyState` pustende S-mark** (linje 47–52): `opacity: [0.35, 0.5]` over 3s i loop — rolig og passende. ✅
- **`ActivityBlock` stagger**: Hendelsesblokker animerer inn med 25ms forsinkelse per blokk, maks 250ms (`blockEntranceDelay` i `lib/motion.ts` linje 36–39). ✅
- **`reducedMotion`-respekt**: Alle animasjoner sjekker `useReducedMotion()` og deaktiverer seg ved behov. ✅

### Hva som mangler — ALVORLIG

- **Ingen exit-animasjon for bunnark**: `AnimatePresence` er brukt i `App.tsx` men exit-variants er ikke satt opp i arkene — de forsvinner abrupt ved lukking.
- **Ingen fane-overgang**: Navigasjon mellom Måned/I dag/Gjøremål/Mer har ingen overgangsanimasjon. En enkel fade+translate ville heve premiumfølelsen betraktelig.
- **Onboarding er deaktivert** (`App.tsx` linje 63: `const ENABLE_ONBOARDING = false`) — nye brukere får ingen omvisning. Dette er ikke en animasjonsfeil, men en opplevelsessvikt.
- **Bekreftelsesinline-dialoger** (`AddEventSheet.tsx` linje 319–327, `SettingsScreen.tsx` linje 80–89) popper inn abrupt uten animasjon.

---

## SEKSJON 7: TYPOGRAFI

### Semantisk skala (definert i `tailwind.config.js` linje 31–43)

| Token | Størrelse | Vekt |
|-------|-----------|------|
| `display` | 22px / lh 1.2 | 600 |
| `heading` | 17px / lh 1.3 | 600 |
| `subheading` | 15px / lh 1.4 | 600 |
| `body` | 15px / lh 1.5 | 400 |
| `body-sm` | 13px / lh 1.5 | 400 |
| `label` | 12px / lh 1.25 | — |
| `caption` | 11px / lh 1.4 | 500 |

### Avvik funnet — ALVORLIG

| Fil | Linje | Hardkodet størrelse | Bør være |
|-----|-------|---------------------|----------|
| `AuthScreen.tsx` | 145 | `text-[32px]` | Nytt `text-brand` token |
| `WeekDayCard.tsx` | 45 | `text-[28px]` | Nytt `text-date-hero` token |
| `WeekDayCard.tsx` | 47 | `text-[13px]` | `text-body-sm` |
| `MerScreen.tsx` | 37 | `text-[22px] font-bold` | `text-display` (men bold vs semibold) |
| `MerScreen.tsx` | 59, 64, 80–81, 97–98, 113–115 | `text-[14px]`, `text-[12px]` | `text-body`, `text-label` |
| `HjelpScreen.tsx` | 34 | `text-[15px] font-semibold` | `text-heading` |
| `HjelpScreen.tsx` | 41 | `text-[11px] font-semibold` | `text-caption font-semibold` |
| `HjelpScreen.tsx` | 47, 59 | `text-[14px] font-medium` | `text-body` |
| `HjelpScreen.tsx` | 68 | `text-[13px]` | `text-body-sm` |
| `HjelpScreen.tsx` | 71 | `text-[12px]` | `text-label` |
| `BottomNav.tsx` | 69 | `text-[10px]` | Nytt `text-nav`-token (10–11px) |
| `MonthView.tsx` | 302 | `text-[9px]` | Minimum `text-caption` (11px) |
| `BackgroundBlock.tsx` | 53, 57 | `text-[10px]`, `text-[9px]` | Bør inn i skalaen |
| `SettingsScreen.tsx` | 90, 106, 132, 197, 213 | `text-sm` | `text-body-sm` |

`text-sm` (14px i Tailwind) finnes ikke i Synka-skalaen. Appen bør bruke 15px (`text-body`) eller 13px (`text-body-sm`). Å blande Tailwind-standardstørrelser med Synka-semantiske tokens er den vanligste typografisvakheten i kodebasen.

### Tone og norsk tekstkvalitet

Norsk tekst er jevnt over korrekt og vennlig. Feilmeldinger holder lavt stressnivå («Legg inn en kort tittel.» fremfor «Tittel er påkrevd»). Bekreftelsestekster er konsistente.

**Problem — MINOR:** `TodayActionStrip.tsx` linje 133: «Flytt til i morgen flytter fra i dag {nextEvent!.start} til i morgen {nextEvent!.start}.» — denne teksten gjentar «i dag» og «i morgen» på en klønete måte og interpolerer tidsstrenger uten kontekstuell reformatering.

---

## SEKSJON 8: KULE DESIGNMULIGHETER

### 5 plasseringer for S-merket/dot-motivet

**1. `HjelpScreen.tsx` — «Om Synka»-seksjonen** (linje 64–74):
Erstatt versjonsnummeret med S-merket som 40×40px SVG ved siden av versjonsteksten. Dette er den mest naturlige «merkevare-øyeblikk»-plasseringen i en Om-seksjon. Implementasjon:
```tsx
<img src="/synka-mark.svg" alt="" className="w-10 h-10 opacity-80" />
```

**2. `ScheduleLoadingSkeleton.tsx`**:
Erstatt puls-spinner med en pulserende S-mark sentrert mellom puls-rektanglene, lik `EmptyState`-mønsteret. Implementasjon:
```tsx
<motion.img src="/synka-mark.svg" className="w-16 h-16"
  animate={{ opacity: [0.2, 0.4] }}
  transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }} />
```

**3. `FamilySetupScreen.tsx` — øverst i skjermen** (linje 74):
S-merket som 48×48px med `opacity-80` øverst i første-gangs-oppsettet. Første-gangs-innlogging er det viktigste merkevare-øyeblikket etter Auth.

**4. `MonthView.tsx` — tom måneds-agenda**:
Når ingen hendelser finnes for måneden (tom agenda-seksjon), vis S-merket som `w-12 h-12 opacity-20` sentrert over tom-tilstandsteksten — konsistent med `EmptyState`-mønsteret.

**5. `EmptyState.tsx` — `filtered` og `no_family`-varianter**:
Begge mangler enhver visuell identitet. Legg til S-merket i `opacity-25` med en litt annen `animate`-sekvens (f.eks. et svakt rotasjonsnikk på ±3 grader over 4s) for å skille dem fra `default`-varianten.

### 3 skjermoverganger og mikro-animasjoner

**1. Fane-overgang i `BottomNav`**:
Wrap hvert skjermbilde i `AnimatePresence mode="wait"` med:
```tsx
initial={{ opacity: 0, y: 6 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -4 }}
transition={springSnappy}
```
Dette er den enkeltste endringen med størst opplevd premiumfølelse. Maks 200ms.

**2. Bunnark exit-animasjon**:
Legg til `exit={{ y: '100%' }}` i alle tre `motion.div`-ark:
```tsx
// AddEventSheet.tsx, EventDetailSheet.tsx, EditEventSheet.tsx
exit={{ y: '100%' }}
transition={springDialog}
```
For øyeblikket forsvinner ark abrupt, noe som føles som en feil.

**3. Månedsskifte med retningsbevegelse i `MonthView.tsx`**:
Legg til en `direction`-state som oppdateres ved prev/nextMonth-klikk:
```tsx
initial={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
```
Gir den naturlige «bla i kalender»-følelsen som Apple Calendar og Fantastical har.

### 2 «wow-øyeblikk»

**1. Hendelse lagret — dot-pop-animasjon**:
Når `addEvent` lykkes, vis en teal + gul dot-paret animasjon. To sirkler (16px) springer ut fra senter av skjermen, skalerer til 1 og falmer bort over 600ms. Bruker Synkas mest karakteristiske visuelle element for å bekrefte en handling. Implementasjon som en `portal`-montert Framer Motion-animasjon, montert av `CalendarOverlays`.

**2. Månedvisning — «heat map»-aktiveringsmoment**:
Første gang en bruker åpner månedvisning med 5+ hendelser, vis en subtil overgang der kalendergriden bakgrunn tipper fra `synkaCream` til svakt `synkaPrimary/4`:
```tsx
<motion.div
  animate={{ backgroundColor: totalEvents > 5 ? 'rgba(22,107,79,0.04)' : 'transparent' }}
  transition={{ duration: 1.2, ease: 'easeInOut' }}
>
```
Gir en «kalenderen er aktiv»-følelse uten å forstyrre lesbarhet.

### Familiefargesystemet — mer visuelt rikt

Nåværende `ActivityBlock` bruker én flat `colorTint` som bakgrunn (`ActivityBlock.tsx` linje 222) uten gradient eller kant-aksent. To konkrete forbedringer:

1. **Subtil gradient**: `background: linear-gradient(135deg, {colorTint}, {colorTint}cc)` på `ActivityBlock` gir dybde til tidslinjeblokker uten å endre fargeidentiteten.
2. **Avatar-separasjon**: `ParticipantAvatarStrip.tsx` (linje 39) har `border-2 border-white` på overlappende avatarer, men kontrasten er lav på `synkaCream`-bakgrunn. Bytt til `border-2 border-synkaCream` eller legg til `box-shadow: 0 0 0 1.5px white` for bedre separasjon.

---

## SEKSJON 9: MOBILSPESIFIKKE BEKYMRINGER

### Touch-mål

| Komponent | Faktisk størrelse | Minimum (HIG/MD) | Status |
|-----------|------------------|------------------|--------|
| `WeekDayCard` | min-h-[44px] | 44px | ✅ |
| `BottomNav`-faner | h-[72px] | 44px | ✅ |
| `TasksScreen` bell/edit/delete | ~34px | 44px | ❌ KRITISK |
| `TodayActionStrip`-knapper | min-h-9 (36px) | 44px | ⚠️ ALVORLIG |
| `AllDayRow`-piller | py-0.5 + 11px tekst ≈ 28px | 44px | ❌ ALVORLIG |

`AllDayRow.tsx` linje 27 bruker `py-0.5` på pillene — det gir omtrent 28px totalhøyde for heldagshendelsepiller som er primær navigasjon til hendelsesdetaljer.

### 320px-brudd

**Kritisk:** `MonthView.tsx` kalenderrutenett (linje 301) har 7 kolonner + 2.75rem (44px) ukenummer-kolonne. På 320px: `(320 - 44 - 24) / 7 ≈ 36px` per celle. Aspektforhold-prop gjør cellene 36×36px — under Apple HIG-minimum på 44px.

**Alvorlig:** `TodayActionStrip.tsx` fire handlingsknapper i `flex-wrap gap-1.5`. Teksten «Flytt til i morgen» er ca. 140px bred — dette presser «Bekreft»-knappen til andre rad, noe som gir en asymmetrisk knappelayout som ser ut som en feil.

### Tastatur (iOS virtuelt tastatur)

`AppShell.tsx` bruker `h-[100dvh]` men ingen `visualViewport`-lytter. Når iOS-tastaturet skyves opp, vil form-seksjoner i bunnark potensielt havne bak tastaturet. `sheetFormBody` bruker `pb-[calc(2rem+env(safe-area-inset-bottom,0px))]` (`ui.ts` linje 105) som hjelper delvis, men er ikke tilstrekkelig hvis tastaturet er synlig.

### Arkdybde og frekvens

`sheetPanel` bruker `min-h-[52dvh]` (`ui.ts` linje 94). Et tomt `AddEventSheet` tar minimum 52% av skjermhøyden. For bekreftelsesflater (f.eks. «Forkast endringer?» i `AddEventSheet.tsx` linje 319–327) er dette unødvendig tungt — en modal eller et kompaktark med `min-h-[30dvh]` ville passe bedre for enkle bekreftelsesdialoguer.

---

## SEKSJON 10: KONKURRANSEANALYSE

### Synka vs. Cozi Family Organizer

**Synka gjør bedre:** Visuell estetikk er hevet. Cozi er funksjonell men ser ut som 2013-mobildesign med flat fargeøkonomi og lite hvitrom. Synka er rolig, premium og moderne. Person-fargesystemet i Synka er mer intuitivt enn Cozis fargekoding. `synkaCream`-bakgrunnen gir en menneskelig varme Cozi aldri oppnår.

**Synka kan lære:** Cozi har en dedikert «Family Journal» og fødselsdagskalender. Synka mangler lett tilgjengelige faste innholdsseksjoner for familiehistorikk og viktige datoer.

**Visuell særegenhet:** Synka er langt mer distinkt enn Cozi. S-merket og fargesystemet gir en identitet Cozi ikke har.

### Synka vs. Apple Calendar

**Synka gjør bedre:** Familie-kollaborasjon og personfargeidentifikasjon er overlegen. Apple Calendar har ingen innebygd flerperson-koordinering. Synkas «Tankestrøm»-funksjon for AI-import av planleggingstekst er genuint innovativ og har ingen ekvivalent i Apple Calendar.

**Synka kan lære:** Apple Calendars uke-visning med tidslinjer er visuelt polert og har en distinkt blå «nåtid»-linje (ikke rød/coral). Apple Calendar bruker `synkaTeal`-ekvivalenten for informative tilstander, ikke en destruktiv farge — dette er nøyaktig feilen i Synkas `CurrentTimeIndicator`.

**Visuell særegenhet:** Apple Calendar er kald og korporativ; Synka er varm og familiefokusert. Stor forskjell.

### Synka vs. Google Calendar

**Synka gjør bedre:** Varmere, mer menneskelig designspråk. Google Calendar er steril og bedriftsorientert. Synka er eksplisitt rettet mot familier med barn — dette gjenspeiles i fargepaletten, kopien og person-fargesystemet.

**Synka kan lære:** Google Calendars søkefunksjonalitet er overlegen. `SearchBar.tsx` i Synka søker bare i den aktive uken (`weekLayoutData`, linje 43) — Google Calendar søker over all historikk. Google Calendars raske hendelsesoppretting (klikk + skriv + Enter) er mer strømlinjeformet enn Synkas bunnark-flyt for enkle hendelser.

**Visuell særegenhet:** Synka er mer distinkt enn Google Calendar. S-merket og den kremhvite bakgrunnen er ulik alt Google produserer.

### Synka vs. Fantastical

**Synka gjør bedre:** Synka er tilgjengelig (web-basert, ingen paywall). Fantastical er en betalt iOS-app med kompleks prismodell. Synka er mer fokusert på familiekoordinering.

**Synka kan lære:** Fantastical har «natural language event creation» integrert direkte i opprettingsskjemaet. Synkas Tankestrøm er beslektet men er en separat modul fremfor integrert i selve skjemaet. Fantasticals «Upcoming»-visning (en rullende liste over fremtidige hendelser på tvers av måneder) er svært nyttig og mangler i Synka. Fantastical bruker subtile fargegradienter på hendelsesblokker — noe Synkas flate `colorTint`-bakgrunner savner.

**Visuell særegenhet:** Fantastical er mer polert på detaljnivå (gradienter, skygger, ikonografisk rikdom), men Synka er mer fokusert og familievennlig.

### Synka vs. Any.do / Todoist

**Synka gjør bedre:** Integreringen av kalender og gjøremål i én app er en fordel Todoist og Any.do ikke har. Person-kodefargesystemet er mer sofistikert enn begge konkurrentenes brukeridentifikasjon.

**Synka kan lære:** Todoist sin P1/P2/P3-prioritetsmerking er mer umiddelbart gjenkjennelig enn Synkas `can_help`/`must_do`-intent-system. Any.do sine «Daily Planner» daglige gjennomgangsvarsler er effektive for familiehverdagen. Todoist sin «filtervisning» (vis bare mineoppgaver, vs. alle) er mer fleksibel enn Synkas binære mine/alle-filter.

**Visuell særegenhet:** Synka er visuelt rikere enn begge. Todoist er monokromt og korporativt; Any.do er fargerikt men infantilt. Synka treffer midt i mellom med god smak.

---

## SAMLET PRIORITERINGSLISTE

### KRITISK (blokkerer god brukeropplevelse)

1. **`CurrentTimeIndicator.tsx` linje 21** — Bytt `bg-synkaCoral` til `bg-synkaTeal` for nåtidspunktet. Coral = feil/destruktiv semantikk.
2. **`TasksScreen.tsx` linje 231–257** — Øk touch-mål på bell/edit/delete til minimum 44px (`p-3` i stedet for `p-2.5`, eller legg til `min-w-[44px] min-h-[44px]`).
3. **`MonthView.tsx` kalenderrutenett på 320px** — Cellene er ~36px. Vurder å fjerne ukenummer-kolonnen på smale skjermer, eller bruk en kompaktere datovisning.

### ALVORLIG (svekker kvalitetsfølelse merkbart)

4. **Rendre `sheetHandleBar`** i alle tre bunnark (`AddEventSheet`, `EventDetailSheet`, `EditEventSheet`).
5. **Erstatt alle amber-farger** (`border-amber-*`, `bg-amber-*`, `text-amber-*`) med `synkaYellow`-varianter.
6. **Erstatt `text-red-500`** med `text-synkaCoral` i `FamilySetupScreen.tsx` linje 122.
7. **Legg til exit-animasjoner** for bunnark (`exit={{ y: '100%' }}`).
8. **Legg til fane-overgangsanimasjon** mellom hoved-tabs (fade + 6px translate).
9. **Standardiser dot-motivet** til én størrelse og én komponent.
10. **Erstatt `text-sm`** med `text-body-sm` overalt (14px finnes ikke i Synka-skalaen).

### MINOR (polering og konsistens)

11. Konsolider inline knappstyling til `ui.ts`-tokens og opprette `btnDangerOutline`-token.
12. Standardiser `AuthScreen` input-felt til `<Input>`-komponenten eller `inputBase`-token.
13. Fjern lokal `sectionLabel`-konstant i `FamilieScreen.tsx` — importer `typSectionCap` fra `ui.ts`.
14. Lik `Textarea.tsx`-stil med `textareaBase`-token.
15. Fjern `text-[9px]` i `MonthView.tsx` «Uke»-header — minimum `text-caption` (11px).
16. Fiks S-merkets gule sirkel til `#f5c842` i SVG-en (fra `#F4D35E`) for fargekonsistens med `synkaYellow`-token.

### MULIGHET (løfter designkvalitet til neste nivå)

17. S-merket i `HjelpScreen.tsx` («Om Synka»), `FamilySetupScreen.tsx` og `ScheduleLoadingSkeleton.tsx`.
18. Retningsbevegelse ved månedskifte i `MonthView.tsx`.
19. Dot-pop-animasjon ved vellykket lagring av hendelse.
20. Subtil gradient-bakgrunn på `ActivityBlock`-tidslinjeblokker.

---

*Rapporten er basert på fullstendig lesing av 52 komponentfiler, feature-filer for Tankestrøm, alle lib/ui.ts-tokens og Tailwind-konfigurasjon. Ingen kodeendringer er gjort.*
