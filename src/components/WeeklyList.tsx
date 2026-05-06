import type { Event } from '../types'
import type { WeekDayLayout } from '../hooks/useScheduleState'
import { useFamily } from '../context/FamilyContext'
import { SwipeableEventRow } from './SwipeableEventRow'
import { AllDayRow } from './AllDayRow'
import { SynkaEventCard } from './SynkaEventCard'
import { todayKeyOslo } from '../lib/osloCalendar'

interface WeeklyListProps {
  weekLayoutData: WeekDayLayout[]
  onSelectEvent: (event: Event, date: string) => void
  onDeleteEvent?: (event: Event, date: string) => void
  /** Optional: open AddEventSheet pre-filled for a specific day. */
  onAddEventForDay?: (date: string) => void
}

export function WeeklyList({ weekLayoutData, onSelectEvent, onDeleteEvent, onAddEventForDay }: WeeklyListProps) {
  const { people } = useFamily()
  const todayKey = todayKeyOslo()

  return (
    <div className="relative isolate min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto px-4 scrollbar-none">
      <div className="space-y-6 pb-8 pt-1">
        {weekLayoutData.map((day) => {
          const d = new Date(day.date + 'T12:00:00')
          const dateNum = String(d.getDate())
          const isToday = day.date === todayKey
          const events = [...day.events].sort((a, b) => a.start.localeCompare(b.start))
          const totalCount = events.length + (day.allDayEvents?.length ?? 0)

          return (
            <section key={day.date} aria-label={`${day.dayLabel} liste`}>

              {/* ── Day header ── */}
              <div className={`sticky top-0 z-10 -mx-4 px-4 pb-2.5 pt-3 backdrop-blur-sm ${
                isToday ? 'bg-primary-50/95' : 'bg-neutral-50/95'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-display text-[30px] font-bold leading-none tabular-nums ${
                        isToday ? 'text-primary-600' : 'text-neutral-700'
                      }`}
                    >
                      {dateNum}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider ${
                          isToday ? 'text-primary-600' : 'text-neutral-400'
                        }`}
                      >
                        {day.dayAbbr}
                      </span>
                      {isToday && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-primary-600">
                          I dag
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {totalCount > 0 && (
                      <span className="text-[11px] font-medium text-neutral-400">
                        {totalCount} {totalCount === 1 ? 'hendelse' : 'hendelser'}
                      </span>
                    )}
                    {onAddEventForDay && (
                      <button
                        type="button"
                        onClick={() => onAddEventForDay(day.date)}
                        aria-label={`Legg til hendelse ${day.dayLabel}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-[15px] font-semibold leading-none text-white shadow-card transition hover:bg-primary-700 active:scale-95"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── All-day events ── */}
              {day.allDayEvents?.length > 0 && (
                <div className="-mx-4 mb-2">
                  <AllDayRow
                    events={day.allDayEvents}
                    selectedDate={day.date}
                    onSelectEvent={(ev) => {
                      const anchorDate = (ev.metadata as any)?.__anchorDate as string | undefined ?? day.date
                      onSelectEvent(ev, anchorDate)
                    }}
                  />
                </div>
              )}

              {/* ── Timed events ── */}
              {events.length === 0 && !day.allDayEvents?.length ? (
                <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
                  <span className="text-[13px] text-neutral-400">Ingen hendelser denne dagen.</span>
                </div>
              ) : events.length === 0 ? null : (
                <div className="space-y-2">
                  {events.map((e) => {
                    const card = (
                      <SynkaEventCard
                        key={e.id}
                        event={e}
                        people={people}
                        date={day.date}
                        onClick={() => onSelectEvent(e, day.date)}
                      />
                    )

                    return onDeleteEvent ? (
                      <SwipeableEventRow
                        key={e.id}
                        onDelete={() => onDeleteEvent(e, day.date)}
                      >
                        {card}
                      </SwipeableEventRow>
                    ) : (
                      <div key={e.id}>{card}</div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
