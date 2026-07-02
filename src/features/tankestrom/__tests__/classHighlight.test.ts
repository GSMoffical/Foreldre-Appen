import { describe, expect, it } from 'vitest'
import {
  collapseNotesForDisplay,
  deriveActiveChildClassCode,
  segmentByClass,
  segmentByClassSpans,
  shouldHighlightClasses,
} from '../classHighlight'

describe('segmentByClass', () => {
  it('uthever egen klasse og merker de andre i en blandet linje', () => {
    const text = 'Bokinnlevering: 2STA 13.10, 2STB 10.00, 2STC 10.30, 2STD 11.00'
    const { segments, hasClassCodes } = segmentByClass(text, '2STC')
    expect(hasClassCodes).toBe(true)
    expect(segments.filter((s) => s.kind === 'own').map((s) => s.text)).toEqual(['2STC 10.30'])
    expect(segments.filter((s) => s.kind === 'other').map((s) => s.text)).toEqual([
      '2STA 13.10',
      '2STB 10.00',
      '2STD 11.00',
    ])
    // Ingenting fjernes/legges til — segmentene slått sammen gir input uendret.
    expect(segments.map((s) => s.text).join('')).toBe(text)
  })

  it('tidsrom sluges som ÉN enhet — «2STA 13.10-13.40» dempes helt (Punkt 4A)', () => {
    const text = 'Bokinnlevering: 2STA 13.10-13.40, 2STC 10.30-11.00, 2STF 09.30–10.00'
    const { segments, hasClassCodes } = segmentByClass(text, '2STC')
    expect(hasClassCodes).toBe(true)
    expect(segments.filter((s) => s.kind === 'own').map((s) => s.text)).toEqual(['2STC 10.30-11.00'])
    // Hele tidsrommet (også med «–» en-dash) hører til klasse-enheten:
    expect(segments.filter((s) => s.kind === 'other').map((s) => s.text)).toEqual([
      '2STA 13.10-13.40',
      '2STF 09.30–10.00',
    ])
    // Invarianten holder: segmentene slått sammen gir input uendret.
    expect(segments.map((s) => s.text).join('')).toBe(text)
  })

  it('linje uten klassekoder → hasClassCodes false, én plain-segment', () => {
    const { segments, hasClassCodes } = segmentByClass('Husk gymtøy til fredag', '2STC')
    expect(hasClassCodes).toBe(false)
    expect(segments).toEqual([{ text: 'Husk gymtøy til fredag', kind: 'plain' }])
  })

  it('uten barnets classCode blir alle klassekoder other (ingen own)', () => {
    const { segments, hasClassCodes } = segmentByClass('2STA og 2STB', undefined)
    expect(hasClassCodes).toBe(true)
    expect(segments.some((s) => s.kind === 'own')).toBe(false)
  })

  it('matcher uavhengig av store/små bokstaver og mellomrom i barnets kode', () => {
    expect(segmentByClass('Prøve for 2STC', '2stc').segments.some((s) => s.kind === 'own')).toBe(true)
    expect(segmentByClass('Prøve for 2STC', '2 STC').segments.some((s) => s.kind === 'own')).toBe(true)
  })
})

