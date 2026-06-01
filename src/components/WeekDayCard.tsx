import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { WeekDayMeta } from '../types'
import { springSnappy } from '../lib/motion'

interface WeekDayCardProps {
  day: WeekDayMeta
  isSelected: boolean
  onSelect: () => void
  variants?: Variants
  isToday: boolean
  hasEvents: boolean
  hasOverdueTask: boolean
}

export function WeekDayCard({ day, isSelected, onSelect, variants, isToday, hasEvents, hasOverdueTask }: WeekDayCardProps) {
  const reducedMotion = useReducedMotion() ?? false
  const dateNum = day.date.slice(8).replace(/^0/, '')

  const dotClass = hasOverdueTask
    ? 'bg-synkaCoral'
    : isToday
    ? 'bg-synkaYellow'
    : hasEvents
    ? 'bg-synkaTeal'
    : 'invisible'

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      variants={variants}
      className="relative flex min-h-[44px] min-w-0 flex-1 basis-0 flex-col items-center justify-center rounded-xl py-2 touch-manipulation"
      whileTap={{ scale: 0.98, transition: springSnappy }}
      aria-pressed={isSelected}
      aria-label={`Select ${day.dayLabel} ${day.date}`}
    >
      <span className="text-caption font-medium uppercase tracking-wide text-synkaNavy/60">
        {day.dayAbbr}
      </span>
      <motion.span
        animate={isSelected && !reducedMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut', times: [0, 0.5, 1] }}
        className={
          isSelected
            ? 'font-sans mt-0.5 text-display font-bold text-synkaPrimary leading-none'
            : 'font-sans mt-0.5 text-body-sm text-synkaNavy/50 font-normal'
        }
      >
        {dateNum}
      </motion.span>
      <span className={`mt-1 w-1.5 h-1.5 rounded-full ${dotClass}`} aria-hidden />
    </motion.button>
  )
}
