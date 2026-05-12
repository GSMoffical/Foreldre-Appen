/**
 * Regresjonstester for live Tankestrøm-payloads der `segment.notes` mangler / er tom.
 *
 * Bakgrunn: live Tankestrøm-API returnerer ofte strukturerte highlights/notater i
 * `metadata.embeddedSchedule[].dayContent` men setter ikke `notes` på segmentet for
 * non-konditionelle dager (fredag/lørdag i Vårcupen). Dermed har validatoren ingen
 * dagsspesifikk kildetekst å støtte seg på, og kan ikke korrigere LLM-feil som
 * «18:40 Oppmøte» → «Første kamp» eller augmentere manglende «17:45 Oppmøte».
 *
 * Fixen: pass full original importtekst som `globalSourceText`. `vaacupNormalize`
 * ekstraherer dagens seksjon via `extractDaySectionForScheduleValidation` og bygger
 * `sourceTextForValidation` per dag. Vi tester her at de fem dokumenterte
 * invariants slår inn på en live-lignende payload.
 */
import { describe, expect, it } from 'vitest'
import {
  buildPerDaySourceTextForValidation,
  classifyConditionalIntentFromSourceText,
  correctMislabeledHighlightsAgainstSourceText,
  extractDaySectionForScheduleValidation,
} from '../tankestromScheduleDetails'
import { normalizeVaacupDaysFromEmbeddedMetadata } from '../tankestromEval/vaacupNormalize'
import { invariantFailuresForVaacupDays } from '../tankestromEval/fixtureInvariants'
import type { EventMetadata } from '../../types'

const VAACUP_FULL_SOURCE = `Vårcupen 2026 – G12 (eksempeltekst for E2E)

Hei alle sammen,

Her er praktisk info for Vårcupen 12.–14. juni 2026.

Fredag 12. juni
- Oppmøte kl. 17:45 ved kunstgressbanen.
- Første kamp starter 18:40.

Lørdag 13. juni
- Oppmøte før første kamp kl. 08:35.
- Første kamp 09:20.
- Oppmøte før andre kamp 14:25.
- Andre kamp 15:10.

Søndag 14. juni
- Spilleplan er foreløpig og avhenger av hvordan det går fredag og lørdag. Vi melder endelig tid når vi vet mer.

Husk drikkeflaske og skift.

Mvh,
Trener (test)
`

/**
 * Bygger metadata som etterligner det live-payloaden faktisk leverte
 * (basert på tmp/tankestrom-eval/runs/vaacup_original__run-1__seed-56673__live-raw.json).
 *
 * Merk:
 * - `notes` mangler på fredag/lørdag (embeddedScheduleSegmentNotesDerived: false)
 * - LLM har feilmerket 18:40, 08:35/09:20-swap, 15:10
 * - Søndag har conditional notes og ingen tider
 */
function buildLivePayloadVaacupMetadata(): EventMetadata {
  return {
    isArrangementParent: true,
    embeddedSchedule: [
      {
        date: '2026-06-12',
        title: 'Vårcupen – fredag',
        start: '18:40',
        end: null,
        tankestromHighlights: [{ time: '18:40', label: 'Oppmøte', type: 'meeting' }],
      },
      {
        date: '2026-06-13',
        title: 'Vårcupen – lørdag',
        start: '08:35',
        end: null,
        tankestromHighlights: [
          { time: '08:35', label: 'Første kamp', type: 'match' },
          { time: '09:20', label: 'Oppmøte', type: 'meeting' },
          { time: '14:25', label: 'Oppmøte før andre kamp', type: 'meeting' },
          { time: '15:10', label: 'Oppmøte', type: 'meeting' },
        ],
      },
      {
        date: '2026-06-14',
        title: 'Vårcupen – søndag',
        start: null,
        end: null,
        isConditional: true,
        notes:
          'Betinget opplegg — avhengig av resultat eller tid som ikke er endelig.\nSpilleplanen er foreløpig og avhenger av resultatene fredag og lørdag. Endelig tid kommer senere.',
        tankestromHighlights: [],
      },
    ],
  } as unknown as EventMetadata
}

