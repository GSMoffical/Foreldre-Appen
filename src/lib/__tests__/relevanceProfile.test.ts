import { describe, expect, it } from 'vitest'
import { normalizeRelevanceProfile } from '../relevanceProfile'

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
})
