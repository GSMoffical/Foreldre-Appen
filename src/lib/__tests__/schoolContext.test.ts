import { describe, expect, it } from 'vitest'
import type { ChildSchoolDayPlan, Event, SchoolContext, SchoolDayOverride } from '../../types'
import {
  MIN_MATCH_SCORE,
  extractSchoolDayOverride,
  matchLessonForSchoolContext,
  normalizeLabel,
  pickSchoolDayOverrideForChild,
  resolveSubjectKey,
  scoreLessonAgainstContext,
} from '../schoolContext'

function plan(lessons: ChildSchoolDayPlan['lessons']): ChildSchoolDayPlan {
  return { useSimpleDay: false, lessons }
}

function ctx(partial: Partial<SchoolContext>): SchoolContext {
  return { itemType: 'note', ...partial }
}

describe('normalizeLabel', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeLabel('Spansk')).toBe('spansk')
    expect(normalizeLabel(' SpÂnsk ')).toBe('spansk')
    expect(normalizeLabel('Kroppsøving')).toBe('kroppsøving')
  })

  it('handles empty / nullish input', () => {
    expect(normalizeLabel(undefined)).toBe('')
    expect(normalizeLabel(null)).toBe('')
    expect(normalizeLabel('')).toBe('')
  })
})

describe('resolveSubjectKey', () => {
  it('maps spansk → fremmedspråk via alias', () => {
    expect(resolveSubjectKey('spansk').subjectKey).toBe('fremmedspråk')
    expect(resolveSubjectKey('Spansk').subjectKey).toBe('fremmedspråk')
  })

  it('maps matte → matematikk', () => {
    expect(resolveSubjectKey('matte').subjectKey).toBe('matematikk')
  })

  it('maps kristendom → krle', () => {
    expect(resolveSubjectKey('kristendom').subjectKey).toBe('krle')
  })

  it('passes through unknown keys as normalized form', () => {
    expect(resolveSubjectKey('matematikk').subjectKey).toBe('matematikk')
    expect(resolveSubjectKey('norsk').subjectKey).toBe('norsk')
  })

  it('returns null for empty input', () => {
    expect(resolveSubjectKey(undefined).subjectKey).toBe(null)
    expect(resolveSubjectKey('').subjectKey).toBe(null)
    expect(resolveSubjectKey('   ').subjectKey).toBe(null)
  })
})

describe('scoreLessonAgainstContext', () => {
  it('rewards subjectKey + customLabel + start together', () => {
    const lesson = {
      subjectKey: 'fremmedspråk',
      customLabel: 'Spansk',
      start: '08:30',
      end: '09:15',
    }
    const s = scoreLessonAgainstContext(lesson, {
      subjectKey: 'fremmedspråk',
      customLabel: 'Spansk',
      lessonStart: '08:30',
    })
    expect(s.score).toBeGreaterThanOrEqual(12) // 5 + 4 + 3
    expect(s.reasons).toContain('subjectKey')
    expect(s.reasons).toContain('customLabel')
    expect(s.reasons).toContain('start')
  })

  it('penalizes ulike customLabels på samme subjectKey', () => {
    const lesson = { subjectKey: 'fremmedspråk', customLabel: 'Spansk', start: '10:00', end: '10:45' }
    const s = scoreLessonAgainstContext(lesson, {
      subjectKey: 'fremmedspråk',
      customLabel: 'Tysk',
    })
    // +5 for subjectKey, −3 for customLabel-mismatch = 2 (< MIN)
    expect(s.score).toBe(2)
    expect(s.reasons).toContain('customLabel-mismatch')
  })
})

