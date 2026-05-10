# Agent- og PR-arbeidsflyt

## Grunnprinsipp

- **Ikke jobb direkte på `main`.** Bruk en feature-/chore-branch.
- Flyt som passer repoets regler: **issue → branch → PR → CI → (review) → merge**.

## Branch protection og CI

- **Pull request** før merge er typisk påkrevd.
- **Status checks** (`CI / test`, `CI / build`, `CI / e2e`) skal være grønne der det er konfigurert.
- **Required approvals** er et **repo-instillingsspørsmål** — justeres i GitHub (rulesets / branch protection), ikke i applikasjonskode.

Små, fokuserte endringer gjør review og feilsøking enklere.

## For Cursor / agenter

| Gjør | Ikke gjør |
|------|-----------|
| Les eksisterende kode og mønstre før du endrer | Scope creep og «oppussing» utenfor oppgaven |
| Hold PR-er små og beskrivende | Hardkode secrets, passord eller API-nøkler |
| Følg `.github/pull_request_template.md` | Push direkte til `main` uten avtale |
| Oppdater dokumentasjon kun når det er en del av oppgaven | Commit `.env`, `.env.local` eller lignende |

## Før merge (menneske eller verifisert agent)

- [ ] Les **diff** — kun det som forventes er endret.
- [ ] **CI grønn** på siste commit.
- [ ] Ingen **secrets** eller lokale env-filer i commit.
- [ ] **PR-malen** utfylt (risiko, test, personvern der relevant).
- [ ] Ved Tankestrøm-backend (**Braintrust/eval**, modellvalg, scorers): egen prosess — ikke antatt dekket av Foreldre-app CI alene.

## Issues for agent-oppgaver

Mal finnes under `.github/ISSUE_TEMPLATE/agent-task.md` — bruk den for tydelig scope og akseptansekriterier.