describe('extractDaySectionForScheduleValidation (norske dagoverskrifter)', () => {
  it('plukker fredag-seksjon for 2026-06-12 («Fredag 12. juni»)', () => {
    const section = extractDaySectionForScheduleValidation(VAACUP_FULL_SOURCE, '2026-06-12')
    expect(section).toContain('Oppmøte kl. 17:45')
    expect(section).toContain('Første kamp starter 18:40')
    expect(section).not.toContain('Lørdag 13. juni')
    expect(section).not.toContain('Søndag 14. juni')
  })

  it('plukker lørdag-seksjon for 2026-06-13', () => {
    const section = extractDaySectionForScheduleValidation(VAACUP_FULL_SOURCE, '2026-06-13')
    expect(section).toContain('Oppmøte før første kamp kl. 08:35')
    expect(section).toContain('Første kamp 09:20')
    expect(section).toContain('Andre kamp 15:10')
    expect(section).not.toContain('Fredag 12. juni')
    expect(section).not.toContain('Søndag 14. juni')
  })

  it('plukker søndag-seksjon for 2026-06-14 (uten fredag/lørdag-lekkasje)', () => {
    const section = extractDaySectionForScheduleValidation(VAACUP_FULL_SOURCE, '2026-06-14')
    expect(section).toContain('Spilleplan er foreløpig')
    // Hovedmålet: tider og labels fra fredag/lørdag skal ikke lekke inn på søndag.
    expect(section).not.toContain('Fredag 12. juni')
    expect(section).not.toContain('Lørdag 13. juni')
    expect(section).not.toContain('17:45')
    expect(section).not.toContain('18:40')
    expect(section).not.toContain('08:35')
    expect(section).not.toContain('09:20')
    expect(section).not.toContain('15:10')
    // Sluttsignatur og «Husk»-blokken kan henge på etter siste dagsoverskrift fordi
    // ingen ny dagsoverskrift følger. Det er ufarlig: ingen tider, ingen kamp/oppmøte-
    // klassifisering basert på den teksten kan forurense søndagens highlights.
  })

  it('returnerer tom streng når datoen ikke har dagsoverskrift i teksten', () => {
    const section = extractDaySectionForScheduleValidation(VAACUP_FULL_SOURCE, '2026-06-15')
    expect(section).toBe('')
  })

  it('returnerer tom streng for ugyldig dato', () => {
    expect(extractDaySectionForScheduleValidation(VAACUP_FULL_SOURCE, '')).toBe('')
    expect(extractDaySectionForScheduleValidation(VAACUP_FULL_SOURCE, '2026/06/12')).toBe('')
  })

  it('returnerer tom streng når global tekst er tom', () => {
    expect(extractDaySectionForScheduleValidation('', '2026-06-12')).toBe('')
    expect(extractDaySectionForScheduleValidation(undefined, '2026-06-12')).toBe('')
  })

  it('aksepterer kortform for ukedag («Fre 13. juni»)', () => {
    const txt = `Fre 12. juni\n- Oppmøte 17:45.\nLør 13. juni\n- Første kamp 09:20.`
    const fri = extractDaySectionForScheduleValidation(txt, '2026-06-12')
    expect(fri).toContain('Oppmøte 17:45')
    expect(fri).not.toContain('Første kamp 09:20')
    const sat = extractDaySectionForScheduleValidation(txt, '2026-06-13')
    expect(sat).toContain('Første kamp 09:20')
    expect(sat).not.toContain('Oppmøte 17:45')
  })

  it('aksepterer numerisk månedsformat («12.6.»)', () => {
    const txt = `Fredag 12.6. 2026\n- Oppmøte 17:45.\nLørdag 13.6. 2026\n- Første kamp 09:20.`
    const fri = extractDaySectionForScheduleValidation(txt, '2026-06-12')
    expect(fri).toContain('Oppmøte 17:45')
    const sat = extractDaySectionForScheduleValidation(txt, '2026-06-13')
    expect(sat).toContain('Første kamp 09:20')
  })

  it('returnerer tom streng for dato som ikke matcher noen overskrift', () => {
    // Bruker en helt annen måned for å unngå at «numerisk månedsformat»-fallback
    // tilfeldigvis matcher.
    const txt = `Mandag 5. mars\n- Innledning.`
    expect(extractDaySectionForScheduleValidation(txt, '2026-06-12')).toBe('')
  })
})

