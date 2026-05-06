import { motion } from 'framer-motion'
import type { Event, Person } from '../types'
import { getParticipantPeople, formatParticipantNamesLine } from '../lib/eventParticipants'
import { ParticipantAvatarStrip } from './ParticipantAvatarStrip'

interface SynkaEventCardProps {
  event: Event
  people: Person[]
  date: string
  onClick: () => void
  className?: string
}

/**
 * Branded Synka event card — used in WeeklyList and any list context.
 * White surface · 4px colored left stripe · person avatars · time hierarchy.
 * Keep ActivityBlock for the positioned timeline — this is for lists.
 */
export function SynkaEventCard({ event, people, onClick, className = '' }: SynkaEventCardProps) {
  const plist = getParticipantPeople(event, people)
  const primary = plist[0]
  const accent = primary?.colorAccent ?? '#1d5a3f'
  const namesLine = formatParticipantNamesLine(event, people)
  const showNames = !!namesLine && namesLine !== 'Ukjent'

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`w-full overflow-hidden rounded-xl bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${className}`}
      style={{
        borderLeft: `4px solid ${accent}`,
        boxShadow: `0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px ${accent}18`,
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
      aria-label={`${event.title}, ${event.start}–${event.end}`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* ── Time column ── */}
        <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
          <span
            className="text-[13px] font-bold tabular-nums leading-tight"
            style={{ color: accent }}
          >
            {event.start}
          </span>
          <span className="text-[10px] tabular-nums leading-tight text-neutral-400">
            {event.end}
          </span>
        </div>

        {/* ── Thin colour divider ── */}
        <div
          className="mt-1 shrink-0 self-stretch w-px rounded-full"
          style={{ backgroundColor: accent, opacity: 0.18 }}
          aria-hidden
        />

        {/* ── Content ── */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[14px] font-semibold leading-snug text-neutral-700">
              {event.title}
            </span>
            <ParticipantAvatarStrip people={plist} max={3} className="shrink-0 pt-0.5" />
          </div>

          {(showNames || event.location) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {showNames && (
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: accent }}
                >
                  {namesLine}
                </span>
              )}
              {event.location && (
                <span className="text-[11px] text-neutral-400">
                  {event.location}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  )
}