describe('matchLessonForSchoolContext', () => {
  const lessonsTypical8_10 = [
    { subjectKey: 'matematikk', start: '08:30', end: '09:15' },
    { subjectKey: 'fremmedspråk', customLabel: 'Spansk', start: '10:00', end: '10:45' },
    { subjectKey: 'krle', start: '11:00', end: '11:45' },
    { subjectKey: 'valgfag', customLabel: 'Programmering', start: '12:30', end: '13:15' },
    { subjectKey: 'kroppsøving', start: '13:30', end: '14:15' },
  ]

  it('scenario 1: spansk → fremmedspråk + Spansk', () => {
    const hit = matchLessonForSchoolContext(
      plan(lessonsTypical8_10),
      ctx({ subjectKey: 'spansk', customLabel: 'Spansk' })
    )
    expect(hit?.customLabel).toBe('Spansk')
  })

  it('scenario 2: fremmedspråk + Tysk skal IKKE treffe Spansk-timen', () => {
    const hit = matchLessonForSchoolContext(
      plan(lessonsTypical8_10),
      ctx({ subjectKey: 'fremmedspråk', customLabel: 'Tysk' })
    )
    expect(hit).toBeNull()
  })

  it('scenario 3: matte → matematikk', () => {
    const hit = matchLessonForSchoolContext(
      plan(lessonsTypical8_10),
      ctx({ subjectKey: 'matte' })
    )
    expect(hit?.subjectKey).toBe('matematikk')
  })

  it('scenario 4: customLabel-only (Programmering) matcher valgfag-timen', () => {
    const hit = matchLessonForSchoolContext(
      plan(lessonsTypical8_10),
      ctx({ customLabel: 'Programmering' })
    )
    expect(hit?.subjectKey).toBe('valgfag')
    expect(hit?.customLabel).toBe('Programmering')
  })

  it('scenario 5: kristendom → krle', () => {
    const hit = matchLessonForSchoolContext(
      plan(lessonsTypical8_10),
      ctx({ subjectKey: 'kristendom' })
    )
    expect(hit?.subjectKey).toBe('krle')
  })

  it('uavgjort → null (to like valgfag uten customLabel-tiebreaker)', () => {
    const ambiguousLessons = [
      { subjectKey: 'valgfag', customLabel: 'Programmering', start: '10:00', end: '10:45' },
      { subjectKey: 'valgfag', customLabel: 'Trafikk', start: '12:00', end: '12:45' },
    ]
    // subjectKey alene gir +5 begge steder — ingen tiebreaker → uavgjort → null.
    const hit = matchLessonForSchoolContext(
      plan(ambiguousLessons),
      ctx({ subjectKey: 'valgfag' })
    )
    expect(hit).toBeNull()
  })

  it('alle scores under MIN → null', () => {
    // Et fag som ikke finnes + ingen andre signaler → alle scores er 0.
    const hit = matchLessonForSchoolContext(
      plan(lessonsTypical8_10),
      ctx({ subjectKey: 'latin' })
    )
    expect(hit).toBeNull()
  })

  it('subjectCandidates velger riktig språk når A-planen lister flere', () => {
    // A-planen sier "Spansk / Tysk / Fransk" — barnet har bare Spansk.
    const hit = matchLessonForSchoolContext(
      plan(lessonsTypical8_10),
      ctx({
        subjectKey: 'fremmedspråk',
        subjectCandidates: [
          { subjectKey: 'fremmedspråk', customLabel: 'Spansk' },
          { subjectKey: 'fremmedspråk', customLabel: 'Tysk' },
          { subjectKey: 'fremmedspråk', customLabel: 'Fransk' },
        ],
      })
    )
    expect(hit?.customLabel).toBe('Spansk')
  })

  it('subjectCandidates unngår feilmatch når ingen kandidat stemmer', () => {
    // A-planen sier "Tysk / Fransk" — barnet har kun Spansk → ingen match.
    const hit = matchLessonForSchoolContext(
      plan(lessonsTypical8_10),
      ctx({
        subjectCandidates: [
          { subjectKey: 'fremmedspråk', customLabel: 'Tysk' },
          { subjectKey: 'fremmedspråk', customLabel: 'Fransk' },
        ],
      })
    )
    expect(hit).toBeNull()
  })

  it('lessonStart boost velger riktig time når customLabel mangler', () => {
    const hit = matchLessonForSchoolContext(
      plan(lessonsTypical8_10),
      ctx({ subjectKey: 'matematikk', lessonStart: '08:30' })
    )
    expect(hit?.subjectKey).toBe('matematikk')
    expect(hit?.start).toBe('08:30')
  })

  it('returnerer null når planen mangler lessons', () => {
    expect(matchLessonForSchoolContext(undefined, ctx({ subjectKey: 'matte' }))).toBeNull()
    expect(matchLessonForSchoolContext({ useSimpleDay: true }, ctx({ subjectKey: 'matte' }))).toBeNull()
  })
})

describe('MIN_MATCH_SCORE sanity', () => {
  it('is tuned så at subjectKey alene er akkurat nok', () => {
    expect(MIN_MATCH_SCORE).toBeLessThanOrEqual(5)
    expect(MIN_MATCH_SCORE).toBeGreaterThanOrEqual(3)
  })
})

function makeEvent(partial: Partial<Event> & { id: string; personId: string }): Event {
  return {
    title: 'test',
    start: '09:00',
    end: '10:00',
    ...partial,
  } as Event
}

