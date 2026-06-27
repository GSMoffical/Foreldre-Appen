import { describe, expect, it } from 'vitest'
import {
  collapseNotesForDisplay,
  deriveActiveChildClassCode,
  segmentByClass,
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
