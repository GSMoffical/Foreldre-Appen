import { describe, it, expect } from 'vitest'
import type { ChildSchoolProfile, SchoolLessonSlot } from '../../types'
import {
  addLessonToProfile,
  defaultLessonMinutesForBand,
  removeLessonFromProfile,
  updateLessonInProfile,
} from '../schoolLessons'

function profile57(lessons: SchoolLessonSlot[]): ChildSchoolProfile {
  return { gradeBand: '5-7', weekdays: { 0: { useSimpleDay: false, lessons } } }
}

describe('schoolLessons', () => {
  describe('defaultLessonMinutesForBand', () => {
    it('45 min på videregående, 60 min ellers', () => {
      expect(defaultLessonMinutesForBand('vg1')).toBe(45)
      expect(defaultLessonMinutesForBand('vg3')).toBe(45)
      expect(defaultLessonMinutesForBand('5-7')).toBe(60)
      expect(defaultLessonMinutesForBand('1-4')).toBe(60)
    })
  })

  describe('updateLessonInProfile', () => {
    it('oppdaterer felt på riktig time uten å røre andre', () => {
      const p = profile57([
        { subjectKey: 'matematikk', start: '08:15', end: '09:00' },
        { subjectKey: 'engelsk', start: '09:15', end: '10:00' },
      ])
      const next = updateLessonInProfile(p, 0, 0, { subjectKey: 'norsk' })
      expect(next.weekdays[0]!.lessons![0]!.subjectKey).toBe('norsk')
      expect(next.weekdays[0]!.lessons![1]!.subjectKey).toBe('engelsk')
      expect(next.weekdays[0]!.lessons![1]!.start).toBe('09:15')
    })

    it('foreslår neste times starttid fra valgt sluttid (flyt-semantikk)', () => {
      const p = profile57([
        { subjectKey: 'matematikk', start: '08:15', end: '09:00' },
        { subjectKey: 'norsk', start: '09:15', end: '10:00' },
      ])
      const next = updateLessonInProfile(p, 0, 0, { end: '09:05' })
      expect(next.weekdays[0]!.lessons![0]!.end).toBe('09:05')
      expect(next.weekdays[0]!.lessons![1]!.start).toBe('09:05')
    })

    it('siste time: endret sluttid påvirker ingen neste', () => {
      const p = profile57([{ subjectKey: 'matematikk', start: '08:15', end: '09:00' }])
      const next = updateLessonInProfile(p, 0, 0, { end: '09:30' })
      expect(next.weekdays[0]!.lessons![0]!.end).toBe('09:30')
      expect(next.weekdays[0]!.lessons).toHaveLength(1)
    })

    it('muterer ikke input-profilen', () => {
      const p = profile57([{ subjectKey: 'matematikk', start: '08:15', end: '09:00' }])
      updateLessonInProfile(p, 0, 0, { subjectKey: 'norsk' })
      expect(p.weekdays[0]!.lessons![0]!.subjectKey).toBe('matematikk')
    })

    it('ugyldig indeks → samme profil-referanse (no-op, ingen onChange-effekt)', () => {
      const p = profile57([{ subjectKey: 'matematikk', start: '08:15', end: '09:00' }])
      expect(updateLessonInProfile(p, 0, 5, { subjectKey: 'norsk' })).toBe(p)
    })

    it('beholder useSimpleDay: false på dagen', () => {
      const p = profile57([{ subjectKey: 'matematikk', start: '08:15', end: '09:00' }])
      const next = updateLessonInProfile(p, 0, 0, { start: '08:00' })
      expect(next.weekdays[0]!.useSimpleDay).toBe(false)
    })
  })

  describe('addLessonToProfile', () => {
    it('legger time sist; start = forrige sluttid, default-fag = trinnets første, +60 min', () => {
      const p = profile57([{ subjectKey: 'matematikk', start: '08:15', end: '09:00' }])
      const next = addLessonToProfile(p, 0)
      const lessons = next.weekdays[0]!.lessons!
      expect(lessons).toHaveLength(2)
      expect(lessons[1]).toEqual({ subjectKey: 'norsk', start: '09:00', end: '10:00' })
    })

    it('tom dag med schoolStart: starter der, +60 min', () => {
      const p: ChildSchoolProfile = {
        gradeBand: '5-7',
        weekdays: { 0: { useSimpleDay: false, schoolStart: '08:30' } },
      }
      const next = addLessonToProfile(p, 0)
      expect(next.weekdays[0]!.lessons![0]!.start).toBe('08:30')
      expect(next.weekdays[0]!.lessons![0]!.end).toBe('09:30')
    })

    it('tom dag uten schoolStart: bruker trinnets standard-gate-start', () => {
      const p: ChildSchoolProfile = { gradeBand: '5-7', weekdays: { 0: { useSimpleDay: false } } }
      const next = addLessonToProfile(p, 0)
      expect(next.weekdays[0]!.lessons![0]!.start).toBe('08:15')
    })

    it('videregående: 45 min varighet', () => {
      const p: ChildSchoolProfile = {
        gradeBand: 'vg1',
        weekdays: { 0: { useSimpleDay: false, lessons: [{ subjectKey: 'norsk', start: '08:15', end: '09:00' }] } },
      }
      const next = addLessonToProfile(p, 0)
      expect(next.weekdays[0]!.lessons![1]!.end).toBe('09:45')
    })
  })

  describe('removeLessonFromProfile', () => {
    it('fjerner time på indeks og beholder resten', () => {
      const p = profile57([
        { subjectKey: 'matematikk', start: '08:15', end: '09:00' },
        { subjectKey: 'norsk', start: '09:15', end: '10:00' },
      ])
      const next = removeLessonFromProfile(p, 0, 0)
      expect(next.weekdays[0]!.lessons).toHaveLength(1)
      expect(next.weekdays[0]!.lessons![0]!.subjectKey).toBe('norsk')
    })

    it('siste time fjernet → lessons undefined, dagen beholder useSimpleDay: false', () => {
      const p = profile57([{ subjectKey: 'matematikk', start: '08:15', end: '09:00' }])
      const next = removeLessonFromProfile(p, 0, 0)
      expect(next.weekdays[0]!.lessons).toBeUndefined()
      expect(next.weekdays[0]!.useSimpleDay).toBe(false)
    })
  })
})