describe('buildPerDaySourceTextForValidation', () => {
  it('returnerer kun segmentnotes når global tekst mangler', () => {
    const out = buildPerDaySourceTextForValidation({
      segmentSourceText: 'note A',
      globalSourceText: undefined,
      date: '2026-06-12',
    })
    expect(out).toBe('note A')
  })

  it('returnerer kun dagseksjon når segmentnotes mangler', () => {
    const out = buildPerDaySourceTextForValidation({
      segmentSourceText: undefined,
      globalSourceText: VAACUP_FULL_SOURCE,
      date: '2026-06-12',
    })
    expect(out).toContain('Første kamp starter 18:40')
    expect(out).not.toContain('Lørdag 13. juni')
  })

  it('slår sammen segmentnotes og dagseksjon (notes først)', () => {
    const out = buildPerDaySourceTextForValidation({
      segmentSourceText: 'note A',
      globalSourceText: VAACUP_FULL_SOURCE,
      date: '2026-06-12',
    })
    expect(out).toMatch(/^note A/)
    expect(out).toContain('Første kamp starter 18:40')
  })

  it('returnerer undefined når begge er tomme', () => {
    expect(
      buildPerDaySourceTextForValidation({
        segmentSourceText: '',
        globalSourceText: undefined,
        date: '2026-06-12',
      })
    ).toBeUndefined()
  })
})

describe('normalizeVaacupDaysFromEmbeddedMetadata (live-payload uten segment.notes)', () => {
  it('uten globalSourceText: invariants feiler (regresjonsbevis fra live-eval)', () => {
    const meta = buildLivePayloadVaacupMetadata()
    const days = normalizeVaacupDaysFromEmbeddedMetadata(meta)
    const failures = invariantFailuresForVaacupDays(days)
    expect(failures.length).toBeGreaterThan(0)
    const codes = failures.map((f) => f.code)
    expect(codes).toEqual(
      expect.arrayContaining([
        'fredag_1840_labeled_oppmote',
        'lordag_0920_labeled_oppmote',
        'fredag_missing_1745_oppmote',
        'lordag_1510_labeled_oppmote',
      ])
    )
  })

  it('med globalSourceText: alle Vårcupen-invariants passerer', () => {
    const meta = buildLivePayloadVaacupMetadata()
    const days = normalizeVaacupDaysFromEmbeddedMetadata(meta, { globalSourceText: VAACUP_FULL_SOURCE })
    const failures = invariantFailuresForVaacupDays(days)
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([])

    const fredag = days.find((d) => d.dayKey === 'fredag')!
    const lordag = days.find((d) => d.dayKey === 'lordag')!
    const sondag = days.find((d) => d.dayKey === 'sondag')!

    const friStr = fredag.highlights.map((h) => `${h.time} ${h.label}`)
    expect(friStr).toEqual(expect.arrayContaining([expect.stringMatching(/^17:45 .*Oppm/)]))
    expect(friStr.find((s) => s.startsWith('18:40'))).toMatch(/Første kamp|Kamp/)
    expect(friStr.find((s) => s.startsWith('18:40'))).not.toMatch(/Oppm[oø]te/)

    const lorStr = lordag.highlights.map((h) => `${h.time} ${h.label}`)
    expect(lorStr.find((s) => s.startsWith('08:35'))).toMatch(/Oppm[oø]te/)
    expect(lorStr.find((s) => s.startsWith('09:20'))).toMatch(/Første kamp|Kamp/)
    expect(lorStr.find((s) => s.startsWith('15:10'))).toMatch(/Andre kamp|Kamp/)
    expect(lorStr.find((s) => s.startsWith('15:10'))).not.toMatch(/Oppm[oø]te/)

    expect(sondag.highlights).toEqual([])
    expect(sondag.isConditional).toBe(true)
  })

  it('søndag arver ikke fredag-tider selv om global tekst inneholder 18:40', () => {
    const meta = buildLivePayloadVaacupMetadata()
    // Simuler at LLM ved en feiltakelse har plassert 18:40 på søndag.
    ;(meta.embeddedSchedule as unknown as Array<Record<string, unknown>>)[2]!.tankestromHighlights = [
      { time: '18:40', label: 'Første kamp', type: 'match' },
    ]
    ;(meta.embeddedSchedule as unknown as Array<Record<string, unknown>>)[2]!.isConditional = true
    const days = normalizeVaacupDaysFromEmbeddedMetadata(meta, { globalSourceText: VAACUP_FULL_SOURCE })
    const sondag = days.find((d) => d.dayKey === 'sondag')!
    // Søndagsseksjonen i kilden nevner ikke 18:40 → conditional + ingen eksplisitt tid
    // → highlighten skal droppes av `correctMislabeledHighlightsAgainstSourceText`.
    expect(sondag.highlights).toEqual([])
  })
})

