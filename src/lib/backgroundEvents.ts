import type { Event, Person, PersonId, WeekdayMonFri } from '../types'
import { DEFAULT_SCHOOL_GATE_BY_BAND } from '../data/norwegianSubjects'
import { dateKeyToWeekdayMon0 } from './weekday'

function makeBackgroundEvent(
  personId: PersonId,
  dateKey: string,
  start: string,
  end: string,
  title: string,
  kind: 'school' | 'work',
  idSuffix: string,
  subkind: 'school_day' | 'school_lesson' | 'school_break' | 'work_day'
): Event {
  return {
    id: `bg-${kind}-${personId}-${dateKey}-${idSuffix}`,
    personId,
    title,
    start,
    end,
    metadata: { calendarLayer: 'background', backgroundKind: kind, backgroundSubkind: subkind },
  }
}

/**
 * Synthetic events from child school / parent work profiles (not stored in DB).
 * Rendered behind normal calendar activities.
 */
export function buildBackgroundEventsForDate(
  dateKey: string,
  people: Person[],
  selectedPersonIds: PersonId[]
): Event[] {
  const mon0 = dateKeyToWeekdayMon0(dateKey)
  if (mon0 > 4) return []

  const wd = mon0 as WeekdayMonFri
  const passes = (pid: PersonId) =>
    selectedPersonIds.length === 0 || selectedPersonIds.includes(pid)

  const out: Event[] = []

  for (const p of people) {
    if (!passes(p.id)) continue

    if (p.memberKind === 'child' && p.school != null) {
      const band = p.school.gradeBand
      const gates = DEFAULT_SCHOOL_GATE_BY_BAND[band]
      const plan = p.school.weekdays[wd]

      if (plan === undefined) {
        out.push(
          makeBackgroundEvent(p.id, dateKey, gates.start, gates.end, 'Skole', 'school', 'day', 'school_day')
        )
        continue
      }

      const start = plan.schoolStart ?? gates.start
      const end = plan.schoolEnd ?? gates.end

      if (plan.useSimpleDay || !plan.lessons?.length) {
        out.push(makeBackgroundEvent(p.id, dateKey, start, end, 'Skole', 'school', 'day', 'school_day'))
      } else {
        const lessons = [...plan.lessons].sort((a, b) => a.start.localeCompare(b.start))
        const dayStart = lessons[0]?.start ?? start
        const dayEnd = lessons[lessons.length - 1]?.end ?? end

        // Lesson-based plans should still look like one continuous school day block.
        out.push(makeBackgroundEvent(p.id, dateKey, dayStart, dayEnd, 'Skole', 'school', 'day', 'school_day'))

      }
    }

    if (p.memberKind === 'parent' && p.work?.weekdays[wd]) {
      const { start, end } = p.work.weekdays[wd]!
      out.push(makeBackgroundEvent(p.id, dateKey, start, end, 'Arbeid', 'work', 'day', 'work_day'))
    }
  }

  return out
}
