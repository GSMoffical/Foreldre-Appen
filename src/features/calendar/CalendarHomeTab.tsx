import { useState, useEffect, useMemo } from 'react'
import { IconCalendarPlus, IconCheckbox } from '@tabler/icons-react'
import { motion, AnimatePresence } from 'framer-motion'
import { FamilyFilterBar } from '../../components/FamilyFilterBar'
import { SearchBar } from '../../components/SearchBar'
import { WeekStrip } from '../../components/WeekStrip'
import { CalendarDayNote } from '../../components/CalendarDayNote'
import { ScheduleLoadingSkeleton } from '../../components/ScheduleLoadingSkeleton'
import { EmptyState } from '../../components/EmptyState'
import { WeeklyList } from '../../components/WeeklyList'
import { calendarUnspecifiedTimeLabel } from '../../lib/schedule'
import { TimelineContainer } from '../../components/TimelineContainer'
import { AllDayRow } from '../../components/AllDayRow'
import { springSnappy } from '../../lib/motion'
import { logEvent } from '../../lib/appLogger'
import { formatCalendarPeriodContextLabel, todayKeyOslo } from '../../lib/osloCalendar'
import { useFamily } from '../../context/FamilyContext'
import { usePermissions } from '../../hooks/usePermissions'
import type { Event, Task, PersonId, TimelineLayoutItem, GapInfo } from '../../types'
import type { WeekDayLayout } from '../../hooks/useScheduleState'
import { STORAGE_KEYS } from '../../lib/constants'

const FILTER_STORAGE_KEY = STORAGE_KEYS.FILTER_PERSON_IDS
const FIRST_OPEN_KEY = STORAGE_KEYS.FIRST_OPEN
const INVITE_BANNER_DISMISSED_KEY = STORAGE_KEYS.INVITE_BANNER_DISMISSED