describe('classifyConditionalIntentFromSourceText', () => {
  it('detekterer foreløpig spilleplan', () => {
    expect(
      classifyConditionalIntentFromSourceText(
        'Spilleplanen er foreløpig og avhenger av resultatene fredag og lørdag. Endelig tid kommer senere.'
      )
    ).toBe(true)
  })

  it('detekterer «Endelig tid meldes når mer er kjent»', () => {
    expect(
      classifyConditionalIntentFromSourceText('Endelig tid meldes når mer er kjent')
    ).toBe(true)
  })

  it('detekterer «Sluttspill avhenger av plassering»', () => {
    expect(
      classifyConditionalIntentFromSourceText(
        'Sluttspill avhenger av plassering etter lørdagens kamper. Tidspunkt for eventuell kamp er ikke endelig avklart.'
      )
    ).toBe(true)
  })

  it('returnerer false for vanlig kampdag-tekst', () => {
    expect(
      classifyConditionalIntentFromSourceText(
        'Oppmøte før første kamp kl. 08:35. Første kamp 09:20. Andre kamp 15:10.'
      )
    ).toBe(false)
  })

  it('returnerer false for tom/undef', () => {
    expect(classifyConditionalIntentFromSourceText('')).toBe(false)
    expect(classifyConditionalIntentFromSourceText(undefined)).toBe(false)
  })
})

