import { describe, expect, it } from 'vitest'
import type { ChildSchoolProfile } from '../../types'
import {
  applyLessonConflictChoice,
  detectLessonConflicts,
  lessonFingerprint,
} from '../schoolProfileConflicts'

function profileWithLessons(
  wd: 0 | 1 | 2 | 3 | 4,
  lessons: NonNullable<ChildSchoolProfile['weekdays'][0]>['lessons']
): ChildSchoolProfile {
  return {
    gradeBand: '5-7',
    weekdays: {
      [wd]: { useSimpleDay: false, lessons: lessons! },
    },
  }
}

describe('detectLessonConflicts', () => {
  it('returnerer tom liste når ingen overlap', () => {
    const p = profileWithLessons(1, [
      { subjectKey: 'matematikk', start: '08:15', end: '09:00' },
      { subjectKey: 'norsk', start: '09:15', end: '10:00' },
    ])
    expect(detectLessonConflicts(p)).toEqual([])
  })

  it('oppdager to timer i samme spor (identisk tid)', () => {
    const p = profileWithLessons(1, [
      { subjectKey: 'matematikk', start: '12:25', end: '13:25', customLabel: 'Matte D1' },
      { subjectKey: 'norsk', start: '12:25', end: '13:25', customLabel: 'Norsk D2' },
    ])
    const g = detectLessonConflicts(p)
    expect(g).toHaveLength(1)
    expect(g[0]!.candidates).toHaveLength(2)
    expect(g[0]!.displayStart).toBe('12:25')
    expect(g[0]!.displayEnd).toBe('13:25')
  })

  it('oppdager delvis overlapp', () => {
    const p = profileWithLessons(0, [
      { subjectKey: 'norsk', start: '10:00', end: '11:00' },
      { subjectKey: 'engelsk', start: '10:30', end: '11:30' },
    ])
    const g = detectLessonConflicts(p)
    expect(g).toHaveLength(1)
    expect(g[0]!.displayStart).toBe('10:30')
    expect(g[0]!.displayEnd).toBe('11:00')
  })

  it('samler tre parallelle timer i én gruppe når alle overlapper samme vindu', () => {
    const p = profileWithLessons(1, [
      { subjectKey: 'matematikk', start: '12:25', end: '13:25', customLabel: 'Matte D1' },
      { subjectKey: 'norsk', start: '12:25', end: '13:25', customLabel: 'Norsk D2' },
      { subjectKey: 'engelsk', start: '12:25', end: '13:25', customLabel: 'Engelsk D3' },
    ])
    const g = detectLessonConflicts(p)
    expect(g).toHaveLength(1)
    expect(g[0]!.candidates).toHaveLength(3)
  })

  it('klynger ikke transitive «broer» der ytterpunktene ikke overlapper', () => {
    const p = profileWithLessons(4, [
      { subjectKey: 'norsk', start: '08:00', end: '09:00', customLabel: 'K&H' },
      { subjectKey: 'krle', start: '08:30', end: '10:00' },
      { subjectKey: 'engelsk', start: '09:30', end: '10:30', customLabel: 'Engelsk D2' },
      { subjectKey: 'naturfag', start: '10:00', end: '11:00', customLabel: 'Naturfag D2' },
    ])
    const g = detectLessonConflicts(p)
    expect(g.length).toBeGreaterThanOrEqual(2)
    expect(g.every((x) => x.candidates.length <= 2)).toBe(true)
  })

  it('skiller to separate konflikter samme dag', () => {
    const p = profileWithLessons(2, [
      { subjectKey: 'matematikk', start: '08:00', end: '09:00' },
      { subjectKey: 'norsk', start: '08:30', end: '09:30' },
      { subjectKey: 'krle', start: '12:00', end: '13:00' },
      { subjectKey: 'musikk', start: '12:30', end: '13:30' },
    ])
    const g = detectLessonConflicts(p)
    expect(g).toHaveLength(2)
  })

  it('ignorerer useSimpleDay', () => {
    const p: ChildSchoolProfile = {
      gradeBand: '1-4',
      weekdays: {
        0: { useSimpleDay: true, schoolStart: '08:30', schoolEnd: '14:00' },
      },
    }
    expect(detectLessonConflicts(p)).toEqual([])
  })
})

describe('applyLessonConflictChoice', () => {
  it('beholder kun valgt fag i sloten', () => {
    const before = profileWithLessons(1, [
      { subjectKey: 'matematikk', start: '12:25', end: '13:25', customLabel: 'Matte D1' },
      { subjectKey: 'norsk', start: '12:25', end: '13:25', customLabel: 'Norsk D2' },
      { subjectKey: 'kroppsøving', start: '13:30', end: '14:15' },
    ])
    const groups = detectLessonConflicts(before)
    const after = applyLessonConflictChoice(before, groups[0]!, 1)
    expect(after.weekdays[1]?.lessons).toHaveLength(2)
    expect(after.weekdays[1]?.lessons?.[0]?.subjectKey).toBe('norsk')
    expect(after.weekdays[1]?.lessons?.[1]?.subjectKey).toBe('kroppsøving')
    expect(detectLessonConflicts(after)).toHaveLength(0)
  })

  it('lessonFingerprint skiller customLabel', () => {
    const a = lessonFingerprint({
      subjectKey: 'fremmedspråk',
      start: '10:00',
      end: '11:00',
      customLabel: 'Spansk',
    })
    const b = lessonFingerprint({
      subjectKey: 'fremmedspråk',
      start: '10:00',
      end: '11:00',
      customLabel: 'Tysk',
    })
    expect(a).not.toBe(b)
  })
})
