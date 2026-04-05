import { useState, useRef, useMemo } from 'react'
import type { Event } from '../types'
import { formatTime } from '../lib/time'
import { useFamily } from '../context/FamilyContext'
import { formatParticipantNamesLine, getParticipantPeople, participantSearchHaystack } from '../lib/eventParticipants'
import type { WeekDayLayout } from '../hooks/useScheduleState'

interface SearchBarProps {
  weekLayoutData: WeekDayLayout[]
  onJumpToDate: (date: string) => void
  onSelectEvent: (event: Event, date: string) => void
}

export function SearchBar({ weekLayoutData, onJumpToDate, onSelectEvent }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { people } = useFamily()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const matches: { event: Event; date: string; dayLabel: string }[] = []
    for (const day of weekLayoutData) {
      for (const ev of day.events) {
        const haystack = participantSearchHaystack(ev, people)
        if (haystack.includes(q)) {
          matches.push({ event: ev, date: day.date, dayLabel: day.dayAbbr })
        }
      }
    }
    return matches.slice(0, 12)
  }, [query, weekLayoutData, people])

  return (
    <div className="relative min-w-0 max-w-full">
      <div className="flex items-center gap-2">
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk i aktiviteter…"
            className="w-full rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[13px] outline-none focus:border-zinc-400"
            autoFocus
          />
        ) : null}
        <button
          type="button"
          onClick={() => {
            setOpen((prev) => {
              if (!prev) setTimeout(() => inputRef.current?.focus(), 50)
              else setQuery('')
              return !prev
            })
          }}
          className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label={open ? 'Lukk søk' : 'Søk i aktiviteter'}
        >
          {open ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          )}
        </button>
      </div>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 max-w-full overflow-y-auto overflow-x-hidden rounded-xl border border-zinc-200 bg-white shadow-card">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-zinc-500">Ingen treff</p>
          ) : (
            results.map((r) => {
              const plist = getParticipantPeople(r.event, people)
              return (
                <button
                  key={`${r.date}-${r.event.id}`}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50"
                  onClick={() => {
                    onJumpToDate(r.date)
                    onSelectEvent(r.event, r.date)
                    setQuery('')
                    setOpen(false)
                  }}
                >
                  <div className="flex shrink-0 gap-0.5">
                    {plist.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.colorAccent }}
                        aria-hidden
                      />
                    ))}
                    {plist.length === 0 && (
                      <span className="h-2 w-2 rounded-full bg-zinc-400" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-zinc-900">{r.event.title}</p>
                    <p className="text-[11px] text-zinc-500">
                      {r.dayLabel} &middot; {formatTime(r.event.start)}
                      {plist.length > 0 ? ` · ${formatParticipantNamesLine(r.event, people)}` : ''}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
