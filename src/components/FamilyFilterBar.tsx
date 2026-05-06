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
    <div className="flex min-w-0 max-w-full items-center gap-3 overflow-x-auto px-4 pb-2.5 pt-1.5 scrollbar-none">
      {/* "Alle" pill */}
      <motion.button
        type="button"
        onClick={() => handleTap(ALL_ID)}
        className={`flex h-9 shrink-0 items-center rounded-full px-4 text-[12px] font-bold transition-all touch-manipulation ${
          isAll
            ? 'bg-primary-600 text-white'
            : 'border border-neutral-300 bg-white text-neutral-500'
        }`}
        style={isAll ? { boxShadow: '0 2px 8px rgba(29,90,63,0.25)' } : undefined}
        whileTap={{ scale: 0.93 }}
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
        const firstName = isMe ? 'Deg' : person.name.split(' ')[0]
        return (
          <motion.button
            key={person.id}
            type="button"
            onClick={() => handleTap(person.id)}
            className="flex shrink-0 flex-col items-center gap-1 touch-manipulation"
            whileTap={{ scale: 0.9 }}
            transition={springSnappy}
            aria-pressed={active}
            aria-label={isMe ? `${person.name} (deg)` : `Filtrer på ${person.name}`}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-all duration-150"
              style={{
                backgroundColor: active ? person.colorAccent : person.colorTint,
                color: active ? 'white' : person.colorAccent,
                opacity: active ? 1 : 0.45,
                boxShadow: active ? `0 2px 8px ${person.colorAccent}50` : 'none',
                outline: isMe && active ? `2.5px solid ${person.colorAccent}` : 'none',
                outlineOffset: '2px',
              }}
            >
              {getInitials(person.name)}
            </div>
            <span
              className="max-w-[44px] truncate text-center text-[10px] font-bold leading-tight"
              style={{ color: active ? person.colorAccent : '#b0b3af' }}
            >
              {firstName}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
