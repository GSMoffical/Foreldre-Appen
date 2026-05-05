import { motion } from 'framer-motion'
import type { PersonId } from '../types'
import { useFamily } from '../context/FamilyContext'
import { springSnappy } from '../lib/motion'

interface FamilyFilterBarProps {
  selectedPersonIds: PersonId[]
  onFilterChange: (ids: PersonId[]) => void
  /** Person id that represents the current user ("deg") */
  mePersonId?: PersonId | null
}

const ALL_ID = 'all' as const

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function FamilyFilterBar({ selectedPersonIds, onFilterChange, mePersonId }: FamilyFilterBarProps) {
  const { people } = useFamily()
  const isAll = selectedPersonIds.length === 0 || selectedPersonIds.length === people.length

  if (people.length === 0) return null

  const handleTap = (id: PersonId | typeof ALL_ID) => {
    if (id === ALL_ID) {
      onFilterChange([])
      return
    }
    const set = new Set(selectedPersonIds)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onFilterChange(Array.from(set))
  }

  return (
    <div className="flex min-w-0 max-w-full items-center gap-2.5 overflow-x-auto px-4 pb-2 pt-1 scrollbar-none">
      {/* "Alle" pill */}
      <motion.button
        type="button"
        onClick={() => handleTap(ALL_ID)}
        className="flex h-8 shrink-0 items-center rounded-full px-3 text-[11px] font-semibold transition-all touch-manipulation"
        style={{
          backgroundColor: isAll ? '#1d5a3f' : 'white',
          color: isAll ? 'white' : '#7a7d77',
          boxShadow: isAll ? '0 1px 6px rgba(29,90,63,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
        }}
        whileTap={{ scale: 0.95 }}
        transition={springSnappy}
        aria-pressed={isAll}
        aria-label="Vis alle familiemedlemmer"
      >
        Alle
      </motion.button>

      {/* Person avatar circles */}
      {people.map((person) => {
        const active = selectedPersonIds.length === 0 || selectedPersonIds.includes(person.id)
        const isMe = mePersonId != null && person.id === mePersonId
        return (
          <motion.button
            key={person.id}
            type="button"
            onClick={() => handleTap(person.id)}
            className="flex shrink-0 flex-col items-center gap-0.5 touch-manipulation"
            whileTap={{ scale: 0.92 }}
            transition={springSnappy}
            aria-pressed={active}
            aria-label={isMe ? `${person.name} (deg)` : `Filtrer på ${person.name}`}
          >
            {/* Avatar circle */}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-all"
              style={{
                backgroundColor: active ? person.colorAccent : person.colorTint,
                color: active ? 'white' : person.colorAccent,
                opacity: active ? 1 : 0.55,
                boxShadow: active ? `0 2px 8px ${person.colorAccent}55` : 'none',
                outline: isMe && active ? `2.5px solid ${person.colorAccent}` : 'none',
                outlineOffset: '2px',
              }}
            >
              {getInitials(person.name)}
            </div>
            {/* Name label */}
            <span
              className="max-w-[40px] truncate text-center text-[9px] font-semibold leading-tight"
              style={{ color: active ? person.colorAccent : '#7a7d77' }}
            >
              {isMe ? 'Deg' : person.name.split(' ')[0]}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
