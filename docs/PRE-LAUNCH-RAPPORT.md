# Synka – Pre-Launch Code Review

> Gjennomgang av `src/components/`, `src/features/`, `src/App.tsx`, og `src/lib/ui.ts`.
> Dato: 9. juni 2026. Ingen kodeendringer er gjort.

---

## 1. Dead code og ubrukte komponenter

Følgende filer eksisterer, eksporterer komponenter, men er **aldri importert utenfor sin egen fil**:

### Helt ukoblet (ingen import i codebasen)

| Fil | Hva den gjør |
|-----|-------------|
| `src/components/LogisticsScreen.tsx` | En fullstendig "logistikk"-visning med transportoversikt per person per dag. 517 linjer. Aldri montert noe sted i `App.tsx` eller noen annen fil. |
| `src/components/LogisticsLoadingSkeleton.tsx` | Loading-skjelett for `LogisticsScreen`. Kun importert av den ovennevnte døde filen. |
| `src/components/WeeklyCheckCard.tsx` | Et lite "ukesjekk"-kort som viser antall hendelser og kollisjoner. Ingen imports. |
| `src/components/DailyStatusLine.tsx` | En én-linjes statusvisning med kollisjonstelling og fullførte oppgaver. Ingen imports. |
| `src/components/HeaderSummaryCard.tsx` | Et "neste hendelse"-kort med tid-til-neste-beregning. Ingen imports. |

**Alle fem filene kan slettes.** De representerer en delvis-avsluttet "logistikk"-feature-gren som aldri ble koblet til navigasjonen.

---

## 2. `console.log`/`warn`/`error` som når produksjon

### Ikke-guardede info/warn (bør fjernes eller wrappe i `import.meta.env.DEV`)

| Fil | Linje | Type | Innhold |
|-----|-------|------|---------|
| `src/main.tsx` | 12–16 | `console.info` | Logger `version`, `buildTime` og `gitSha` til konsollen ved **hver sideinnlasting** – avslører intern bygg-metadata til enhver som åpner DevTools. |
| `src/App.tsx` | 252 | `console.warn` | `'[Tankestrom import toast skipped: empty success payload]'` – ingen DEV-guard, vises alltid i produksjon. |
| `src/lib/tankestromApi.ts` | 908 | `console.error` | `'[Tankestrom analyze failed]'` – ikke guardert. |
| `src/lib/tankestromApi.ts` | 999 | `console.error` | `'[Tankestrom analyze] ok:false payload'` – ikke guardert. |
| `src/lib/tankestromApi.ts` | 1036 | `console.warn` | `'[tankestrom text analyze] bundle parse failed'` – ikke guardert. |

### API-feil-logger (pågår i produksjon – vurder om ønsket)

Følgende filer har ubetingede `console.error`-kall i feilhåndteringen. De er ikke debug-logging, men de avslører interne API-prefikser og feildetaljer i produksjonskonsollen:

- `src/lib/eventsApi.ts` – 10+ kall (`[eventsApi] ...`)
- `src/lib/tasksApi.ts` – 5 kall (`[tasksApi] ...`)
- `src/lib/inviteApi.ts` – 7 kall (`[inviteApi] ...`)
- `src/lib/profileApi.ts` – 2 kall (`[profileApi] ...`)
- `src/lib/notificationsApi.ts` – 4 kall (`[notificationsApi] ...`)

Disse er sannsynligvis bevisste (feilinformasjon er nyttig i støtte-scenarier), men bør dokumenteres som et bevisst valg, ikke gjenværende debug-kode.

---

## 3. Hardkodede strenger som bør sentraliseres

### Versjonsnummer ute av sync

```
src/components/HjelpScreen.tsx:9
const APP_VERSION = '0.1.0-beta'
```

Hardkodet konstant som **ikke** bruker `__APP_VERSION__` (injisert av Vite). Når versjonsnummeret oppdateres i `package.json`/`vite.config.ts`, oppdateres ikke "Om Synka"-seksjonen automatisk. Bruk `__APP_VERSION__` direkte.

### E-postadresse

```
src/components/HjelpScreen.tsx:54–57
href="mailto:hjelp@synka.no"
```

Dukker opp én gang – greit nå. Men dersom adressen endres, er det lett å glemme. Bør flyttes til en sentral `src/lib/constants.ts` eller `src/config.ts`.

### localStorage-nøkler uten felles kilde

Fem ulike localStorage-nøkler er definert som streng-literaler spredt utover kodebasen, aldri som en delt konstant:

| Nøkkel | Fil |
|--------|-----|
| `'synka-filter-person-ids'` | `src/features/calendar/CalendarHomeTab.tsx:21` |
| `'synka-first-open'` | `src/features/calendar/CalendarHomeTab.tsx:22` |
| `'synka-invite-banner-dismissed'` | `src/features/calendar/CalendarHomeTab.tsx:23` |
| `'debug_overlay'` | `src/components/DebugOverlay.tsx:29` (inline, ikke engang en konstant) |
| `` `foreldre_notified_${eventId}` `` | `src/lib/notifyPartner.ts:9` (prefiks hardkodet) |

### Fargetoken-inkonsekvens: `brandTeal` vs `synkaTeal`

`brandTeal`, `brandSky` og `brandNavy` brukes i:
- `src/App.tsx` (3 steder – toast-UI og notify-boks)
- `src/features/tankestrom/TankestromImportDialog.tsx` (42 steder)
- `src/features/tasks/components/DayTaskList.tsx` (1 sted)