describe('correctMislabeledHighlightsAgainstSourceText – conditional fra sourceText', () => {
  /**
   * Regresjon for live-run 1 (vaacup_original seed=56673): live-API satt _ikke_
   * `isConditional: true` på søndag, men `seg.notes` sa tydelig at planen er
   * foreløpig. 18:40 ble lekt fra fredag. Validator skal droppe.
   */
  it('dropper kamp-highlight når sourceText klassifiseres som conditional og tiden ikke er nevnt', () => {
    const sourceText =
      'Endelig tid meldes når mer er kjent\n\nSpilleplanen er foreløpig og avhenger av resultatene fredag og lørdag\n\nSøndag 14. juni\n- Spilleplan er foreløpig og avhenger av hvordan det går fredag og lørdag. Vi melder endelig tid når vi vet mer.'
    const res = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '18:40', label: 'Første kamp', type: 'match' }],
      sourceText,
      { isConditionalSegment: false }
    )
    expect(res.highlights).toEqual([])
    expect(res.dropped).toEqual([
      {
        time: '18:40',
        label: 'Første kamp',
        reason: 'tentative_segment_without_explicit_time',
      },
    ])
  })

  it('beholder kamp-highlight når sourceText er conditional men tiden er eksplisitt nevnt', () => {
    const sourceText =
      'Søndag — sluttspill avhenger av plassering. Eventuell kamp kl. 11:15.'
    const res = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '11:15', label: 'Første kamp', type: 'match' }],
      sourceText,
      { isConditionalSegment: false }
    )
    expect(res.highlights).toEqual([{ time: '11:15', label: 'Første kamp', type: 'match' }])
    expect(res.dropped).toEqual([])
  })

  it('beholder oppmøte-highlight på vanlig fredag selv om global tekst nevner «foreløpig» andre steder', () => {
    // Sikrer at fredag-seksjon ikke blir behandlet som conditional av seg selv.
    const fridaySection =
      'Fredag 12. juni\n- Oppmøte kl. 17:45 ved kunstgressbanen.\n- Første kamp starter 18:40.'
    const res = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '17:45', label: 'Oppmøte', type: 'meeting' }],
      fridaySection,
      { isConditionalSegment: false }
    )
    expect(res.highlights).toEqual([{ time: '17:45', label: 'Oppmøte', type: 'meeting' }])
    expect(res.dropped).toEqual([])
  })
})

