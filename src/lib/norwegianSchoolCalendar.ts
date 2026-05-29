import { NORWAY_SCHOOL_BREAKS } from '../data/norwaySchoolBreaks'

type HolidaysInstance = import('date-holidays').default
type HolidayEntry = ReturnType<HolidaysInstance['getHolidays']>[number]

let hd: HolidaysInstance | null = null
let holidaysLoad: Promise<HolidaysInstance> | null = null

/** Loads `date-holidays` on first use (not at app startup). */
export function ensureNorwegianHolidaysLoaded(): Promise<void> {
  if (hd) return Promise.resolve()
  if (!holidaysLoad) {
    holidaysLoad = import('date-holidays').then((mod) => {
      const Holidays = mod.default
      hd = new Holidays('NO', { languages: ['no'] })
      return hd
    })
  }
  return holidaysLoad.then(() => undefined)
}

const holidaysByYear = new Map<number, HolidayEntry[]>()

function holidaysInYear(year: number): HolidayEntry[] {
  if (!hd) return []
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
function appendSchoolBreakMarkers(dateKey: string, out: NorwegianDayMarker[]): void {
  for (const b of NORWAY_SCHOOL_BREAKS) {
    if (dateKey >= b.start && dateKey <= b.end) {
      const already = out.some((m) => m.kind === 'public')
      if (!already) {
        out.push({ kind: 'school', label: b.label })
      }
      break
    }
  }
}

/** Skoleferier only — does not load `date-holidays`. */
export function norwegianDayHasSchoolBreak(dateKey: string): boolean {
  for (const b of NORWAY_SCHOOL_BREAKS) {
    if (dateKey >= b.start && dateKey <= b.end) return true
  }
  return false
}

/** Public/bank holiday (requires `date-holidays` to have loaded). */
export function norwegianDayHasPublicHoliday(dateKey: string): boolean {
  if (!hd) return false
  const y = Number(dateKey.slice(0, 4))
  if (!Number.isFinite(y)) return false
  for (const h of holidaysInYear(y)) {
    if (!RELEVANT_TYPES.has(h.type)) continue
    if (normDateKey(h.date) === dateKey) return true
  }
  return false
}

/** School break or public holiday — used to suppress school background blocks. */
export function norwegianDayOffSchool(dateKey: string): boolean {
  return norwegianDayHasSchoolBreak(dateKey) || norwegianDayHasPublicHoliday(dateKey)
}

export function getNorwegianDayMarkers(dateKey: string): NorwegianDayMarker[] {
  const y = Number(dateKey.slice(0, 4))
  if (!Number.isFinite(y)) return []

  const out: NorwegianDayMarker[] = []

  if (hd) {
    const list = holidaysInYear(y)
    for (const h of list) {
      if (!RELEVANT_TYPES.has(h.type)) continue
      if (normDateKey(h.date) !== dateKey) continue
      out.push({ kind: 'public', label: h.name })
    }
  }

  appendSchoolBreakMarkers(dateKey, out)
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
