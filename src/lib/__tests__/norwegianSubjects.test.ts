import { describe, expect, it } from 'vitest'
import { subjectLabelForKey } from '../../data/norwegianSubjects'

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