describe('segmentByClassSpans (variant B — ekte segment-demping)', () => {
  it('demper HELE klasse-segmentet (kode + navn), ikke bare koden', () => {
    const text =
      'Klasseavslutninger utenfor huset, etter avtalt tid med lærer: 2STA Anette og Andreas, 2STB Audun, 2STC Marte og Agnes, 2STD Thomas'
    const { segments, hasClassCodes } = segmentByClassSpans(text, '2STC')
    expect(hasClassCodes).toBe(true)
    // Tekst før første kode er plain:
    expect(segments[0]).toEqual({
      text: 'Klasseavslutninger utenfor huset, etter avtalt tid med lærer: ',
      kind: 'plain',
    })
    // Irrelevante klasser dempes med navn og alt:
    expect(segments.filter((s) => s.kind === 'other').map((s) => s.text)).toEqual([
      '2STA Anette og Andreas, ',
      '2STB Audun, ',
      '2STD Thomas',
    ])
    // Barnets segment er own (inkl. navnene):
    expect(segments.filter((s) => s.kind === 'own').map((s) => s.text)).toEqual([
      '2STC Marte og Agnes, ',
    ])
    expect(segments.map((s) => s.text).join('')).toBe(text)
  })

  it('felles-hale etter punktum + stor bokstav blir plain (over-dempings-vakten)', () => {
    const text = '2STE Gjermund og Øyvind, 2STF Mari. Husk gymtøy til fredag.'
    const { segments } = segmentByClassSpans(text, '2STC')
    expect(segments.filter((s) => s.kind === 'plain').map((s) => s.text)).toEqual([
      ' Husk gymtøy til fredag.',
    ])
    expect(segments.filter((s) => s.kind === 'other').map((s) => s.text)).toEqual([
      '2STE Gjermund og Øyvind, ',
      '2STF Mari.',
    ])
    expect(segments.map((s) => s.text).join('')).toBe(text)
  })

  it('klokkeslett-punktum deler IKKE spanet («13.10» er ikke setningsgrense)', () => {
    const text = 'Bokinnlevering: 2STA 13.10-13.40, 2STB 10.00'
    const { segments } = segmentByClassSpans(text, '2STC')
    expect(segments.filter((s) => s.kind === 'other').map((s) => s.text)).toEqual([
      '2STA 13.10-13.40, ',
      '2STB 10.00',
    ])
    expect(segments.map((s) => s.text).join('')).toBe(text)
  })

  it('bindetekst-gruppe med barnets klasse dempes ALDRI («2STA og 2STC møter i rom 12»)', () => {
    const { segments } = segmentByClassSpans('2STA og 2STC møter i rom 12', '2STC')
    expect(segments).toEqual([{ text: '2STA og 2STC møter i rom 12', kind: 'own' }])
  })

  it('pulje-liste med barnets klasse er én own-gruppe («2STA, 2STC og 2STE»)', () => {
    const { segments } = segmentByClassSpans('Pulje 1: 2STA, 2STC og 2STE i auditoriet', '2STC')
    expect(segments.filter((s) => s.kind === 'own').map((s) => s.text)).toEqual([
      '2STA, 2STC og 2STE i auditoriet',
    ])
    expect(segments.some((s) => s.kind === 'other')).toBe(false)
  })

  it('pulje-liste UTEN barnets klasse dempes som gruppe', () => {
    const { segments } = segmentByClassSpans('Pulje 2: 2STB, 2STD og 2STF på rom 214', '2STC')
    expect(segments.filter((s) => s.kind === 'other').map((s) => s.text)).toEqual([
      '2STB, 2STD og 2STF på rom 214',
    ])
  })

  it('linje uten klassekoder → hasClassCodes false, én plain-segment', () => {
    const { segments, hasClassCodes } = segmentByClassSpans('Husk gymtøy til fredag', '2STC')
    expect(hasClassCodes).toBe(false)
    expect(segments).toEqual([{ text: 'Husk gymtøy til fredag', kind: 'plain' }])
  })

  it('invarianten holder for alle input (join === input)', () => {
    const inputs = [
      'Bokinnlevering: 2STA 13.10, 2STB 10.00, 2STC 10.30',
      '2STA og 2STB kl 13. Alle møter i skolegården.',
      'Prøve for 2STC i morgen; Husk kalkulator.',
    ]
    for (const text of inputs) {
      const { segments } = segmentByClassSpans(text, '2STC')
      expect(segments.map((s) => s.text).join('')).toBe(text)
    }
  })
})

describe('shouldHighlightClasses', () => {
  it('false uten barnets classCode eller uten klassekoder', () => {
    expect(shouldHighlightClasses('2STA, 2STB', undefined)).toBe(false)
    expect(shouldHighlightClasses('Husk gymtøy', '2STC')).toBe(false)
  })
  it('true når barn er satt og linja har klassekoder', () => {
    expect(shouldHighlightClasses('Bokinnlevering 2STA, 2STC', '2STC')).toBe(true)
  })
})

describe('collapseNotesForDisplay', () => {
  it('kollapser linjer/whitespace og dropper «Match debug:» + ledende «fra:»', () => {
    expect(collapseNotesForDisplay('fra: noe\nLinje  1\n\nMatch debug: x\nLinje 2')).toBe(
      'Linje 1 Linje 2',
    )
  })
})

describe('deriveActiveChildClassCode', () => {
  const p = (id: string, classCode?: string) => ({ id, classCode })

  it('nøyaktig én valgt med classCode → den klassen', () => {
    expect(deriveActiveChildClassCode([p('trym'), p('stellan', '2STC')], new Set(['stellan']))).toBe(
      '2STC',
    )
  })

  it('flere valgte med ulike klasser → undefined (gjetter ikke)', () => {
    expect(
      deriveActiveChildClassCode([p('a', '2STC'), p('b', '1IMA')], new Set(['a', 'b'])),
    ).toBeUndefined()
  })

  it('flere valgte med SAMME klasse → den (distinkt)', () => {
    expect(deriveActiveChildClassCode([p('a', '2STC'), p('b', '2STC')], new Set(['a', 'b']))).toBe(
      '2STC',
    )
  })

  it('ingen valgt + nøyaktig ett barn med classCode → fallback til den', () => {
    expect(deriveActiveChildClassCode([p('trym'), p('stellan', '2STC')], new Set())).toBe('2STC')
  })

  it('valgt forelder uten classCode → fallback til familiens ene classCode', () => {
    expect(deriveActiveChildClassCode([p('trym'), p('stellan', '2STC')], new Set(['trym']))).toBe(
      '2STC',
    )
  })

  it('ingen valgt + flere personer med classCode → undefined til man velger', () => {
    expect(deriveActiveChildClassCode([p('a', '2STC'), p('b', '1IMA')], new Set())).toBeUndefined()
  })

  it('ingen classCode noe sted → undefined', () => {
    expect(
      deriveActiveChildClassCode([p('trym'), p('stellan')], new Set(['stellan'])),
    ).toBeUndefined()
  })
})