describe('extractSchoolDayOverride', () => {
  it('returnerer null for event uten override-metadata', () => {
    expect(extractSchoolDayOverride(makeEvent({ id: 'a', personId: 'p1' }))).toBeNull()
  })

  it('parser gyldig replace_day med label og tider', () => {
    const ev = makeEvent({
      id: 'a',
      personId: 'p1',
      metadata: {
        schoolDayOverride: {
          mode: 'replace_day',
          kind: 'exam_day',
          label: 'Heldagsprøve matte',
          schoolStart: '08:30',
          schoolEnd: '14:00',
        },
      },
    })
    const o = extractSchoolDayOverride(ev)
    expect(o).toEqual({
      mode: 'replace_day',
      kind: 'exam_day',
      label: 'Heldagsprøve matte',
      schoolStart: '08:30',
      schoolEnd: '14:00',
    })
  })

  it('avviser ukjent mode/kind', () => {
    const bad1 = makeEvent({
      id: 'b',
      personId: 'p1',
      metadata: { schoolDayOverride: { mode: 'nuke_day', kind: 'exam_day' } as unknown as SchoolDayOverride },
    })
    const bad2 = makeEvent({
      id: 'c',
      personId: 'p1',
      metadata: { schoolDayOverride: { mode: 'replace_day', kind: 'party' } as unknown as SchoolDayOverride },
    })
    expect(extractSchoolDayOverride(bad1)).toBeNull()
    expect(extractSchoolDayOverride(bad2)).toBeNull()
  })

  it('ignorerer ugyldig HH:mm', () => {
    const ev = makeEvent({
      id: 'd',
      personId: 'p1',
      metadata: {
        schoolDayOverride: {
          mode: 'adjust_day',
          kind: 'delayed_start',
          schoolStart: '08:99',
          schoolEnd: '14:00',
        },
      },
    })
    const o = extractSchoolDayOverride(ev)
    expect(o?.schoolStart).toBeUndefined()
    expect(o?.schoolEnd).toBe('14:00')
  })
})

describe('pickSchoolDayOverrideForChild', () => {
  const override = (o: Partial<SchoolDayOverride> & Pick<SchoolDayOverride, 'mode' | 'kind'>): SchoolDayOverride => ({
    ...o,
  })

  it('returnerer null for tom liste eller ingen match', () => {
    expect(pickSchoolDayOverrideForChild(undefined, 'p1')).toBeNull()
    expect(pickSchoolDayOverrideForChild([], 'p1')).toBeNull()
    const irrelevant = makeEvent({ id: '1', personId: 'p2', metadata: { schoolDayOverride: override({ mode: 'hide_day', kind: 'free_day' }) } })
    expect(pickSchoolDayOverrideForChild([irrelevant], 'p1')).toBeNull()
  })

  it('ignorerer syntetiske bakgrunns-events', () => {
    const fake = makeEvent({
      id: 'bg-1',
      personId: 'p1',
      metadata: {
        calendarLayer: 'background',
        backgroundKind: 'school',
        schoolDayOverride: override({ mode: 'replace_day', kind: 'exam_day' }),
      },
    })
    expect(pickSchoolDayOverrideForChild([fake], 'p1')).toBeNull()
  })

  it('velger replace_day over hide_day og adjust_day', () => {
    const a = makeEvent({
      id: 'a',
      personId: 'p1',
      metadata: { schoolDayOverride: override({ mode: 'adjust_day', kind: 'delayed_start', schoolStart: '10:00' }) },
    })
    const b = makeEvent({
      id: 'b',
      personId: 'p1',
      metadata: { schoolDayOverride: override({ mode: 'hide_day', kind: 'free_day' }) },
    })
    const c = makeEvent({
      id: 'c',
      personId: 'p1',
      metadata: { schoolDayOverride: override({ mode: 'replace_day', kind: 'trip_day', label: 'Skitur' }) },
    })
    const picked = pickSchoolDayOverrideForChild([a, b, c], 'p1')
    expect(picked?.event.id).toBe('c')
    expect(picked?.override.mode).toBe('replace_day')
  })

  it('velger hide_day over adjust_day når replace mangler', () => {
    const a = makeEvent({
      id: 'a',
      personId: 'p1',
      metadata: { schoolDayOverride: override({ mode: 'adjust_day', kind: 'delayed_start' }) },
    })
    const b = makeEvent({
      id: 'b',
      personId: 'p1',
      metadata: { schoolDayOverride: override({ mode: 'hide_day', kind: 'free_day' }) },
    })
    const picked = pickSchoolDayOverrideForChild([a, b], 'p1')
    expect(picked?.event.id).toBe('b')
  })
})
