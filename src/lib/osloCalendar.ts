const OSLO_TIME_ZONE = 'Europe/Oslo'

function formatPartsDateKey(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) {
    throw new Error('Could not format date key')
  }
  return `${year}-${month}-${day}`
}

function parseDateKeyToUtcNoon(dateKey: string): Date {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Invalid date key: ${dateKey}`)
  }
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function getWeekdayIndexInTimeZone(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date)
  switch (weekday) {
    case 'Sun':
      return 0
    case 'Mon':
      return 1
    case 'Tue':
      return 2
    case 'Wed':
      return 3
    case 'Thu':
      return 4
    case 'Fri':
      return 5
    case 'Sat':
      return 6
    default:
      throw new Error(`Unknown weekday: ${weekday}`)
  }
}

export function formatDateKeyInTimeZone(date: Date, timeZone = OSLO_TIME_ZONE): string {
  return formatPartsDateKey(date, timeZone)
}

export function todayKeyOslo(now: Date = new Date()): string {
  return formatDateKeyInTimeZone(now, OSLO_TIME_ZONE)
}

export function addCalendarDaysOslo(dateKey: string, delta: number): string {
  const base = parseDateKeyToUtcNoon(dateKey)
  base.setUTCDate(base.getUTCDate() + delta)
  return formatDateKeyInTimeZone(base, OSLO_TIME_ZONE)
}

export function weekDateKeysMondayStartOslo(centerDateKey: string): string[] {
  const center = parseDateKeyToUtcNoon(centerDateKey)
  const day = getWeekdayIndexInTimeZone(center, OSLO_TIME_ZONE)
  const deltaToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(center)
  start.setUTCDate(start.getUTCDate() + deltaToMonday)
  const keys: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    keys.push(formatDateKeyInTimeZone(d, OSLO_TIME_ZONE))
  }
  return keys
}

export function getRecurrenceOccurrenceDatesOslo(
  startDate: string,
  endDate: string,
  intervalDays: number
): string[] {
  if (intervalDays < 1) return []
  const out: string[] = []
  let current = startDate
  while (current <= endDate) {
    out.push(current)
    current = addCalendarDaysOslo(current, intervalDays)
  }
  return out
}
