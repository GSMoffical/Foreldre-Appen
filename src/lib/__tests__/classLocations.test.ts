import { describe, expect, it } from 'vitest'
import type { Person } from '../../types'
import { buildFamilyClassCodeSet, extractClassLocations } from '../classLocations'

describe('extractClassLocations (read-tid, tolerant)', () => {
  it('leser gyldige entries (classCode påkrevd; room/teacher valgfrie strenger)', () => {
    const out = extractClassLocations({
      classLocations: [
        { classCode: '2STC', room: '332-50', teacher: 'Marte Hermanrud' },
        { classCode: '2STA', room: '332-40' },
        { classCode: '2STE' },
      ],
    })
    expect(out).toEqual([
      { classCode: '2STC', room: '332-50', teacher: 'Marte Hermanrud' },
      { classCode: '2STA', room: '332-40' },
      { classCode: '2STE' },
    ])
  })

  it('dropper entries uten gyldig classCode; beholder resten', () => {
    const out = extractClassLocations({
      classLocations: [{ classCode: '' }, { room: '101' }, null, { classCode: '10B' }],
    })
    expect(out).toEqual([{ classCode: '10B' }])
  })

  it('søppel/manglende → [] (aldri throw)', () => {
    expect(extractClassLocations(undefined)).toEqual([])
    expect(extractClassLocations(null)).toEqual([])
    expect(extractClassLocations({})).toEqual([])
    expect(extractClassLocations({ classLocations: 'ikke en liste' })).toEqual([])
    expect(extractClassLocations({ classLocations: 42 })).toEqual([])
    expect(extractClassLocations('flat streng')).toEqual([])
  })

  it('ignorerer room/teacher som ikke er strenger (kontrakt: utelatt, aldri null — men vær tolerant)', () => {
    const out = extractClassLocations({
      classLocations: [{ classCode: '2STC', room: null, teacher: 7 }],
    })
    expect(out).toEqual([{ classCode: '2STC' }])
  })
})

describe('buildFamilyClassCodeSet (flerbarns isPrimary-grunnlag)', () => {
  const child = (id: string, classCode?: string): Person => ({
    id,
    name: id,
    memberKind: 'child',
    colorTint: 'bg-slate-200',
    colorAccent: 'border-slate-400',
    ...(classCode ? { relevanceProfile: { school: { classCode } } } : {}),
  })

  it('samler ALLE barns koder, normalisert («2 STC» → «2stc»)', () => {
    const set = buildFamilyClassCodeSet([
      child('stellan', '2 STC'),
      child('ida', '10B'),
      { ...child('mor'), memberKind: 'parent' } as Person,
    ])
    expect(set).toEqual(new Set(['2stc', '10b']))
  })

  it('barn uten classCode telles ikke; tom familie → tomt sett', () => {
    expect(buildFamilyClassCodeSet([child('uten')])).toEqual(new Set())
    expect(buildFamilyClassCodeSet([])).toEqual(new Set())
  })
})
