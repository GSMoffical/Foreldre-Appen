const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * ISO week-numbering year (may differ from calendar year near Jan 1).
 * Based on the Thursday of the week containing `date`.
 */
export function getISOWeekYear(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day + 3)
  return d.getFullYear()
}

/**
 * ISO 8601 week number (1–53). Week starts Monday (Norwegian / planning convention).
 */
export function getISOWeek(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day + 3)
  const firstThursday = d.getTime()
  d.setMonth(0, 1)
  if (d.getDay() !== 4) {
    d.setMonth(0, 1 + ((4 - d.getDay() + 7) % 7))
  }
  return 1 + Math.round((firstThursday - d.getTime()) / MS_PER_WEEK)
}