Resten av appen bruker `synkaTeal`, `synkaNavy`, `synkaCream`, osv. fra designsystemet. `brand*`-navnene er et ikke-migrert resterende navn fra en tidligere periode. Dersom fargeverdiene noen gang avviker, vil det synes. Samle alt under `synka*`-prefiksene.

---

## 4. Ting som ville pinliggjort deg i en demo

### 🚨 Kritisk: "TEST BUILD"-stempel vises i produksjon

**`src/components/BuildFingerprintMarker.tsx`** rendres alltid via **`src/components/AppShell.tsx`** og viser et gult `TEST BUILD · DD.MM.YYYY, HH:MM`-merke nedenfor til høyre på skjermen — synlig for alle brukere.

Filen selv og `AppShell.tsx` har begge `// TODO: remove build fingerprint after deploy verification`-kommentarer. Komponenten er aldri fjernet.

> **Fix:** Slett `BuildFingerprintMarker.tsx`, fjern importen og taggen fra `AppShell.tsx`, fjern `define`-oppføringen i `vite.config.ts`, og fjern `__APP_BUILD_FINGERPRINT__`-deklarasjonen i `vite-env.d.ts`.

---

### 🔴 "Vis gjennomgang på nytt" gjør ingenting

`ENABLE_ONBOARDING = false` er hardkodet øverst i **`src/App.tsx:64`**:

```typescript
/** Set to true to re-enable the onboarding tour. */
const ENABLE_ONBOARDING = false
```

`OnboardingTour` rendres kun når `ENABLE_ONBOARDING && showTour`. Når brukeren trykker "Vis gjennomgang på nytt" i **Innstillinger** (`src/components/SettingsScreen.tsx:125`), kalles `onRestartOnboarding()` i App.tsx som setter `showTour = true` – men turen rendres aldri fordi flagget er `false`. Ingen feilmelding, ingen feedback. Knappen er et stille ikke-op.

---

### 🔴 "Vis gjennomgang på nytt" i Hjelp-skjermen er ekte placeholder

**`src/components/HjelpScreen.tsx:42–47`** – knappen "Vis gjennomgang på nytt" kaller `showComingSoon()`, som kun viser en toast med teksten **"Kommer snart"**. Dette er ærlig, men oppdager enhver bruker umiddelbart.

To steder i appen (Innstillinger og Hjelp) lover altså samme funksjon – begge levererer ingenting.

---

### 🟠 `LogisticsScreen` er ferdigbygd men usynlig

`src/components/LogisticsScreen.tsx` er 517 linjer med fullstendig implementert transportoversikt med "Hvem leverer / henter" per dag. Den er aldri montert i `App.tsx` og finnes ikke i navigasjonen. Enten bør den kobles på (den ser ferdig ut) eller slettes for å unngå forvirring for fremtidige utviklere.

---

### 🟠 `brandTeal`-farger i toast-UI og oppgave-hake ser annerledes ut enn resten

I `src/App.tsx` bruker notify-toasten og tankestrom-toast-knappene `bg-brandTeal` og `border-brandTeal/30`. Resten av appen bruker `synkaTeal`. Dersom disse er forskjellige Tailwind-tokens med ulike verdier (avhengig av tailwind.config), kan toast-UI-en ha en synlig avvikende fargetone fra BottomNav, knapper og andre `synkaTeal`-elementer.

---

### 🟡 `console.info` i `main.tsx` lekker bygg-metadata

Første ting som logges i konsollen er:

```
[Foreldre app version] { version: "0.1.0-beta", buildTime: "...", gitSha: "abc1234..." }
```

Ufiltrert for alle som åpner DevTools. Sett det bak `if (import.meta.env.DEV)`.

---

### 🟡 Onboarding-turen har mojibake i knappeteksten

**`src/components/OnboardingTour.tsx:235`**:
```tsx
{isLast ? 'Ferdig! 🎉' : 'Neste →'}
```
Emojien kan dukke opp som `ðŸŽ‰` i visse miljøer hvis filkodingen håndteres feil i fremtiden. Bytt til en HTML-entity eller behold med eksplisitt UTF-8-BOM-kommentar. (Lavt prioritet siden build nå er grønn, men verd å notere.)

---

## Oppsummering etter prioritet

| # | Prioritet | Problem |
|---|-----------|---------|
| 1 | 🚨 Kritisk | `BuildFingerprintMarker` rendres i produksjon — fjern nå |
| 2 | 🔴 Høy | "Vis gjennomgang" gjør ingenting i Innstillinger (ENABLE_ONBOARDING=false) |
| 3 | 🔴 Høy | "Vis gjennomgang" i Hjelp viser "Kommer snart" |
| 4 | 🟠 Medium | 5 døde komponent-filer (LogisticsScreen m.fl.) |
| 5 | 🟠 Medium | `brandTeal`/`brandNavy`/`brandSky` brukes side om side med `synka*`-tokens |
| 6 | 🟠 Medium | `APP_VERSION` i HjelpScreen er hardkodet og ute av sync med Vite-global |
| 7 | 🟡 Lav | `console.info` i main.tsx lekker bygg-metadata i produksjon |
| 8 | 🟡 Lav | `console.warn` i App.tsx (Tankestrom toast skip) er unguarded |
| 9 | 🟡 Lav | localStorage-nøkler er spredte streng-literaler uten felles konstant-fil |
