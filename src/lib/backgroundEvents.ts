import type { Event, Person, PersonId, SchoolDayOverride, WeekdayMonFri } from '../types'
import { DEFAULT_SCHOOL_GATE_BY_BAND } from '../data/norwegianSubjects'
import { dateKeyToWeekdayMon0 } from './weekday'
import { pickSchoolDayOverrideForChild } from './schoolContext'

type BackgroundSubkind = 'school_day' | 'school_day_override' | 'school_lesson' | 'school_break' | 'work_day'

function makeBackgroundEvent(
  personId: PersonId,
  dateKey: string,
  start: string,
  end: string,
  title: string,
  kind: 'school' | 'work',
  idSuffix: string,
  subkind: BackgroundSubkind,
  extraMeta?: Record<string, unknown>
): Event {
  return {
    id: `bg-${kind}-${personId}-${dateKey}-${idSuffix}`,
    personId,
    title,
    start,
    end,
    metadata: {
      calendarLayer: 'background',
      backgroundKind: kind,
      backgroundSubkind: subkind,
      ...extraMeta,
    },
  }
}

/**
 * Bygger en syntetisk "spesialdag"-blokk fra en `replace_day`-override.
 * Bruker override-tider hvis satt, ellers faller tilbake til dagens normale skole-tider.
 */
function makeOverrideReplaceBlock(
  personId: PersonId,
  dateKey: string,
  override: SchoolDayOverride,
  fallbackStart: string,
  fallbackEnd: string,
  sourceEvent: Event
): Event {
  const start = override.schoolStart ?? fallbackStart
  const end = override.schoolEnd ?? fallbackEnd
  const title = override.label ?? sourceEvent.title ?? 'Spesialdag'
  return makeBackgroundEvent(personId, dateKey, start, end, title, 'school', 'day-override', 'school_day_override', {
    schoolDayOverride: override,
    schoolDayOverrideSourceId: sourceEvent.id,
  })
}

/**
 * Synthetic events from child school / parent work profiles (not stored in DB).
 * Rendered behind normal calendar activities.
 *
 * `dayEvents` er valgfri og brukes utelukkende for å sjekke `metadata.schoolDayOverride`
 * fra importerte events. Kalles uten dayEvents = eksakt samme oppførsel som før.
 */
export function buildBackgroundEventsForDate(
  dateKey: string,
  people: Person[],
  selectedPersonIds: PersonId[],
  dayEvents?: readonly Event[]
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

      // Regn ut forventet skoledags-range (brukes som fallback ved override).
      let dayStart = plan?.schoolStart ?? gates.start
      let dayEnd = plan?.schoolEnd ?? gates.end
      if (plan?.lessons?.length && !plan.useSimpleDay) {
        const lessons = [...plan.lessons].sort((a, b) => a.start.localeCompare(b.start))
        dayStart = lessons[0]?.start ?? dayStart
        dayEnd = lessons[lessons.length - 1]?.end ?? dayEnd
      }

      const picked = pickSchoolDayOverrideForChild(dayEvents, p.id)
      if (picked) {
        const { override, event: sourceEvent } = picked
        if (override.mode === 'hide_day') {
          continue // Skjul skoleblokken helt denne dagen.
        }
        if (override.mode === 'replace_day') {
          out.push(makeOverrideReplaceBlock(p.id, dateKey, override, dayStart, dayEnd, sourceEvent))
          continue // Ingen vanlig skoleblokk i tillegg.
        }
        if (override.mode === 'adjust_day') {
          const adjStart = override.schoolStart ?? dayStart
          const adjEnd = override.schoolEnd ?? dayEnd
          if (adjStart < adjEnd) {
            out.push(
              makeBackgroundEvent(p.id, dateKey, adjStart, adjEnd, 'Skole', 'school', 'day', 'school_day', {
                schoolDayOverride: override,
                schoolDayOverrideSourceId: sourceEvent.id,
              })
            )
            continue
          }
          // Hvis adjust gir tom/omvendt range: degrade til vanlig behandling.
        }
      }

      // ---- Normal (ingen override eller adjust som ikke kunne anvendes) ----
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
