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
      className={`relative flex min-h-[44px] min-w-0 flex-1 basis-0 flex-col items-center justify-center rounded-xl border-2 py-2 touch-manipulation transition-shadow ${
        isSelected
          ? 'border-transparent bg-synkaPrimary shadow-planner'
          : 'border-transparent bg-transparent'
      }`}
      whileTap={{ scale: 0.98, transition: springSnappy }}
      aria-pressed={isSelected}
      aria-label={`Select ${day.dayLabel} ${day.date}`}
    >
      <span
        className={`text-caption font-medium uppercase tracking-wide ${
          isSelected ? 'text-white' : 'text-synkaNavy/60'
        }`}
      >
        {day.dayAbbr}
      </span>
      <span
        className={`font-display mt-0.5 text-heading font-semibold ${
          isSelected ? 'text-white' : 'text-synkaNavy/60'
        }`}
      >
        {dateNum}
      </span>
      {norwegianDay && (
        <span
          className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-pill bg-amber-500/90"
          title="Helligdag eller skoleferie"
          aria-hidden
        />
      )}
      {isToday && (
        <span className="mt-0.5 h-1.5 w-1.5 rounded-pill bg-synkaYellow" aria-hidden />
      )}
      <div className="mt-1 flex gap-0.5">
        {people.filter((p) => day.personIdsWithEvents.includes(p.id)).map((p) => (
          <span
            key={p.id}
            className="h-1.5 w-1.5 rounded-pill"
            style={{ backgroundColor: p.colorAccent }}
            aria-hidden
          />
        ))}
        {openTaskCount > 0 && (
          <span
            className="h-1.5 w-1.5 rounded-sm bg-amber-400"
            title="Gjøremål"
            aria-hidden
          />
        )}
      </div>
    </motion.button>
  )
}