describe('correctMislabeledHighlightsAgainstSourceText – Høstcupen live-payload (type: "other")', () => {
  // Live-API gjengir ofte highlights som `{ type: 'other', label: 'Oppmøte' }` i stedet
  // for `type: 'meeting'`. Tidligere stoppet `normalizeTextKey` å normalisere 'ø' →
  // 'o', så «Oppmøte» klassifiserte som ukjent og corrector hoppet over dem.

  const HOSTCUP_FULL_SOURCE = `Høstcupen 2026 – J2013 (eksempeltekst for E2E)

Hei alle sammen,

Her er praktisk info for Høstcupen 18.–20. september 2026.

Fredag 18. september
- Oppmøte kl. 17:30 ved bane 2.
- Første kamp starter 18:15.

Lørdag 19. september
- Oppmøte før første kamp kl. 08:20.
- Første kamp kl. 09:00.
- Oppmøte før andre kamp kl. 13:55.
- Andre kamp kl. 14:40.

Søndag 20. september
- Sluttspill avhenger av plassering etter lørdagens kamper.
- Tidspunkt for eventuell kamp er ikke endelig avklart.

Husk / ta med:
- drikkeflaske

Mvh,
Trener (test)
`

  const FREDAY_DATE = '2026-09-18'
  const SATURDAY_DATE = '2026-09-19'

  const buildSourceForDay = (segmentNotes: string | undefined, date: string): string => {
    const merged = buildPerDaySourceTextForValidation({
      segmentSourceText: segmentNotes,
      globalSourceText: HOSTCUP_FULL_SOURCE,
      date,
    })
    return merged ?? ''
  }

  it('fredag: relablerer 18:15 Oppmøte (type other) → Første kamp', () => {
    const source = buildSourceForDay('Sjekk værmelding og kle dere etter været.', FREDAY_DATE)
    const res = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '18:15', label: 'Oppmøte', type: 'other' }],
      source
    )
    expect(res.highlights).toHaveLength(1)
    expect(res.highlights[0]!.label).toMatch(/Første kamp|Kamp/)
    expect(res.highlights[0]!.type).toBe('match')
    expect(res.relabeled).toEqual([{ time: '18:15', from: 'Oppmøte', to: expect.stringMatching(/Første kamp|Kamp/) }])
  })

  it('lørdag: relablerer 09:00 Oppmøte (type other) → Første kamp', () => {
    const source = buildSourceForDay(
      'Laget spiser felles lunsj mellom kampene.\n\nSjekk værmelding og kle dere etter været.',
      SATURDAY_DATE
    )
    const res = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '09:00', label: 'Oppmøte', type: 'other' }],
      source
    )
    expect(res.highlights).toHaveLength(1)
    expect(res.highlights[0]!.label).toMatch(/Første kamp|Kamp/)
    expect(res.highlights[0]!.type).toBe('match')
  })

  it('lørdag: relablerer 14:40 Oppmøte (type other) → Andre kamp', () => {
    const source = buildSourceForDay(
      'Laget spiser felles lunsj mellom kampene.',
      SATURDAY_DATE
    )
    const res = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '14:40', label: 'Oppmøte', type: 'other' }],
      source
    )
    expect(res.highlights).toHaveLength(1)
    expect(res.highlights[0]!.label).toMatch(/Andre kamp|Kamp/)
    expect(res.highlights[0]!.type).toBe('match')
  })

  it('lørdag: dropper 18:15 Første kamp som lekkasje fra fredag (ikke i lørdagsseksjon)', () => {
    const source = buildSourceForDay(
      'Laget spiser felles lunsj mellom kampene.',
      SATURDAY_DATE
    )
    const res = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '18:15', label: 'Første kamp', type: 'other' }],
      source
    )
    expect(res.highlights).toEqual([])
    expect(res.dropped).toEqual([
      {
        time: '18:15',
        label: 'Første kamp',
        reason: 'time_not_in_day_section_with_explicit_times',
      },
    ])
  })

  it('lørdag: beholder legitime oppmøte-highlights 08:20 og 13:55', () => {
    const source = buildSourceForDay(
      'Laget spiser felles lunsj mellom kampene.',
      SATURDAY_DATE
    )
    const res = correctMislabeledHighlightsAgainstSourceText(
      [
        { time: '08:20', label: 'Oppmøte', type: 'meeting' },
        { time: '13:55', label: 'Oppmøte', type: 'meeting' },
      ],
      source
    )
    expect(res.highlights).toEqual([
      { time: '08:20', label: 'Oppmøte', type: 'meeting' },
      { time: '13:55', label: 'Oppmøte', type: 'meeting' },
    ])
    expect(res.dropped).toEqual([])
  })

  it('fredag: beholder legitim 17:30 Oppmøte', () => {
    const source = buildSourceForDay('Sjekk værmelding og kle dere etter været.', FREDAY_DATE)
    const res = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '17:30', label: 'Oppmøte ved bane 2', type: 'meeting' }],
      source
    )
    expect(res.highlights).toEqual([{ time: '17:30', label: 'Oppmøte ved bane 2', type: 'meeting' }])
    expect(res.dropped).toEqual([])
  })

  it('full lørdag-pipeline (Høstcup live-payload-shape) relablerer + dropper riktig', () => {
    const source = buildSourceForDay(
      'Laget spiser felles lunsj mellom kampene.\n\nSjekk værmelding og kle dere etter været.',
      SATURDAY_DATE
    )
    const res = correctMislabeledHighlightsAgainstSourceText(
      [
        { time: '08:20', label: 'Oppmøte før første kamp kl.', type: 'meeting' },
        { time: '09:00', label: 'Oppmøte', type: 'other' },
        { time: '13:55', label: 'Oppmøte før andre kamp kl.', type: 'meeting' },
        { time: '14:40', label: 'Oppmøte', type: 'other' },
        { time: '18:15', label: 'Første kamp', type: 'other' },
      ],
      source
    )
    const byTime = Object.fromEntries(res.highlights.map((h) => [h.time, h]))
    expect(Object.keys(byTime).sort()).toEqual(['08:20', '09:00', '13:55', '14:40'])
    expect(byTime['08:20']!.label).toMatch(/Oppm[øo]te|kamp/i)
    expect(byTime['09:00']!.label).toMatch(/Første kamp|Kamp/)
    expect(byTime['09:00']!.type).toBe('match')
    expect(byTime['13:55']!.label).toMatch(/Oppm[øo]te/)
    expect(byTime['14:40']!.label).toMatch(/Andre kamp|Kamp/)
    expect(byTime['14:40']!.type).toBe('match')
    expect(res.dropped.map((d) => d.time)).toContain('18:15')
  })
})

