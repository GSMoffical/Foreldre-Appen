/**
 * Read-time helpers for the per-child «Denne uken»-merke (Tankestrøm-overlay).
 *
 * Tankestrøm-import lagrer uke-spesifikke avvik i `person.school.weekOverlays`
 * (se {@link file://./../features/tankestrom/useTankestromImport.ts} `saveSchoolWeekOverlay`).
 * Overlay-dataene lastes uendret tilbake på `Person.school` av FamilyContext, så vi kan
 * filtrere dem til inneværende ISO-uke (Oslo-tid) og telle dagene som faktisk endres.
 *
 * Anker til Oslo-tid på samme måte som `backgroundEvents.ts` (klokken 12 for å unngå DST-kanter).
 */
import type { Person, WeekdayMonFri } from '../types'
import { getISOWeek, getISOWeekYear } from './isoWeek'
import { todayKeyOslo } from './osloCalendar'

function currentOsloIsoWeek(): { weekYear: number; weekNumber: number } | null {
  const today = new Date(`${todayKeyOslo()}T12:00:00`)
  if (Number.isNaN(today.getTime())) return null
  return { weekYear: getISOWeekYear(today), weekNumber: getISOWeek(today) }
}

/**
 * Ukedagene (man=0 … fre=4) som har et reelt avvik fra normal skoleprofil denne uken.
 * Helg utelates — skoleruten vises kun man–fre. `action: 'none'` teller ikke som endring.
 */
export function getCurrentWeekOverlayDays(person: Person): Set<WeekdayMonFri> {
  const result = new Set<WeekdayMonFri>()
  const overlays = person.school?.weekOverlays
  if (!overlays?.length) return result
  const wk = currentOsloIsoWeek()
  if (!wk) return result
  for (const overlay of overlays) {
    if (overlay.weekYear !== wk.weekYear || overlay.weekNumber !== wk.weekNumber) continue
    for (const [key, action] of Object.entries(overlay.dailyActions)) {
      if (!action || action.action === 'none') continue
      const day = Number(key)
      if (day >= 0 && day <= 4) result.add(day as WeekdayMonFri)
    }
  }
  return result
}

/**
 * Antall skoledager (man–fre) med Tankestrøm-avvik for inneværende uke.
 * 0 for foreldre/gjester og barn uten overlay — da skjules merket helt.
 */
export function getCurrentWeekOverlayCount(person: Person): number {
  return getCurrentWeekOverlayDays(person).size
}
