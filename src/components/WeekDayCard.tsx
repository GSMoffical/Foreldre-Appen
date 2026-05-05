import { motion, type Variants } from 'framer-motion'
import type { WeekDayMeta } from '../types'
import { useFamily } from '../context/FamilyContext'
import { springSnappy } from '../lib/motion'
import { norwegianDayHasCalendarHighlight } from '../lib/norwegianSchoolCalendar'
import { todayKeyOslo } from '../lib/osloCalendar'

interface WeekDayCardProps {
  day: WeekDayMeta
  isSelected: boolean
  onSelect: () => void
  variants?: Variants
  openTaskCount?: number
}

export function WeekDayCard({ day, isSelected, onSelect, variants, openTaskCount = 0 }: WeekDayCardProps) {
  const { people } = useFamily()
  const dateNum = day.date.slice(8).replace(/^0/, '')
  const norwegianDay = norwegianDayHasCalendarHighlight(day.date)
  const isToday = day.date === todayKeyOslo()
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      variants={variants}
      className={`relative flex min-h-[52px] min-w-0 flex-1 basis-0 flex-col items-center justify-center rounded-2xl py-2 touch-manipulation transition-all ${
        isSelected
          ? 'bg-white shadow-[0_2px_12px_rgba(29,90,63,0.18)]'
          : isToday
            ? 'bg-primary-50/70'
            : 'bg-transparent'
      }`}
      style={isSelected ? { outline: '2px solid #1d5a3f', outlineOffset: '-2px' } : undefined}
      whileTap={{ scale: 0.95, transition: springSnappy }}
      aria-pressed={isSelected}
      aria-label={`Velg ${day.dayLabel} ${day.date}`}
    >
      <span
        className={`text-[10px] font-semibold uppercase tracking-widest ${
          isSelected ? 'text-primary-700' : isToday ? 'text-primary-600' : 'text-neutral-400'
        }`}
      >
        {day.dayAbbr}
      </span>
      <span
        className={`mt-0.5 font-display text-[18px] font-bold leading-none ${
          isSelected ? 'text-primary-700' : isToday ? 'text-primary-600' : 'text-neutral-500'
        }`}
      >
        {dateNum}
      </span>
      {norwegianDay && (
        <span
          className="pointer-events-none absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent-sun-main"
          title="Helligdag eller skoleferie"
          aria-hidden
        />
      )}
      <div className="mt-1 flex min-h-[6px] gap-0.5">
        {people.filter((p) => day.personIdsWithEvents.includes(p.id)).map((p) => (
          <span
            key={p.id}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: p.colorAccent }}
            aria-hidden
          />
        ))}
        {openTaskCount > 0 && (
          <span
            className="h-1.5 w-1.5 rounded-sm bg-accent-sun-main"
            title="Gjøremål"
            aria-hidden
          />
        )}
      </div>
    </motion.button>
  )
}
