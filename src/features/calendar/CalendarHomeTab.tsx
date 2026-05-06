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

  const selectedDateLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00')
    const day = d.getDate()
    const month = d.toLocaleDateString('nb-NO', { month: 'long' })
    const dayName = d.toLocaleDateString('nb-NO', { weekday: 'long' })
    return { day, month, dayName }
  }, [selectedDate])

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

  return (
    <div className="relative flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden">

        {/* ── Screen Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <SynkaWordmark variant="green" width={64} />
          <div className="flex items-center gap-2">
            {saveFeedback && (
              <motion.span
                initial={reducedMotion ? false : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={springSnappy}
                className={`text-[11px] font-semibold ${
                  saveFeedback === 'error' ? 'text-semantic-red-500' : saveFeedback === 'saving' ? 'text-neutral-400' : 'text-primary-600'
                }`}
              >
                {saveFeedback === 'saving' ? COPY.feedback.saving : saveFeedback === 'error' ? COPY.feedback.saveFailed : '✓ lagret'}
              </motion.span>
            )}
            {searchOpen ? null : (
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

        {/* ── Date headline ── */}
        <div className="flex items-center gap-2.5 px-4 pb-1 pt-0">
          <span className="font-display text-[24px] font-bold capitalize leading-tight text-neutral-700">
            {selectedDateLabel.day}. {selectedDateLabel.month}
          </span>
          {isViewingToday && (
            <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
              I dag
            </span>
          )}
          {periodContextLabel && (
            <span className="ml-auto text-[11px] font-medium text-neutral-400">
              {periodContextLabel}
            </span>
          )}
        </div>

        {/* Family filter */}
        <FamilyFilterBar
          selectedPersonIds={selectedPersonIds}
          onFilterChange={setSelectedPersonIds}
          mePersonId={mePersonId}
        />

        {/* ── Controls row ── */}
        {searchOpen ? (
          <div className="flex items-center px-3 pb-1.5 pt-0.5">
            <SearchBar
              open={true}
              onOpenChange={setSearchOpen}
              weekLayoutData={weekLayoutData}
              onJumpToDate={setSelectedDate}
              onSelectEvent={handleSelectEvent}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-0.5">
            {/* Week nav */}
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
            <button
              id="onb-jump-today"
              type="button"
              onClick={handleJumpToToday}
              aria-label="Hopp til i dag"
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition active:scale-95 touch-manipulation ${
                isViewingToday
                  ? 'bg-primary-600 text-white shadow-[0_2px_8px_rgba(29,90,63,0.3)]'
                  : 'border border-neutral-200 bg-white text-neutral-500 shadow-card hover:bg-neutral-50'
              }`}
            >
              I dag
            </button>
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

            {/* Add actions */}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                id="onb-add-task"
                type="button"
                onClick={() => openAddTask()}
                className="shrink-0 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-600 shadow-card transition hover:border-primary-300 hover:text-primary-700 active:scale-95 focus:outline-none touch-manipulation"
              >
                + Gjøremål
              </button>
              <button
                id="onb-add-event"
                type="button"
                onClick={() => openAddEvent()}
                className="shrink-0 rounded-full bg-primary-600 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(29,90,63,0.3)] transition hover:bg-primary-700 active:scale-95 focus:outline-none touch-manipulation"
              >
                + Hendelse
              </button>
            </div>
          </div>
        )}
        <div id="onb-week-strip">
          <WeekStrip
            days={weekLayoutData}
            selectedDate={selectedDate}
            onSelectDay={setSelectedDate}
            loading={weekEventsLoading}
            taskCountByDate={taskCountByDate}
          />
        </div>
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
                  <span
                    className="font-semibold"
                    style={{ color: person?.colorAccent ?? '#d97706' }}
                  >
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
