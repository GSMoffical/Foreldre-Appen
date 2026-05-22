/**
 * Deterministiske tekstvarianter av Høstcup-e-post for varighets-/tidstester.
 * Samme analyze.json brukes; varianten simulerer oppdatert/rotete kilde-tekst ved review.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type HostcupTextVariant = {
  id: string
  description: string
  text: string
}

function loadBaselineHostcupText(): string {
  return readFileSync(join(process.cwd(), 'fixtures/tankestrom/hostcup_original.txt'), 'utf8')
}

function replaceBlock(
  text: string,
  dayHeader: string,
  nextHeader: string | null,
  newBlock: string
): string {
  const start = text.indexOf(dayHeader)
  if (start < 0) return text
  const end = nextHeader ? text.indexOf(nextHeader, start + dayHeader.length) : text.length
  if (end < 0) return text
  return text.slice(0, start) + newBlock + (nextHeader ? text.slice(end) : '')
}

function buildVariants(): HostcupTextVariant[] {
  const baseline = loadBaselineHostcupText()
  const friHdr = 'Fredag 18. september'
  const lorHdr = 'Lørdag 19. september'
  const sonHdr = 'Søndag 20. september'
  const huskHdr = 'Husk / ta med:'

  const sonConfirmed = `${sonHdr}
- Oppmøte til sluttspill kl. 10:30 ved bane 1.
- Kamp kl. 11:15.

`

  return [
    { id: 'baseline', description: 'Original fixturetekst', text: baseline },
    {
      id: 'fri_kamp_slutt_eksplisitt',
      description: 'Fredag: kamp oppgitt med slutt ca. 19:30',
      text: replaceBlock(
        baseline,
        friHdr,
        lorHdr,
        `${friHdr}
- Oppmøte kl. 17:30 ved bane 2.
- Første kamp 18:15–19:30 (ca.).

`
      ),
    },
    {
      id: 'fri_kun_oppmote_i_tekst',
      description: 'Fredag: kun oppmøte nevnt, ingen kamp-tid',
      text: replaceBlock(
        baseline,
        friHdr,
        lorHdr,
        `${friHdr}
- Oppmøte kl. 17:30 ved bane 2.

`
      ),
    },
    {
      id: 'fri_byttet_rekkefolge',
      description: 'Fredag: kamp før oppmøte i teksten',
      text: replaceBlock(
        baseline,
        friHdr,
        lorHdr,
        `${friHdr}
- Første kamp starter 18:15.
- Oppmøte kl. 17:30 ved bane 2.

`
      ),
    },
    {
      id: 'fri_ekstra_linje_1745',
      description: 'Fredag: feilaktig 17:45 i fredag-seksjon (skal ikke lekke til lørdag)',
      text: replaceBlock(
        baseline,
        friHdr,
        lorHdr,
        `${friHdr}
- Oppmøte kl. 17:45 ved kunstgressbanen.
- Oppmøte kl. 17:30 ved bane 2.
- Første kamp starter 18:15.

`
      ),
    },
    {
      id: 'lor_kun_kamper',
      description: 'Lørdag: kamper uten oppmøte-linjer',
      text: replaceBlock(
        baseline,
        lorHdr,
        sonHdr,
        `${lorHdr}
- Første kamp kl. 09:00.
- Andre kamp kl. 14:40.

`
      ),
    },
    {
      id: 'lor_lunsj_mellom',
      description: 'Lørdag: lunsj-notat mellom kamper (ingen ekstra klokkeslett)',
      text: replaceBlock(
        baseline,
        lorHdr,
        sonHdr,
        `${lorHdr}
- Oppmøte før første kamp kl. 08:20.
- Første kamp kl. 09:00.
- Felles lunsj ca. 12:00–12:45 (ikke kamp).
- Oppmøte før andre kamp kl. 13:55.
- Andre kamp kl. 14:40.

`
      ),
    },
    {
      id: 'lor_feil_0920_kamp',
      description: 'Lørdag: første kamp skrevet 09:20 i tekst (09:00 i JSON)',
      text: replaceBlock(
        baseline,
        lorHdr,
        sonHdr,
        `${lorHdr}
- Oppmøte før første kamp kl. 08:20.
- Første kamp kl. 09:20.
- Oppmøte før andre kamp kl. 13:55.
- Andre kamp kl. 14:40.

`
      ),
    },
    {
      id: 'lor_bred_varighet_i_tekst',
      description: 'Lørdag: «på stadion 08:00–16:00» i tillegg til kamp-tider',
      text: replaceBlock(
        baseline,
        lorHdr,
        sonHdr,
        `${lorHdr}
- Vi er på stadion ca. 08:00–16:00.
- Oppmøte før første kamp kl. 08:20.
- Første kamp kl. 09:00.
- Oppmøte før andre kamp kl. 13:55.
- Andre kamp kl. 14:40.

`
      ),
    },
    {
      id: 'son_bekreftet_program',
      description: 'Søndag: konkrete tider (ikke foreløpig)',
      text: replaceBlock(baseline, sonHdr, huskHdr, sonConfirmed),
    },
    {
      id: 'son_blandet_prelim_og_tid',
      description: 'Søndag: foreløpig + konkret tid (motstrid)',
      text: replaceBlock(
        baseline,
        sonHdr,
        huskHdr,
        `${sonHdr}
- Sluttspill avhenger av plassering etter lørdagens kamper.
- Oppmøte til sluttspill kl. 10:30.
- Kamp kl. 11:15.

`
      ),
    },
    {
      id: 'global_forelopig_kun_sondag',
      description: 'Global «foreløpig» kun i søndag-seksjon (fredag/lørdag uendret)',
      text: baseline,
    },
    {
      id: 'global_forelopig_topp',
      description: '«Foreløpig program» i innledning — skal ikke gjøre fredag conditional',
      text: baseline.replace(
        'Her er praktisk info for Høstcupen 18.–20. september 2026.',
        'Her er foreløpig praktisk info for Høstcupen 18.–20. september 2026. Endelig program kommer.'
      ),
    },
    {
      id: 'minimal_dager',
      description: 'Kun dagsoverskrifter og klokkeslett per linje',
      text: `Høstcupen 2026

${friHdr}
17:30 oppmøte
18:15 kamp

${lorHdr}
08:20
09:00
13:55
14:40

${sonHdr}
foreløpig sluttspill
`,
    },
    {
      id: 'ingen_klokkeslett_sondag',
      description: 'Søndag uten klokkeslett, kun beskrivelse',
      text: replaceBlock(
        baseline,
        sonHdr,
        huskHdr,
        `${sonHdr}
- Sluttspill avhenger av resultater.
- Vi melder tid senere.

`
      ),
    },
    {
      id: 'fri_lor_kompakt',
      description: 'Fredag/lørdag komprimert til én linje per dag',
      text: replaceBlock(
        replaceBlock(
          baseline,
          friHdr,
          lorHdr,
          `${friHdr}
Oppmøte 17:30, kamp 18:15.

`
        ),
        lorHdr,
        sonHdr,
        `${lorHdr}
08:20 / 09:00 / 13:55 / 14:40

`
      ),
    },
    {
      id: 'tom_sondag_seksjon',
      description: 'Søndag-seksjon tom (kun overskrift)',
      text: replaceBlock(baseline, sonHdr, huskHdr, `${sonHdr}

`),
    },
    {
      id: 'lor_siste_kamp_uten_slutt',
      description: 'Lørdag: siste kamp uten oppgitt sluttid i tekst',
      text: replaceBlock(
        baseline,
        lorHdr,
        sonHdr,
        `${lorHdr}
- Oppmøte før første kamp kl. 08:20.
- Første kamp kl. 09:00.
- Oppmøte før andre kamp kl. 13:55.
- Andre kamp starter 14:40.

`
      ),
    },
    {
      id: 'med_frist_8_sept_2100',
      description: 'Frist 8. september kl. 21:00 i innledning (skal ikke bli program-highlight)',
      text: baseline.replace(
        'Hei alle sammen,',
        `Hei alle sammen,

Viktig: svar innen 8. september kl. 21:00 om deltakelse.`
      ),
    },
  ]
}

export const HOSTCUP_TEXT_VARIANTS: HostcupTextVariant[] = buildVariants()

export function hostcupTextVariantById(id: string): HostcupTextVariant | undefined {
  return HOSTCUP_TEXT_VARIANTS.find((v) => v.id === id)
}
