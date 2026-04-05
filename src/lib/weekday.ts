/** Monday = 0 … Sunday = 6 (local date). */
export function dateKeyToWeekdayMon0(dateKey: string): number {
  const d = new Date(dateKey + 'T12:00:00')
  const js = d.getDay()
  return (js + 6) % 7
}
