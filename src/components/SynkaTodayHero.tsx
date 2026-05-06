import { motion } from 'framer-motion'
import { SynkaDecorativeShape } from './ui/SynkaDecorativeShape'

interface SynkaTodayHeroProps {
  selectedDate: string
  isToday: boolean
  eventCount: number
  openTaskCount: number
  onAddEvent: () => void
  onAddTask: () => void
  /** id= to place on the add-event button for onboarding */
  addEventId?: string
  /** id= to place on the add-task button for onboarding */
  addTaskId?: string
}

export function SynkaTodayHero({
  selectedDate,
  isToday,
  eventCount,
  openTaskCount,
  onAddEvent,
  onAddTask,
  addEventId,
  addTaskId,
}: SynkaTodayHeroProps) {
  const d = new Date(selectedDate + 'T12:00:00')
  const dayName = d.toLocaleDateString('nb-NO', { weekday: 'long' })
  const day = d.getDate()
  const month = d.toLocaleDateString('nb-NO', { month: 'long' })

  let summaryText: string
  if (eventCount === 0 && openTaskCount === 0) {
    summaryText = 'Ingenting planlagt — rolig dag'
  } else {
    const parts: string[] = []
    if (eventCount > 0) parts.push(`${eventCount} hendelse${eventCount !== 1 ? 'r' : ''}`)
    if (openTaskCount > 0) parts.push(`${openTaskCount} gjøremål`)
    summaryText = parts.join(' · ')
  }

  return (
    <div
      className="relative overflow-hidden px-5 pb-8 pt-4"
      style={{ background: 'linear-gradient(160deg, #14472f 0%, #1d5a3f 60%, #245a43 100%)' }}
    >
      {/* Decorative brand shapes */}
      <SynkaDecorativeShape
        variant="mint"
        size={140}
        opacity={0.2}
        className="pointer-events-none absolute -right-10 -top-10"
      />
      <SynkaDecorativeShape
        variant="yellow"
        size={72}
        opacity={0.15}
        className="pointer-events-none absolute bottom-2 right-16"
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Day name */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 capitalize">
          {dayName}
        </p>

        {/* Date headline */}
        <div className="mt-0.5 flex items-end gap-3">
          <span className="font-display text-[42px] font-bold leading-none text-white">
            {day}.
          </span>
          <span className="mb-1.5 font-display text-[22px] font-semibold leading-none text-white/75">
            {month}
          </span>
          {isToday && (
            <span className="mb-2 rounded-full bg-white/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/90">
              I dag
            </span>
          )}
        </div>

        {/* Summary */}
        <p className="mt-2 text-[13px] font-medium text-white/60">
          {summaryText}
        </p>

        {/* Add actions */}
        <div className="mt-4 flex items-center gap-2">
          <motion.button
            id={addEventId}
            type="button"
            onClick={onAddEvent}
            className="rounded-full bg-white px-4 py-2 text-[12px] font-bold text-primary-700 shadow-sm transition active:scale-95 touch-manipulation"
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
          >
            + Hendelse
          </motion.button>
          <motion.button
            id={addTaskId}
            type="button"
            onClick={onAddTask}
            className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/80 transition active:scale-95 touch-manipulation"
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
          >
            + Gjøremål
          </motion.button>
        </div>
      </div>
    </div>
  )
}
