import { motion } from 'framer-motion'
import type { Event, Person } from '../types'
import { getParticipantPeople } from '../lib/eventParticipants'
import { ParticipantAvatarStrip } from './ParticipantAvatarStrip'

interface SynkaNextUpCardProps {
  event: Event
  people: Person[]
  onClick: () => void
  /** "NÅ" | "NESTE OPP" | "FØRSTE HENDELSE" */
  label?: string
}

export function SynkaNextUpCard({ event, people, onClick, label = 'NESTE OPP' }: SynkaNextUpCardProps) {
  const plist = getParticipantPeople(event, people)
  const primary = plist[0]
  const accent = primary?.colorAccent ?? '#1d5a3f'

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="w-full overflow-hidden rounded-2xl bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      style={{
        borderLeft: `5px solid ${accent}`,
        boxShadow: `0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px ${accent}1a`,
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
      aria-label={`${label}: ${event.title}, ${event.start}–${event.end}`}
    >
      <div className="px-4 py-4">
        {/* Label */}
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: accent }}
        >
          {label}
        </p>

        {/* Title */}
        <p className="mt-1.5 min-w-0 truncate text-[18px] font-bold leading-snug text-neutral-800">
          {event.title}
        </p>

        {/* Time + participants */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span
            className="text-[14px] font-bold tabular-nums"
            style={{ color: accent }}
          >
            {event.start}
            <span className="font-medium text-neutral-400"> – {event.end}</span>
          </span>
          <ParticipantAvatarStrip people={plist} max={3} />
        </div>

        {/* Location if present */}
        {event.location && (
          <p className="mt-1.5 text-[11px] text-neutral-400">{event.location}</p>
        )}
      </div>
    </motion.button>
  )
}
