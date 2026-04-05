import { LayoutGroup, motion } from 'framer-motion'
import type { PersonId } from '../types'
import { useFamily } from '../context/FamilyContext'

interface FamilyFilterBarProps {
  selectedPersonIds: PersonId[]
  onFilterChange: (ids: PersonId[]) => void
  /** Person id that represents the current user ("deg") */
  mePersonId?: PersonId | null
}

const ALL_ID = 'all' as const

export function FamilyFilterBar({ selectedPersonIds, onFilterChange, mePersonId }: FamilyFilterBarProps) {
  const { people } = useFamily()
  const isAll = selectedPersonIds.length === 0 || selectedPersonIds.length === people.length

  if (people.length === 0) {
    return (
      <div className="px-4 pb-2 pt-2 text-center">
        <p className="text-[13px] text-zinc-600">
          Ingen familiemedlemmer ennå. Gå til <span className="font-medium text-zinc-800">Innstillinger</span> for å
          legge til foreldre og barn.
        </p>
      </div>
    )
  }

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
    <LayoutGroup id="family-filter">
    <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
      <div className="flex shrink-0 px-1" />
      <motion.button
        type="button"
        layout
        onClick={() => handleTap(ALL_ID)}
        className="flex shrink-0 items-center rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors touch-manipulation"
        style={{
          backgroundColor: isAll ? 'rgb(228 228 231)' : 'rgb(241 245 249)',
          color: isAll ? 'rgb(39 39 42)' : 'rgb(113 113 122)',
        }}
        whileTap={{ scale: 0.97 }}
        aria-pressed={isAll}
        aria-label="Vis alle familiemedlemmer"
      >
        Alle
      </motion.button>
      {people.map((person) => {
        const active = selectedPersonIds.length === 0 || selectedPersonIds.includes(person.id)
        const isMe = mePersonId != null && person.id === mePersonId
        return (
          <motion.button
            key={person.id}
            type="button"
            layout
            onClick={() => handleTap(person.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors touch-manipulation ${isMe ? 'ring-2 ring-offset-1 ring-brandNavy/30' : ''}`}
            style={{
              backgroundColor: active ? person.colorTint : 'rgb(241 245 249)',
              color: active ? person.colorAccent : 'rgb(113 113 122)',
              borderWidth: active ? 1.5 : 0,
              borderColor: active ? person.colorAccent : 'transparent',
            }}
            whileTap={{ scale: 0.97 }}
            aria-pressed={active}
            aria-label={isMe ? `${person.name} (deg)` : `Filtrer på ${person.name}`}
          >
            <span>{person.name}</span>
            {isMe && <span className="text-[10px] font-normal opacity-80">deg</span>}
          </motion.button>
        )
      })}
      <div className="h-1 w-2 shrink-0" />
    </div>
    </LayoutGroup>
  )
}
