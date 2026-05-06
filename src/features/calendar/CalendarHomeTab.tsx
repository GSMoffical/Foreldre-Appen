import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { FamilyFilterBar } from '../../components/FamilyFilterBar'
import { SearchBar } from '../../components/SearchBar'
import { WeekStrip } from '../../components/WeekStrip'
import { CalendarDayNote } from '../../components/CalendarDayNote'
import { ScheduleLoadingSkeleton } from '../../components/ScheduleLoadingSkeleton'
import { EmptyState } from '../../components/EmptyState'
import { WeeklyList } from '../../components/WeeklyList'
import { TimelineContainer } from '../../components/TimelineContainer'
import { AllDayRow } from '../../components/AllDayRow'
import { SynkaTodayHero } from '../../components/SynkaTodayHero'
import { SynkaNextUpCard } from '../../components/SynkaNextUpCard'
import { springSnappy } from '../../lib/motion'
import { logEvent } from '../../lib/appLogger'
import { COPY } from '../../lib/norwegianCopy'
import { formatCalendarPeriodContextLabel, todayKeyOslo } from '../../lib/osloCalendar'
import { useFamily } from '../../context/FamilyContext'
import { SynkaWordmark } from '../../components/ui/SynkaLogo'
import type { Event, Task, PersonId, TimelineLayoutItem, GapInfo } from '../../types'
import type { SaveFeedbackState } from '../app/hooks/useSaveFeedback'
import type { WeekDayLayout } from '../../hooks/useScheduleState'

interface CalendarHomeTabProps {
  selectedPersonIds: PersonId[]
  setSelectedPersonIds: (ids: PersonId[]) => void
  mePersonId: string | null | undefined
  openAddEvent: (dateOverride?: string | null) => void
  weekLayoutData: WeekDayLayout[]
  setSelectedDate: (date: string) => void
  selectedDate: string
  handleSelectEvent: (event: Event, date: string) => void
  handleChangeWeek: (deltaWeeks: number) => void
  handleJumpToToday: () => void
  saveFeedback: SaveFeedbackState
  reducedMotion: boolean
  weekEventsLoading: boolean
  showNoFamilyEmpty: boolean
  showListView: boolean
  hasAnyWeekEvents: boolean
  isWeekFilteredEmpty: boolean
  isDayFilteredEmpty: boolean
  layoutItems: TimelineLayoutItem[]
  backgroundLayoutItems: TimelineLayoutItem[]
  gaps: GapInfo[]
  onSelectBackgroundEvent: (event: Event) => void
  onDragReschedule: (eventId: string, times: { prevStart: string; prevEnd: string; nextStart: string; nextEnd: string }) => Promise<void>
  onDeleteWeeklyEvent: (event: Event, date: string) => Promise<void>
  openAddTask: () => void
  taskCountByDate: Record<string, number>
  dayTasks: Task[]
  allDayEvents: Event[]
}

