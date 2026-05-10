# Sentry og personvern

## Når Sentry er aktiv

- Klienten initialiserer Sentry **kun** hvis **`VITE_SENTRY_DSN`** er satt i build-miljøet.
- **`VITE_SENTRY_ENVIRONMENT`** kan settes for å skille `production`, `staging`, osv. (valgfritt; fallback er typisk Vite-modus).

Uten DSN lastes ikke overvåkning — lokal utvikling og CI-build uten secret er uendret funksjonelt.

## Standardinnstillinger (personvern)

- **`sendDefaultPii`** er **av** — ingen standard sending av personidentifiserende info fra SDK.
- **`beforeSend`** og **`beforeBreadcrumb`** scrubber/reduserer sensitivt innhold i events og breadcrumbs (se implementasjon i `src/lib/sentry.ts`).
- **Session Replay** er **av** (`replaysSessionSampleRate` og `replaysOnErrorSampleRate` satt til 0); replay-integrasjon er ikke aktivert i første versjon. Ved senere aktivering bør `maskAllText` og `blockAllMedia` vurderes strengt.

## Error boundaries

- **App-root**: Sentry `ErrorBoundary` med enkel brukervennlig fallback (ingen stacktrace i UI).
- **Tankestrøm import-preview**: egen grense rundt forhåndsvisningsinnhold slik at render-feil der fanges uten å eksponere tekniske detaljer til brukeren.

## Hva som ikke skal sendes til Sentry

Ikke send eller logg i events/breadcrumbs:

- Rå Tankestrøm-input eller full analyse-response
- Barnenavn, personnavn eller annen unødvendig persondata i `extra`/`context`
- Notater og fritekst fra familiekontekst
- Tokens, API-nøkler, session cookies eller lignende

Implementasjonen skal holde breadcrumbs **korte og tekniske**.

## Tillatte Tankestrøm-breadcrumbs (eksempler)

Kun hendelsesnavn og ikke-personlige metadata, f.eks.:

- `tankestrom_import_opened` (f.eks. kilde: innstillinger vs toast)
- `tankestrom_analysis_started` (f.eks. modus, lengde/antall — ikke innhold)
- `tankestrom_analysis_failed` (f.eks. årsak-kode, ikke full feilmelding med brukerdata)

Ved tvil: mindre data til Sentry.
