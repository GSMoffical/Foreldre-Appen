import { describe, expect, it } from 'vitest'
import { normalizeMemberKind } from '../familyApi'

describe('normalizeMemberKind — bevar guest/ukjent uten å telle som barn', () => {
  it('bevarer de tre gyldige DB-verdiene trofast', () => {
    expect(normalizeMemberKind('parent')).toBe('parent')
    expect(normalizeMemberKind('child')).toBe('child')
    expect(normalizeMemberKind('guest')).toBe('guest')
  })

  it('faller trygt til guest (ALDRI child) for null/undefined/tom/ukjent', () => {
    expect(normalizeMemberKind(null)).toBe('guest')
    expect(normalizeMemberKind(undefined)).toBe('guest')
    expect(normalizeMemberKind('')).toBe('guest')
    expect(normalizeMemberKind('bogus')).toBe('guest')
    // Case-sensitiv: DB-en lagrer kun små bokstaver (CHECK-constraint), så 'Parent' er ugyldig.
    expect(normalizeMemberKind('Parent')).toBe('guest')
  })

  it('en gjest/ukjent klassifiseres aldri som barn (regresjonsvern for sole-child-vakta)', () => {
    expect(normalizeMemberKind('guest')).not.toBe('child')
    expect(normalizeMemberKind(null)).not.toBe('child')
  })
})
