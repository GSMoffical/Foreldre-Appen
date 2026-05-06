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

  const isTodaySelected = isToday && isSelected
  const isSelectedOnly = isSelected && !isToday
  const isTodayOnly = isToday && !isSelected

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      variants={variants}
      className={`relative flex min-h-[60px] min-w-0 flex-1 basis-0 flex-col items-center justify-center rounded-2xl py-2 touch-manipulation transition-all ${
        isTodaySelected
          ? 'bg-primary-600 shadow-[0_4px_14px_rgba(29,90,63,0.32)]'
          : isSelectedOnly
            ? 'bg-white shadow-[0_2px_12px_rgba(29,90,63,0.15)]'
            : isTodayOnly
              ? 'bg-primary-50'
              : 'bg-transparent'
      }`}
      whileTap={{ scale: 0.91, transition: springSnappy }}
      aria-pressed={isSelected}
      aria-label={`Velg ${day.dayLabel} ${day.date}`}
    >
      {/* Day abbreviation */}
      <span
        className={`text-[10px] font-bold uppercase tracking-widest ${
          isTodaySelected ? 'text-white/75'
            : isSelectedOnly ? 'text-primary-600'
            : isTodayOnly ? 'text-primary-600'
            : 'text-neutral-400'
        }`}
      >
        {day.dayAbbr}
      </span>

      {/* Date number — Literata display */}
      <span
        className={`mt-0.5 font-display text-[22px] font-bold leading-none ${
          isTodaySelected ? 'text-white'
            : isSelectedOnly ? 'text-primary-600'
            : isTodayOnly ? 'text-primary-600'
            : 'text-neutral-600'
        }`}
      >
        {dateNum}
      </span>

      {/* "I dag" micro label when today + selected */}
      {isTodaySelected && (
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-white/70">
          I dag
        </span>
      )}

      {/* Norwegian holiday dot */}
      {norwegianDay && (
        <span
          className={`pointer-events-none absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${
            isTodaySelected ? 'bg-white/60' : 'bg-accent-sun-main'
          }`}
          title="Helligdag eller skoleferie"
          aria-hidden
        />
      )}

      {/* Person + task indicator dots */}
      <div className="mt-1 flex min-h-[6px] gap-0.5">
        {people.filter((p) => day.personIdsWithEvents.includes(p.id)).map((p) => (
          <span
            key={p.id}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: isTodaySelected ? 'rgba(255,255,255,0.65)' : p.colorAccent }}
            aria-hidden
          />
        ))}
        {openTaskCount > 0 && (
          <span
            className={`h-1.5 w-1.5 rounded-sm ${isTodaySelected ? 'bg-white/55' : 'bg-accent-sun-main'}`}
            title="Gjøremål"
            aria-hidden
          />
        )}
      </div>
    </motion.button>
  )
}