export function CalendarHomeTab({
  selectedPersonIds,
  setSelectedPersonIds,
  mePersonId,
  openAddEvent,
  weekLayoutData,
  setSelectedDate,
  selectedDate,
  handleSelectEvent,
  handleChangeWeek,
  handleJumpToToday,
  saveFeedback,
  reducedMotion,
  weekEventsLoading,
  showNoFamilyEmpty,
  showListView,
  hasAnyWeekEvents,
  isWeekFilteredEmpty,
  isDayFilteredEmpty,
  layoutItems,
  backgroundLayoutItems,
  gaps,
  onSelectBackgroundEvent,
  onDragReschedule,
  onDeleteWeeklyEvent,
  openAddTask,
  taskCountByDate,
  dayTasks,
  allDayEvents,
}: CalendarHomeTabProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const { people } = useFamily()

  const openTasksWithPerson = useMemo(() =>
    dayTasks
      .filter((t) => !t.completedAt)
      .sort((a, b) => (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'))
      .map((t) => ({
        task: t,
        person: people.find((p) => p.id === (t.childPersonId ?? t.assignedToPersonId)),
      })),
    [dayTasks, people]
  )

  useEffect(() => {
    if (searchOpen) logEvent('search_opened', {})
  }, [searchOpen])

  const periodContextLabel = useMemo(
    () => (weekLayoutData.length > 0 ? formatCalendarPeriodContextLabel(selectedDate) : null),
    [selectedDate, weekLayoutData.length]
  )

  const todayKey = todayKeyOslo()
  const isViewingToday = selectedDate === todayKey

  /** Total event count for the selected day (timed + all-day) */
  const dayEventCount = useMemo(() => {
    const dayData = weekLayoutData.find((d) => d.date === selectedDate)
    return (dayData?.events.length ?? 0) + allDayEvents.length
  }, [weekLayoutData, selectedDate, allDayEvents])

  /** The next or current event for the selected day */
  const nextUpEvent = useMemo((): Event | null => {
    if (showListView) return null
    const dayData = weekLayoutData.find((d) => d.date === selectedDate)
    if (!dayData) return null
    const sorted = [...dayData.events].sort((a, b) => a.start.localeCompare(b.start))
    if (sorted.length === 0) return null
    if (!isViewingToday) return sorted[0]
    const now = new Date()
    const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return (
      sorted.find((e) => e.start <= t && e.end > t) ??
      sorted.find((e) => e.start > t) ??
      null
    )
  }, [weekLayoutData, selectedDate, showListView, isViewingToday])

  const nextUpLabel = useMemo((): string => {
    if (!isViewingToday || !nextUpEvent) return 'FØRSTE HENDELSE'
    const now = new Date()
    const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return nextUpEvent.start <= t && nextUpEvent.end > t ? 'NÅ' : 'NESTE OPP'
  }, [nextUpEvent, isViewingToday])

  return (
    <div className="relative flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden">

        {/* ══ 1. SLIM TOP BAR ══════════════════════════════════════════════ */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
          <SynkaWordmark variant="green" width={60} />
          <div className="flex items-center gap-2">
            {saveFeedback && (
              <motion.span
                initial={reducedMotion ? false : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={springSnappy}
                className={`text-[11px] font-semibold ${
                  saveFeedback === 'error'
                    ? 'text-semantic-red-500'
                    : saveFeedback === 'saving'
                      ? 'text-neutral-400'
                      : 'text-primary-600'
                }`}
              >
                {saveFeedback === 'saving'
                  ? COPY.feedback.saving
                  : saveFeedback === 'error'
                    ? COPY.feedback.saveFailed
                    : '✓ lagret'}
              </motion.span>
            )}
            {!searchOpen && (
              <SearchBar
                open={false}
                onOpenChange={setSearchOpen}
                weekLayoutData={weekLayoutData}
                onJumpToDate={setSelectedDate}
                onSelectEvent={handleSelectEvent}
              />
            )}
          </div>
        </div>

        {searchOpen && (
          <div className="px-3 pb-2">
            <SearchBar
              open={true}
              onOpenChange={setSearchOpen}
              weekLayoutData={weekLayoutData}
              onJumpToDate={setSelectedDate}
              onSelectEvent={handleSelectEvent}
            />
          </div>
        )}

        {/* ══ 2. DAY HERO ══════════════════════════════════════════════════ */}
        <SynkaTodayHero
          selectedDate={selectedDate}
          isToday={isViewingToday}
          eventCount={dayEventCount}
          openTaskCount={openTasksWithPerson.length}
          onAddEvent={() => openAddEvent()}
          onAddTask={() => openAddTask()}
          addEventId="onb-add-event"
          addTaskId="onb-add-task"
        />

        {/* ══ 3. NEXT UP CARD (day-view only, overlaps hero bottom) ════════ */}
        {!showListView && nextUpEvent && !weekEventsLoading && (
          <div className="relative z-10 -mt-4 px-4">
            <SynkaNextUpCard
              event={nextUpEvent}
              people={people}
              onClick={() => handleSelectEvent(nextUpEvent, selectedDate)}
              label={nextUpLabel}
            />
          </div>
        )}

        {/* ══ 4. FAMILY FILTER BAR ═════════════════════════════════════════ */}
        <FamilyFilterBar
          selectedPersonIds={selectedPersonIds}
          onFilterChange={setSelectedPersonIds}
          mePersonId={mePersonId}
        />

        {/* ══ 5. WEEK STRIP + NAV (arrows flank the strip) ════════════════ */}
        <div className="flex items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => handleChangeWeek(-1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-card transition hover:bg-neutral-50 active:scale-95 touch-manipulation"
            aria-label="Forrige uke"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 19.5-7.5-7.5 7.5-7.5" />
            </svg>
          </button>

          <div id="onb-week-strip" className="min-w-0 flex-1">
            <WeekStrip
              days={weekLayoutData}
              selectedDate={selectedDate}
              onSelectDay={setSelectedDate}
              loading={weekEventsLoading}
              taskCountByDate={taskCountByDate}
            />
          </div>

          <button
            type="button"
            onClick={() => handleChangeWeek(1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-card transition hover:bg-neutral-50 active:scale-95 touch-manipulation"
            aria-label="Neste uke"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* I dag jump + period label — slim row beneath week strip */}
        <div className="flex items-center justify-between px-3 pb-1">
          <button
            id="onb-jump-today"
            type="button"
            onClick={handleJumpToToday}
            aria-label="Hopp til i dag"
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition active:scale-95 touch-manipulation ${
              isViewingToday
                ? 'bg-primary-600 text-white shadow-[0_2px_6px_rgba(29,90,63,0.3)]'
                : 'border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'
            }`}
          >
            I dag
          </button>
          {periodContextLabel && (
            <span className="text-[11px] font-medium text-neutral-400">{periodContextLabel}</span>
          )}
        </div>

        {/* ══ 6. DAY NOTE + TASKS + ALL-DAY EVENTS ════════════════════════ */}
        <CalendarDayNote date={selectedDate} />

        {openTasksWithPerson.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-3 pb-1.5 pt-0.5">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-400" aria-hidden>Gjøremål</span>
            {openTasksWithPerson.map(({ task, person }) => (
              <div
                key={task.id}
                className="flex shrink-0 items-center gap-1.5 rounded-pill border px-2.5 py-1 text-caption font-medium"
                style={person ? {
                  backgroundColor: person.colorTint,
                  borderColor: person.colorAccent,
                  color: '#14211b',
                } : {
                  backgroundColor: '#fbedc1',
                  borderColor: '#c69a35',
                  color: '#14211b',
                }}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: person?.colorAccent ?? '#fbbf24' }}
                />
                {task.dueTime && (
                  <span className="font-semibold" style={{ color: person?.colorAccent ?? '#d97706' }}>
                    {task.dueTime}
                  </span>
                )}
                <span className="max-w-[110px] truncate">{task.title}</span>
              </div>
            ))}
          </div>
        )}

        {!showListView && allDayEvents.length > 0 && (
          <AllDayRow
            events={allDayEvents}
            selectedDate={selectedDate}
            onSelectEvent={(event) => {
              const anchorDate = (event.metadata as any)?.__anchorDate as string | undefined ?? selectedDate
              handleSelectEvent(event, anchorDate)
            }}
          />
        )}

        {/* ══ 7. MAIN CONTENT ══════════════════════════════════════════════ */}
        <div id="onb-timeline" className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden">

          {weekEventsLoading ? (
            <ScheduleLoadingSkeleton />
          ) : showNoFamilyEmpty ? (
            <EmptyState context="day" variant="no_family" />
          ) : showListView ? (
            hasAnyWeekEvents ? (
              <WeeklyList
                weekLayoutData={weekLayoutData}
                onSelectEvent={handleSelectEvent}
                onDeleteEvent={(event, date) => onDeleteWeeklyEvent(event, date)}
                onAddEventForDay={(date) => openAddEvent(date)}
              />
            ) : isWeekFilteredEmpty ? (
              <EmptyState context="week" variant="filtered" />
            ) : (
              <EmptyState context="week" onAddEvent={() => openAddEvent()} />
            )
          ) : layoutItems.length > 0 || backgroundLayoutItems.length > 0 ? (
            <TimelineContainer
              layoutItems={layoutItems}
              backgroundLayoutItems={backgroundLayoutItems}
              gaps={gaps}
              selectedDate={selectedDate}
              onSelectEvent={(event) => handleSelectEvent(event, selectedDate)}
              onSelectBackgroundEvent={onSelectBackgroundEvent}
              onDragReschedule={(eventId, times) => onDragReschedule(eventId, times)}
              dayTasks={dayTasks}
            />
          ) : isDayFilteredEmpty ? (
            <EmptyState context="day" variant="filtered" />
          ) : (
            <EmptyState context="day" onAddEvent={() => openAddEvent()} />
          )}
        </div>
      </div>
    </div>
  )
}