function formatFullDate(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00')
  const label = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

interface CalendarHomeTabProps {
  selectedPersonIds: PersonId[]
  setSelectedPersonIds: (ids: PersonId[]) => void
  mePersonId: string | null | undefined
  openAddEvent: (dateOverride?: string | null) => void
  weekLayoutData: WeekDayLayout[]
  setSelectedDate: (date: string) => void
  selectedDate: string
  handleSelectEvent: (event: Event, date: string) => void
  handleChangeWeek?: (deltaWeeks: number) => void
  reducedMotion?: boolean
  weekEventsLoading: boolean
  showNoFamilyEmpty: boolean
  showListView: boolean
  setShowListView: (v: boolean) => void
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
  onSelectTask: (task: Task) => void
  allDayEvents: Event[]
  unspecifiedEvents: Event[]
  highlightedEventIds?: Set<string>
  onOpenMer?: () => void
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
  reducedMotion,
  weekEventsLoading,
  showNoFamilyEmpty,
  showListView,
  setShowListView,
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
  onSelectTask,
  allDayEvents,
  unspecifiedEvents,
  highlightedEventIds,
  onOpenMer,
}: CalendarHomeTabProps) {
  const [showTodayPanel, setShowTodayPanel] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [inviteBannerDismissed, setInviteBannerDismissed] = useState(() => {
    try { return localStorage.getItem(INVITE_BANNER_DISMISSED_KEY) === '1' } catch { return false }
  })
  const { people } = useFamily()
  const { isGuest } = usePermissions()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PersonId[]
        if (Array.isArray(parsed)) setSelectedPersonIds(parsed)
      }
    } catch {}
    try {
      if (!localStorage.getItem(FIRST_OPEN_KEY)) {
        localStorage.setItem(FIRST_OPEN_KEY, Date.now().toString())
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(selectedPersonIds))
    } catch {}
  }, [selectedPersonIds])

  useEffect(() => {
    if (people.length === 0) return
    const validIds = new Set(people.map((p) => p.id))
    const filtered = selectedPersonIds.filter((id) => validIds.has(id))
    if (filtered.length !== selectedPersonIds.length) {
      setSelectedPersonIds(filtered)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people])

  const calendarTasksWithPerson = useMemo(
    () =>
      dayTasks
        .slice()
        .sort((a, b) => {
          const ac = a.completedAt ? 1 : 0
          const bc = b.completedAt ? 1 : 0
          if (ac !== bc) return ac - bc
          return (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99')
        })
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

  const hasLinkedPartner = people.some((p) => p.memberKind === 'parent' && !!p.linkedAuthUserId)
  let showInviteBanner = false
  if (!inviteBannerDismissed && !hasLinkedPartner) {
    try {
      const firstOpen = localStorage.getItem(FIRST_OPEN_KEY)
      showInviteBanner = !!firstOpen && Date.now() - parseInt(firstOpen, 10) > 24 * 60 * 60 * 1000
    } catch {}
  }

  const todayKey = todayKeyOslo()
  const todayDayData = weekLayoutData.find((d) => d.date === todayKey)
  const todayEvents = todayDayData?.events ?? []
  const todayOpenTasks = selectedDate === todayKey ? dayTasks.filter((t) => !t.completedAt) : []
  const todayHasData = todayEvents.length > 0 || todayOpenTasks.length > 0

  return (
    <div className="relative flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden pb-4">
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden">
        {/* HEADER — bg + shadow separates from timeline */}
        <div
          className="bg-synkaCream shadow-[0_1px_0_rgba(26,46,59,0.08)]"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* ROW 1 — top utility bar */}
          {searchOpen ? (
            <div className="flex items-center px-4 pt-2 pb-0">
              <SearchBar
                open={true}
                onOpenChange={setSearchOpen}
                weekLayoutData={weekLayoutData}
                onJumpToDate={setSelectedDate}
                onSelectEvent={handleSelectEvent}
              />
            </div>
          ) : (
            <div className="px-4 pt-2 pb-0 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleChangeWeek?.(-1)}
                  aria-label="Forrige uke"
                  className="flex w-7 h-7 items-center justify-center rounded-full bg-synkaNavy/8 text-synkaNavy/50 text-[14px] touch-manipulation hover:bg-synkaNavy/12 transition"
                >
                  ‹
                </button>
                <span className="text-caption font-semibold text-synkaNavy/50 uppercase tracking-wide px-0.5">
                  {periodContextLabel ?? ''}
                </span>
                <button
                  type="button"
                  onClick={() => handleChangeWeek?.(1)}
                  aria-label="Neste uke"
                  className="flex w-7 h-7 items-center justify-center rounded-full bg-synkaNavy/8 text-synkaNavy/50 text-[14px] touch-manipulation hover:bg-synkaNavy/12 transition"
                >
                  ›
                </button>
              </div>
              <div className="flex items-center gap-2">
                <SearchBar
                  open={false}
                  onOpenChange={setSearchOpen}
                  weekLayoutData={weekLayoutData}
                  onJumpToDate={setSelectedDate}
                  onSelectEvent={handleSelectEvent}
                />
                {!isGuest && (
                <div className="relative">
                  <button
                    id="onb-add-event"
                    type="button"
                    onClick={() => setShowAddMenu((v) => !v)}
                    aria-label="Legg til"
                    className="flex w-8 h-8 items-center justify-center rounded-full bg-synkaPrimary text-white text-[20px] font-light touch-manipulation hover:bg-synkaPrimaryDark active:scale-95 transition"
                  >
                    +
                  </button>
                  <AnimatePresence>
                    {showAddMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowAddMenu(false)}
                          aria-hidden
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 4 }}
                          transition={{ duration: 0.12 }}
                          className="absolute top-10 right-0 z-50 w-64 overflow-hidden rounded-xl border border-synkaNavy/8 bg-white shadow-lg"
                        >
                          <motion.button
                            type="button"
                            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={reducedMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut', delay: 0 }}
                            onClick={() => { openAddEvent(); setShowAddMenu(false) }}
                            className="flex w-full items-center gap-3 px-4 py-3 active:bg-synkaCream/80 touch-manipulation"
                          >
                            <div className="w-8 h-8 shrink-0 rounded-lg bg-synkaPrimary/10 flex items-center justify-center text-synkaPrimary">
                              <IconCalendarPlus size={20} aria-hidden />
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="text-body font-semibold text-synkaNavy">Hendelse</p>
                              <p className="text-caption text-synkaNavy/50">Legg til i kalenderen</p>
                            </div>
                          </motion.button>
                          <div className="border-t border-synkaNavy/6" />
                          <motion.button
                            id="onb-add-task"
                            type="button"
                            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={reducedMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut', delay: 0.06 }}
                            onClick={() => { openAddTask(); setShowAddMenu(false) }}
                            className="flex w-full items-center gap-3 px-4 py-3 active:bg-synkaCream/80 touch-manipulation"
                          >
                            <div className="w-8 h-8 shrink-0 rounded-lg bg-synkaTeal/15 flex items-center justify-center text-synkaTeal">
                              <IconCheckbox size={20} aria-hidden />
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="text-body font-semibold text-synkaNavy">Gjøremål</p>
                              <p className="text-caption text-synkaNavy/50">Noe som må huskes</p>
                            </div>
                          </motion.button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                )}
              </div>
            </div>
          )}

          {/* ROW 2 — week strip */}
          <div id="onb-week-strip">
            <WeekStrip
              days={weekLayoutData}
              selectedDate={selectedDate}
              onSelectDay={setSelectedDate}
              loading={weekEventsLoading}
              taskCountByDate={taskCountByDate}
            />
          </div>

          {/* DIVIDER */}
          <div className="border-t border-synkaNavy/8" />

          {/* ROW 3 — filter chips */}
          <FamilyFilterBar
            selectedPersonIds={selectedPersonIds}
            onFilterChange={(ids) => setSelectedPersonIds(ids.length === people.length ? [] : ids)}
            mePersonId={mePersonId}
          />

          {/* DIVIDER */}
          <div className="border-t border-synkaNavy/8" />

          {showInviteBanner && (
            <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="min-w-0 flex-1 text-caption text-synkaNavy/80">Inviter partneren din til Synka</p>
              <button
                type="button"
                onClick={() => onOpenMer?.()}
                className="shrink-0 rounded-pill bg-emerald-600 px-3 py-1 text-caption font-semibold text-white touch-manipulation"
              >
                Inviter
              </button>
              <button
                type="button"
                onClick={() => {
                  setInviteBannerDismissed(true)
                  try { localStorage.setItem(INVITE_BANNER_DISMISSED_KEY, '1') } catch {}
                }}
                aria-label="Skjul banner"
                className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-synkaNavy/40 hover:bg-synkaNavy/8 text-[14px] leading-none touch-manipulation"
              >
                ×
              </button>
            </div>
          )}

          {/* ROW 4 — date label + Dag/Uke toggle */}
          <div className="px-4 py-1.5 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-synkaNavy">
              {formatFullDate(selectedDate)}
            </span>
            <div className="flex items-center bg-synkaNavy/8 rounded-pill p-[2px]">
              <button
                type="button"
                onClick={() => setShowListView(false)}
                className={`px-3 py-1 text-caption rounded-pill transition touch-manipulation ${
                  !showListView
                    ? 'bg-white text-synkaPrimary font-semibold'
                    : 'text-synkaNavy/40'
                }`}
              >
                Dag
              </button>
              <button
                type="button"
                onClick={() => setShowListView(true)}
                className={`px-3 py-1 text-caption rounded-pill transition touch-manipulation ${
                  showListView
                    ? 'bg-white text-synkaPrimary font-semibold'
                    : 'text-synkaNavy/40'
                }`}
              >
                Uke
              </button>
            </div>
          </div>
        </div>

        <CalendarDayNote date={selectedDate} />
        {todayHasData && (
          <div className="px-4 pb-1">
            <button
              type="button"
              onClick={() => setShowTodayPanel((v) => !v)}
              className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left transition hover:bg-zinc-50"
            >
              <span className="text-caption font-semibold uppercase tracking-wider text-zinc-400">I dag</span>
              <span className="min-w-0 flex-1 truncate text-caption text-zinc-400">
                {todayEvents.length > 0 && `${todayEvents.length} ${todayEvents.length === 1 ? 'hendelse' : 'hendelser'}`}
                {todayEvents.length > 0 && todayOpenTasks.length > 0 && ' · '}
                {todayOpenTasks.length > 0 && (
                  <span className="text-synkaNavy/70">{todayOpenTasks.length} gjøremål</span>
                )}
              </span>
              <motion.svg
                animate={{ rotate: showTodayPanel ? 180 : 0 }}
                transition={springSnappy}
                className="h-3 w-3 shrink-0 text-zinc-300"
                fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </motion.svg>
            </button>
            <AnimatePresence>
              {showTodayPanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 px-1 pb-2 pt-0.5">
                    {todayEvents.length > 0 && (
                      <div className="space-y-1">
                        {todayEvents.map((e) => (
                          <div key={e.id} className="flex items-center gap-2">
                            <span className="shrink-0 tabular-nums text-caption text-zinc-400">{e.start}–{e.end}</span>
                            <span className="min-w-0 truncate text-label font-medium text-zinc-800">{e.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {todayOpenTasks.length > 0 && (
                      <div className="space-y-1">
                        {todayOpenTasks.map((t) => (
                          <div key={t.id} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-sm bg-synkaYellow" />
                            {t.dueTime && (
                              <span className="shrink-0 tabular-nums text-caption font-semibold text-synkaNavy/70">{t.dueTime}</span>
                            )}
                            <span className="min-w-0 truncate text-label font-medium text-zinc-800">{t.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {calendarTasksWithPerson.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-4 pb-1.5 pt-0.5">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-400" aria-hidden>Gjøremål</span>
            {calendarTasksWithPerson.map(({ task, person }) => (
              <button
                key={task.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectTask(task)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelectTask(task)
                  }
                }}
                aria-label={`Åpne gjøremål: ${task.title}`}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-pill border px-2.5 py-1 text-caption font-medium text-synkaNavy/70 transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-synkaYellow/60 focus:ring-offset-1 touch-manipulation ${
                  task.completedAt ? 'opacity-75' : ''
                } ${!person ? 'bg-synkaYellow/20 border-synkaYellow/60' : ''}`}
                style={person ? {
                  backgroundColor: person.colorTint,
                  borderColor: person.colorAccent,
                } : undefined}
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
                <span className={`max-w-[110px] truncate ${task.completedAt ? 'line-through' : ''}`}>{task.title}</span>
              </button>
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
        {!showListView && unspecifiedEvents.length > 0 && (
          <div className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50/70 px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Uspesifiserte hendelser
            </p>
            <ul className="mt-1.5 space-y-1">
              {unspecifiedEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    className={`w-full text-left text-caption hover:text-zinc-900 ${
                      highlightedEventIds?.has(event.id) ? 'rounded-md bg-synkaTeal/10 px-1 py-0.5 text-zinc-900' : 'text-zinc-700'
                    }`}
                    onClick={() => {
                      const anchorDate = (event.metadata as any)?.__anchorDate as string | undefined ?? selectedDate
                      handleSelectEvent(event, anchorDate)
                    }}
                  >
                    <span className="font-medium text-zinc-500">
                      {calendarUnspecifiedTimeLabel(event.metadata)}
                    </span>
                    <span className="mx-1 text-zinc-400">·</span>
                    <span className="font-medium">{event.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
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
              onSelectTask={onSelectTask}
              highlightedEventIds={highlightedEventIds}
            />
          ) : unspecifiedEvents.length > 0 ? (
            <div className="flex-1" />
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
