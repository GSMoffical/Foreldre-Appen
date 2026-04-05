import Holidays from 'date-holidays'
import { NORWAY_SCHOOL_BREAKS } from '../data/norwaySchoolBreaks'

const hd = new Holidays('NO', { languages: ['no'] })

const holidaysByYear = new Map<number, ReturnType<typeof hd.getHolidays>>()

function holidaysInYear(year: number) {
  let list = holidaysByYear.get(year)
  if (!list) {
    list = hd.getHolidays(year)
    holidaysByYear.set(year, list)
  }
  return list
}

/** Public / bank days when schools and most workplaces are closed */
const RELEVANT_TYPES = new Set(['public', 'bank'])

function normDateKey(holidayDate: string): string {
  return holidayDate.slice(0, 10)
}

export type NorwegianDayMarker = {
  kind: 'public' | 'school'
  label: string
}

/**
 * Markers for a calendar day: Norwegian public/bank holidays (from `date-holidays`)
 * plus skoleferie windows from {@link NORWAY_SCHOOL_BREAKS} (default Oslo-style ranges).
 */
export function getNorwegianDayMarkers(dateKey: string): NorwegianDayMarker[] {
  const y = Number(dateKey.slice(0, 4))
  if (!Number.isFinite(y)) return []

  const list = holidaysInYear(y)
  const out: NorwegianDayMarker[] = []

  for (const h of list) {
    if (!RELEVANT_TYPES.has(h.type)) continue
    if (normDateKey(h.date) !== dateKey) continue
    out.push({ kind: 'public', label: h.name })
  }

  for (const b of NORWAY_SCHOOL_BREAKS) {
    if (dateKey >= b.start && dateKey <= b.end) {
      const already = out.some((m) => m.kind === 'public')
      if (!already) {
        out.push({ kind: 'school', label: b.label })
      }
      break
    }
  }

  return out
}

/** One line for day view / banner */
export function formatNorwegianCalendarSummary(dateKey: string): string | null {
  const markers = getNorwegianDayMarkers(dateKey)
  if (markers.length === 0) return null
  return markers.map((m) => m.label).join(' · ')
}

export function norwegianDayHasCalendarHighlight(dateKey: string): boolean {
  return getNorwegianDayMarkers(dateKey).length > 0
}
