import { motion, useReducedMotion } from 'framer-motion'
import type { WeekDayMeta } from '../types'
import { WeekDayCard } from './WeekDayCard'
import { weekStripStagger } from '../lib/motion'
import { todayKeyOslo } from '../lib/osloCalendar'

interface WeekStripProps {
  days: WeekDayMeta[]
  selectedDate: string
  onSelectDay: (date: string) => void
  loading?: boolean
  taskCountByDate?: Record<string, number>
}

export function WeekStrip({ days, selectedDate, onSelectDay, loading, taskCountByDate }: WeekStripProps) {
  const reducedMotion = useReducedMotion() ?? false
  const { container, item } = weekStripStagger(reducedMotion)
  const weekKey = days[0]?.date ?? 'empty'
  const todayKey = todayKeyOslo()

  return (
    <motion.div
      key={weekKey}
      className={`flex w-full min-w-0 max-w-full gap-1 px-4 py-1 ${loading ? 'opacity-60' : ''}`}
      variants={container}
      initial="hidden"
      animate="visible"
      style={{ willChange: 'transform, opacity' }}
    >
      {days.map((day) => (
        <WeekDayCard
          key={day.date}
          day={day}
          isSelected={day.date === selectedDate}
          onSelect={() => onSelectDay(day.date)}
          variants={item}
          isToday={day.date === todayKey}
          hasEvents={day.personIdsWithEvents.length > 0}
          hasOverdueTask={day.date < todayKey && (taskCountByDate?.[day.date] ?? 0) > 0}
        />
      ))}
    </motion.div>
  )
}
