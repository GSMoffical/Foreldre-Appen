import type { Event } from '../types'
import type { WeekDayLayout } from '../hooks/useScheduleState'
import { formatTimeRange } from '../lib/time'
import { useFamily } from '../context/FamilyContext'
import { formatParticipantNamesLine, getParticipantPeople } from '../lib/eventParticipants'
import { ParticipantAvatarStrip } from './ParticipantAvatarStrip'
import { SwipeableEventRow } from './SwipeableEventRow'

interface WeeklyListProps {
  weekLayoutData: WeekDayLayout[]
  onSelectEvent: (event: Event, date: string) => void
  onDeleteEvent?: (event: Event, date: string) => void
  /** Optional: move an event from one date to another (YYYY-MM-DD). */
  onMoveEvent?: (event: Event, fromDate: string, toDate: string) => void | Promise<void>
}

function dayHeaderLabel(_date: string, dayAbbr: string, dateStr: string): { day: string; num: string } {
  const d = new Date(dateStr + 'T12:00:00')
  return { day: dayAbbr, num: String(d.getDate()) }
}

export function WeeklyList({ weekLayoutData, onSelectEvent, onDeleteEvent, onMoveEvent }: WeeklyListProps) {
  const { people } = useFamily()
  return (
    <div className="relative isolate min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto px-4 scrollbar-none">
      <div className="space-y-5 pb-6">
        {weekLayoutData.map((day) => {
          const { day: dAbbr, num } = dayHeaderLabel(day.date, day.dayAbbr, day.date)
          const events = [...day.events].sort((a, b) => a.start.localeCompare(b.start))

          return (
            <section key={day.date} aria-label={`${day.dayLabel} list`}>
              <div className="sticky top-0 z-10 -mx-4 px-4 pb-2 pt-3 bg-surface/95 backdrop-blur">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                      {dAbbr}
                    </span>
                    <span className="text-[18px] font-bold tabular-nums text-zinc-900">
                      {num}
                    </span>
                  </div>
                  <span className="text-[12px] font-medium text-zinc-500">
                    {events.length} {events.length === 1 ? 'aktivitet' : 'aktiviteter'}
                  </span>
                </div>
              </div>

              {events.length === 0 ? (
                <div className="rounded-card border border-zinc-100 bg-white px-4 py-3 text-[13px] text-zinc-500 shadow-soft">
                  Ingen aktiviteter.
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((e) => {
                    const plist = getParticipantPeople(e, people)
                    const accent = plist[0]?.colorAccent ?? 'rgb(113 113 122)'
                    const tint = plist[0]?.colorTint ?? 'white'
                    const namesLine = formatParticipantNamesLine(e, people)

                    const card = (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onSelectEvent(e, day.date)}
                        className="w-full overflow-hidden rounded-card text-left shadow-soft transition-shadow hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
                        style={{
                          backgroundColor: tint,
                          borderLeftWidth: 6,
                          borderLeftColor: accent,
                        }}
                      >
                        <div className="flex items-start gap-3 px-4 py-3">
                          <div className="shrink-0 pt-0.5 text-[12px] font-semibold tabular-nums text-zinc-700">
                            {e.start}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <ParticipantAvatarStrip people={plist} className="pt-0.5" />
                              <span className="min-w-0 truncate text-[14px] font-semibold text-zinc-900">
                                {e.title}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[12px] font-medium text-zinc-600">
                                {formatTimeRange(e.start, e.end)}
                              </span>
                              {namesLine !== 'Ukjent' && (
                                <span className="text-[11px] font-medium text-zinc-500">· {namesLine}</span>
                              )}
                              {e.location && (
                                <span className="text-[12px] text-zinc-600">
                                  {e.location}
                                </span>
                              )}
                              {onMoveEvent && (
                                <button
                                  type="button"
                                  onClick={async (ev) => {
                                    ev.stopPropagation()
                                    const target = window.prompt(
                                      'Flytt denne aktiviteten til hvilken dato? (ÅÅÅÅ-MM-DD)',
                                      day.date
                                    )
                                    if (!target) return
                                    await Promise.resolve(onMoveEvent(e, day.date, target))
                                  }}
                                  className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100"
                                >
                                  Flytt…
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
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