describe('countDistinctTimesInSourceText (intern – via lekkasje-regelen)', () => {
  it('drop fires bare når dagseksjonen har ≥2 distinkte tider', () => {
    // Bare 1 tid i kilden → drop-regelen slår ikke inn (vi vil ikke falskt droppe
    // legitime tider når dagseksjonen er sparsom).
    // (Bevisst uten conditional-markører for å isolere ≥2-times-terskelen.)
    const sparseSource = 'Mandag 10. juni\n- Treningskamp 11:15.'
    const res = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '18:15', label: 'Første kamp', type: 'other' }],
      sparseSource
    )
    expect(res.highlights).toHaveLength(1)
    expect(res.dropped).toEqual([])
  })

  it('drop fires når kilden har ≥2 distinkte tider og høydepunktet ikke er en av dem', () => {
    const richSource =
      'Lørdag 19. september\n- Oppmøte 08:20.\n- Første kamp 09:00.\n- Andre kamp 14:40.'
    const res = correctMislabeledHighlightsAgainstSourceText(
      [{ time: '18:15', label: 'Første kamp', type: 'other' }],
      richSource
    )
    expect(res.highlights).toEqual([])
    expect(res.dropped).toEqual([
      {
        time: '18:15',
        label: 'Første kamp',
        reason: 'time_not_in_day_section_with_explicit_times',
      },
    ])
  })
})

describe('normalizeVaacupDaysFromEmbeddedMetadata – søndag uten isConditional-flagg', () => {
  it('dropper 18:40 Første kamp på søndag når seg.notes signaliserer foreløpig (LLM glemte flagget)', () => {
    // Reproduserer live-run 1 (seed=56673): søndag har konkret 18:40-highlight,
    // start=18:40, men notes sier «Endelig tid meldes når mer er kjent / Spilleplanen er foreløpig».
    // API-en glemte å sette isConditional: true.
    const meta: EventMetadata = {
      isArrangementParent: true,
      embeddedSchedule: [
        {
          date: '2026-06-12',
          title: 'Vårcupen – fredag',
          start: '17:45',
          end: null,
          tankestromHighlights: [
            { time: '17:45', label: 'Oppmøte ved kunstgressbanen', type: 'meeting' },
            { time: '18:40', label: 'Første kamp starter', type: 'match' },
          ],
        },
        {
          date: '2026-06-13',
          title: 'Vårcupen – lørdag',
          start: '08:35',
          end: null,
          tankestromHighlights: [
            { time: '08:35', label: 'Oppmøte før første kamp', type: 'meeting' },
            { time: '09:20', label: 'Første kamp', type: 'match' },
            { time: '14:25', label: 'Oppmøte', type: 'meeting' },
            { time: '15:10', label: 'Andre kamp', type: 'match' },
          ],
        },
        {
          date: '2026-06-14',
          title: 'Vårcupen – søndag',
          start: '18:40',
          end: null,
          notes:
            'Endelig tid meldes når mer er kjent\n\nSpilleplanen er foreløpig og avhenger av resultatene fredag og lørdag',
          tankestromHighlights: [{ time: '18:40', label: 'Første kamp', type: 'match' }],
        },
      ],
    } as unknown as EventMetadata
    const days = normalizeVaacupDaysFromEmbeddedMetadata(meta, { globalSourceText: VAACUP_FULL_SOURCE })
    const sondag = days.find((d) => d.dayKey === 'sondag')!
    expect(sondag.highlights).toEqual([])
    const failures = invariantFailuresForVaacupDays(days)
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([])
  })
})
