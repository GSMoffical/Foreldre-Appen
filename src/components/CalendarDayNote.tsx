import { formatNorwegianCalendarSummary } from '../lib/norwegianSchoolCalendar'

/** Day timeline: shows Norwegian public holidays + skoleferie (default Oslo ranges) when relevant */
export function CalendarDayNote({ date }: { date: string }) {
  const line = formatNorwegianCalendarSummary(date)
  if (!line) return null
  return (
    <div className="px-4 pb-1 pt-0.5" role="status">
      <p className="text-center text-[11px] font-medium leading-snug text-brandNavy/85">{line}</p>
    </div>
  )
}
