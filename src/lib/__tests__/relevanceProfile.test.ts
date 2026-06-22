import { describe, expect, it } from 'vitest'
import { normalizeRelevanceProfile, summarizeRelevanceProfile } from '../relevanceProfile'

describe('normalizeRelevanceProfile', () => {
  it('returnerer undefined for tom/utelatt input', () => {
    expect(normalizeRelevanceProfile(undefined)).toBeUndefined()
    expect(normalizeRelevanceProfile({})).toBeUndefined()
    expect(normalizeRelevanceProfile({ school: { name: '   ' } })).toBeUndefined()
    expect(normalizeRelevanceProfile({ activities: [{ name: '  ' }] })).toBeUndefined()
  })

  it('trimmer og beholder skole/klasse/trinn', () => {
    const out = normalizeRelevanceProfile({
      school: { name: '  Nydalen skole ', classCode: ' 2STC ', grade: ' VG2 ' },
    })
    expect(out).toEqual({ school: { name: 'Nydalen skole', classCode: '2STC', grade: 'VG2' } })
  })

  it('dropper tomme delfelter, beholder de utfylte', () => {
    const out = normalizeRelevanceProfile({ school: { name: '', classCode: '2STC', grade: '' } })
    expect(out).toEqual({ school: { classCode: '2STC' } })
  })

  it('renser aliaser (trim, fjern tomme, dedup case-insensitivt)', () => {
    const out = normalizeRelevanceProfile({
      school: { classCode: '2STC', aliases: [' 2STC ', '2stc', '', 'STC-2'] },
    })
    expect(out?.school?.aliases).toEqual(['2STC', 'STC-2'])
  })

  it('beholder aktiviteter med navn og dropper de uten', () => {
    const out = normalizeRelevanceProfile({
      activities: [
        { type: ' fotball ', name: ' Lørenskog ', groupName: ' Nydalen J2015 ' },
        { name: '   ' },
      ],
    })
    expect(out?.activities).toEqual([
      { type: 'fotball', name: 'Lørenskog', groupName: 'Nydalen J2015' },
    ])
  })

  it('normaliserer aktivitets-aliaser (komma-split, trim, dedup case-insensitivt)', () => {
    const out = normalizeRelevanceProfile({
      activities: [{ name: 'Kor', aliases: ['kor, barnekor', 'KOR', ' sang ', ''] }],
    })
    expect(out?.activities).toEqual([{ name: 'Kor', aliases: ['kor', 'barnekor', 'sang'] }])
  })

  it('returnerer undefined når kun tomme aktiviteter finnes', () => {
    expect(
      normalizeRelevanceProfile({ activities: [{ name: '' }, { name: '  ', type: 'kor' }] })
    ).toBeUndefined()
  })

  it('beholder skole og aktiviteter sammen', () => {
    const out = normalizeRelevanceProfile({
      school: { classCode: '2STC' },
      activities: [{ name: 'Speider', groupName: 'Speidergruppa' }],
    })
    expect(out).toEqual({
      school: { classCode: '2STC' },
      activities: [{ name: 'Speider', groupName: 'Speidergruppa' }],
    })
  })
})

describe('summarizeRelevanceProfile', () => {
  it('returnerer null for tom/utelatt profil', () => {
    expect(summarizeRelevanceProfile(undefined)).toBeNull()
    expect(summarizeRelevanceProfile({})).toBeNull()
    expect(summarizeRelevanceProfile({ school: { name: '   ' } })).toBeNull()
  })

  it('oppsummerer klasse, skole og aktiviteter', () => {
    expect(
      summarizeRelevanceProfile({
        school: { classCode: '2STC', name: 'Nydalen skole' },
        activities: [{ name: 'Kor' }, { name: 'Fotball' }],
      })
    ).toBe('Klasse: 2STC · Skole: Nydalen skole · Aktiviteter: Kor, Fotball')
  })

  it('faller tilbake til trinn når klassekode mangler', () => {
    expect(summarizeRelevanceProfile({ school: { grade: 'VG2' } })).toBe('Trinn: VG2')
  })

  it('oppsummerer kun aktiviteter når skole mangler', () => {
    expect(summarizeRelevanceProfile({ activities: [{ name: 'Speider' }] })).toBe(
      'Aktiviteter: Speider'
    )
  })
})
