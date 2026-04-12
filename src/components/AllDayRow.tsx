import type { Event } from '../types'
import { useFamily } from '../context/FamilyContext'
import { getParticipantPeople } from '../lib/eventParticipants'

interface AllDayRowProps {
  events: Event[]
  selectedDate: string
  onSelectEvent: (event: Event) => void
}

export function AllDayRow({ events, selectedDate: _selectedDate, onSelectEvent }: AllDayRowProps) {
  const { people } = useFamily()
  if (events.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 bg-surface/80 px-3 py-1.5">
      {events.map((ev) => {
        const plist = getParticipantPeople(ev, people)
        const primary = plist[0]
        const isMultiDay = !!(ev.metadata?.endDate as string | undefined)

        return (
          <button
            key={ev.id}
            type="button"
            onClick={() => onSelectEvent(ev)}
            className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full border py-0.5 pl-2 pr-2.5 text-[11px] font-medium text-zinc-700 shadow-sm transition-opacity hover:opacity-80 active:scale-[0.97]"
            style={{
              backgroundColor: primary?.colorTint ?? '#f4f4f5',
              borderColor: primary?.colorAccent ?? '#d4d4d8',
            }}
          >
            <span className="flex shrink-0 gap-0.5">
              {plist.slice(0, 3).map((p) => (
                <span
                  key={p.id}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: p.colorAccent }}
                />
              ))}
              {plist.length === 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              )}
            </span>
            <span className="truncate">{ev.title}</span>
            {isMultiDay && (
              <span className="shrink-0 text-[9px] font-bold text-zinc-400" aria-hidden>
                ↔
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
