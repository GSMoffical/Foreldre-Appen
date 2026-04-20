import { describe, expect, it } from 'vitest'
import { inferSubjectKeyFromText, subjectLabelForKey } from '../../data/norwegianSubjects'

describe('subjectLabelForKey', () => {
  it('viser katalognavn når customLabel mangler', () => {
    expect(subjectLabelForKey('5-7', 'norsk', undefined)).toBe('Norsk')
  })

  it('setter sammen katalog + kort tillegg (f.eks. utenom)', () => {
    expect(subjectLabelForKey('5-7', 'norsk', 'Utenom')).toBe('Norsk · Utenom')
  })

  it('bevarer full importert streng når den allerede inneholder fagnavnet', () => {
    expect(subjectLabelForKey('5-7', 'norsk', 'Norsk utenom')).toBe('Norsk utenom')
  })

  it('viser bare fritekst for generiske fag (fremmedspråk)', () => {
    expect(subjectLabelForKey('8-10', 'fremmedspråk', 'Spansk')).toBe('Spansk')
  })

  it('viser bare fritekst for valgfag', () => {
    expect(subjectLabelForKey('5-7', 'valgfag', 'Programmering')).toBe('Programmering')
  })
})

describe('inferSubjectKeyFromText', () => {
  it('finner key fra label', () => {
    expect(inferSubjectKeyFromText('5-7', 'Valgfag')).toBe('valgfag')
  })

  it('finner key fra variant av label', () => {
    expect(inferSubjectKeyFromText('5-7', 'kunst og håndverk')).toBe('kunst_håndverk')
  })

  it('returnerer null når teksten ikke er et katalogfag', () => {
    expect(inferSubjectKeyFromText('5-7', 'Norsk utenom')).toBeNull()
  })
})
