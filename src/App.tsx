import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AppShell } from './components/AppShell'
import { MobileFrame } from './components/MobileFrame'
import { BottomNav } from './components/BottomNav'
import { AuthScreen } from './components/AuthScreen'
import { FamilyFilterBar } from './components/FamilyFilterBar'
import { WeekStrip } from './components/WeekStrip'
import { TimelineContainer } from './components/TimelineContainer'
import { WeeklyList } from './components/WeeklyList'
import { EventDetailSheet } from './components/EventDetailSheet'
import { AddEventSheet } from './components/AddEventSheet'
import { EditEventSheet } from './components/EditEventSheet'
import { EmptyState } from './components/EmptyState'
import { ScheduleLoadingSkeleton } from './components/ScheduleLoadingSkeleton'
import { SettingsScreen } from './components/SettingsScreen'
import { SearchBar } from './components/SearchBar'
import { MonthView } from './components/MonthView'
import { LogisticsScreen } from './components/LogisticsScreen'
import { BackgroundDetailSheet } from './components/BackgroundDetailSheet'
import type { NavTab } from './components/BottomNav'
import { useScheduleState } from './hooks/useScheduleState'
import { useAutoFillWeek } from './hooks/useAutoFillWeek'
import { useFamily } from './context/FamilyContext'
import type { Event } from './types'
import { REPEAT_INTERVAL_DAYS } from './components/AddEventSheet'
import { useAuth } from './context/AuthContext'
import { useEffectiveUserId } from './context/EffectiveUserIdContext'
import { useUserPreferences } from './context/UserPreferencesContext'
import { triggerLightHaptic } from './lib/haptics'
import { useReminders } from './hooks/useReminders'
import { useResolvedMePersonId } from './hooks/useResolvedMePersonId'
import { acceptInvite } from './lib/inviteApi'
import { AppNotice } from './components/AppNotice'
import { springSnappy } from './lib/motion'
import { useUndo } from './context/UndoContext'
import { useTimeOfDaySurface } from './hooks/useTimeOfDaySurface'
import { CalendarDayNote } from './components/CalendarDayNote'
import { TodayActionStrip } from './components/TodayActionStrip'
import { DailyStatusLine } from './components/DailyStatusLine'
import { WeeklyCheckCard } from './components/WeeklyCheckCard'
import { shiftTime, parseTime } from './lib/time'
import { getEventParticipantIds, getNowMinutes, isToday } from './lib/schedule'
import { startUxTimer, endUxTimer, logUxMetric } from './lib/uxMetrics'
import { COPY } from './lib/norwegianCopy'
import { addCalendarDaysOslo, todayKeyOslo } from './lib/osloCalendar'
import {
  countResolvableCollisions,
  hasTimeOverlap,
  isResolvableBackgroundCollision,
} from './lib/collisions'

function App() {
  useTimeOfDaySurface()
  const { showUndo } = useUndo()
  const reducedMotion = useReducedMotion() ?? false
  const { user, loading } = useAuth()
  const { refetch: refetchEffectiveUserId } = useEffectiveUserId()
  const { error: familyError, people, loading: familyLoading } = useFamily()
  const {
    selectedDate,
    setSelectedDate,
    selectedPersonIds,
    setSelectedPersonIds,
    showListView,
    setShowListView,
    visibleEvents,
    layoutItems,
    backgroundLayoutItems,
    gaps,
    weekLayoutData,
    selectedEvent,
    setSelectedEvent,
    addEvent,
    addRecurring,
    updateEvent,
    deleteEvent,
    updateAllInSeries,
    deleteAllInSeries,
    purgePersonEvents,
    weekEventsLoading,
    clearAllEvents,
    scheduleError,
    clearScheduleError,
    dayEvents,
    reminderEvents,
    osloTodayDateKey,
    daySummary,
    hasRawEventsInWeek,
    getVisibleEventsForDate,
    prefetchEventsForDateRange,
  } = useScheduleState()
  useReminders(reminderEvents, osloTodayDateKey)
  const [isAdding, setIsAdding] = useState(false)
  const [addFlowSaved, setAddFlowSaved] = useState(false)
  /** When set, AddEventSheet targets this date (e.g. måned → langt trykk) instead of selectedDate */
  const [addEventDateOverride, setAddEventDateOverride] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<{ event: Event; date: string; scope: 'this' | 'all' } | null>(null)
  const [selectedBackgroundEvent, setSelectedBackgroundEvent] = useState<{ event: Event; date: string } | null>(null)
  const [navTab, setNavTab] = useState<NavTab>('today')
  const [hideTodayActionStrip, setHideTodayActionStrip] = useState(false)
  const [showCompletedToday, setShowCompletedToday] = useState(false)
  const [showAllCompletedToday, setShowAllCompletedToday] = useState(false)
  const { currentPersonId, hapticsEnabled } = useUserPreferences()
  const mePersonId = useResolvedMePersonId(people, currentPersonId, user?.id)

  const handleMonthRangePrefetch = useCallback(
    (start: string, end: string) => {
      void prefetchEventsForDateRange(start, end)
    },
    [prefetchEventsForDateRange]
  )
  const [saveFeedback, setSaveFeedback] = useState<'saving' | 'saved' | 'error' | null>(null)
  const saveFeedbackTimeoutRef = useRef<number | null>(null)
  const [inviteNotice, setInviteNotice] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)
  const [inviteProcessing, setInviteProcessing] = useState(false)
  const [hideFamilyBanner, setHideFamilyBanner] = useState(false)
  const previousSelectedDateRef = useRef(selectedDate)

  const unresolvedConflictCount = useMemo(() => {
    return countResolvableCollisions(
      backgroundLayoutItems.map((i) => i.block),
      visibleEvents
    )
  }, [backgroundLayoutItems, visibleEvents])
  const completedEvents = useMemo(
    () =>
      [...visibleEvents]
        .filter((e) => Boolean(e.metadata?.completedAt))
        .sort((a, b) => a.start.localeCompare(b.start)),
    [visibleEvents]
  )

  const visibleActionableEvents = useMemo(
    () =>
      [...visibleEvents]
        .filter((e) => !e.metadata?.completedAt)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [visibleEvents]
  )
  const nextEvent = useMemo(() => {
    if (visibleActionableEvents.length === 0) return null
    if (!isToday(selectedDate)) return visibleActionableEvents[0]
    const now = getNowMinutes()
    return visibleActionableEvents.find((e) => parseTime(e.end) >= now) ?? null
  }, [visibleActionableEvents, selectedDate])
  const nextEventMinutesUntil = useMemo(() => {
    if (!nextEvent || !isToday(selectedDate)) return daySummary.minutesUntilNext
    return Math.max(0, parseTime(nextEvent.start) - getNowMinutes())
  }, [nextEvent, selectedDate, daySummary.minutesUntilNext])
  const nextEventParticipantIds = nextEvent ? getEventParticipantIds(nextEvent) : []
  const nextEventConflictCount = useMemo(
    () =>
      nextEvent
        ? backgroundLayoutItems.reduce((count, item) => {
            const backgroundEvent = item.block
            if (!isResolvableBackgroundCollision(backgroundEvent)) return count
            if (!hasTimeOverlap(backgroundEvent.start, backgroundEvent.end, nextEvent.start, nextEvent.end)) {
              return count
            }
            if (!nextEventParticipantIds.includes(backgroundEvent.personId)) return count
            return count + 1
          }, 0)
        : 0,
    [nextEvent, backgroundLayoutItems, nextEventParticipantIds]
  )
  const nextEventHasConflict = nextEventConflictCount > 0
  const laterConflictCount = Math.max(0, unresolvedConflictCount - nextEventConflictCount)
  const weeklyCollisionCount = useMemo(
    () =>
      weekLayoutData.reduce((total, day) => {
        const dayCollisions = countResolvableCollisions(
          day.backgroundLayoutItems.map((i) => i.block),
          day.events
        )
        return total + dayCollisions
      }, 0),
    [weekLayoutData]
  )
  const weeklyActivityCount = useMemo(
    () => weekLayoutData.reduce((sum, day) => sum + day.events.length, 0),
    [weekLayoutData]
  )

  const showSaveFeedback = () => {
    triggerLightHaptic(hapticsEnabled)
    if (saveFeedbackTimeoutRef.current) window.clearTimeout(saveFeedbackTimeoutRef.current)
    setSaveFeedback('saved')
    saveFeedbackTimeoutRef.current = window.setTimeout(() => {
      setSaveFeedback(null)
      saveFeedbackTimeoutRef.current = null
    }, 2000)
  }

  const showSavingFeedback = () => {
    if (saveFeedbackTimeoutRef.current) {
      window.clearTimeout(saveFeedbackTimeoutRef.current)
      saveFeedbackTimeoutRef.current = null
    }
    setSaveFeedback('saving')
  }

  const showSaveError = () => {
    if (saveFeedbackTimeoutRef.current) window.clearTimeout(saveFeedbackTimeoutRef.current)
    setSaveFeedback('error')
    saveFeedbackTimeoutRef.current = window.setTimeout(() => {
      setSaveFeedback(null)
      saveFeedbackTimeoutRef.current = null
    }, 3000)
  }

  useAutoFillWeek({
    week: weekLayoutData,
    addEvent,
    addRecurring,
    clearAllEvents,
  })

  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('invite')
    if (!token) return
    let cancelled = false
    setInviteProcessing(true)
    acceptInvite(token).then((result) => {
      if (cancelled) return
      params.delete('invite')
      const newSearch = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''))
      window.localStorage.removeItem('invite-member-kind')
      if (result.ok) {
        void refetchEffectiveUserId()
        setInviteNotice({ variant: 'success', message: 'Du er nå koblet til familien.' })
      } else {
        setInviteNotice({
          variant: 'error',
          message: result.error ?? 'Kunne ikke godta invitasjonen.',
        })
      }
      setInviteProcessing(false)
    })
    return () => {
      cancelled = true
      setInviteProcessing(false)
    }
  }, [user?.id, refetchEffectiveUserId])

  useEffect(() => {
    setHideFamilyBanner(false)
  }, [familyError])

  useEffect(() => {
    if (inviteNotice?.variant !== 'success') return
    const t = window.setTimeout(() => setInviteNotice(null), 6000)
    return () => window.clearTimeout(t)
  }, [inviteNotice])

  useEffect(() => {
    const previous = previousSelectedDateRef.current
    if (previous !== selectedDate && isToday(previous) && unresolvedConflictCount > 0) {
      logUxMetric('unresolved_conflicts_end_of_day', unresolvedConflictCount)
    }
    if (previous !== selectedDate && isToday(selectedDate)) {
      setHideTodayActionStrip(false)
    }
    previousSelectedDateRef.current = selectedDate
  }, [selectedDate, unresolvedConflictCount])

  useEffect(() => {
    if (completedEvents.length === 0 && showCompletedToday) {
      setShowCompletedToday(false)
    }
    if (completedEvents.length <= 5) {
      setShowAllCompletedToday(false)
    }
  }, [completedEvents.length, showCompletedToday])

  if (loading) {
    return (
      <AppShell>
        <MobileFrame>
          <div className="flex h-full w-full min-w-0 max-w-full flex-col items-center justify-center gap-3 overflow-x-hidden text-zinc-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
            <p className="text-sm">Loading…</p>
          </div>
        </MobileFrame>
      </AppShell>
    )
  }

  if (!user) {
    return (
      <AppShell>
        <MobileFrame>
          <AuthScreen />
        </MobileFrame>
      </AppShell>
    )
  }

  const handleSelectEvent = (event: Event, date: string) => {
    if (event.metadata?.calendarLayer === 'background') return
    setSelectedEvent({ event, date })
  }

  const shiftSelectedDateByDays = (days: number) => {
    setSelectedDate((prev) => addCalendarDaysOslo(prev, days))
  }

  const handleChangeWeek = (deltaWeeks: number) => {
    shiftSelectedDateByDays(deltaWeeks * 7)
  }

  const handleJumpToToday = () => {
    const today = todayKeyOslo()
    setSelectedDate(today)
    setNavTab('today')
    setShowListView(false)
    setHideTodayActionStrip(false)
  }

  const openAddEvent = (dateOverride: string | null = null) => {
    startUxTimer('add_event_flow')
    setAddFlowSaved(false)
    setAddEventDateOverride(dateOverride)
    setIsAdding(true)
  }

  const hasAnyWeekEvents = weekLayoutData.some((d) => d.events.length > 0)
  const isDayFilteredEmpty =
    !weekEventsLoading &&
    !showListView &&
    dayEvents.length > 0 &&
    visibleEvents.length === 0 &&
    selectedPersonIds.length > 0
  const isWeekFilteredEmpty =
    !weekEventsLoading && showListView && hasRawEventsInWeek && !hasAnyWeekEvents
  const showNoFamilyEmpty = !familyLoading && people.length === 0
  const effectiveNav: NavTab = navTab === 'settings' ? 'settings' : navTab === 'logistics' ? 'logistics' : navTab === 'month' ? 'month' : showListView ? 'week' : 'today'

  return (
    <AppShell>
      <MobileFrame>
        <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden">
          <div className="shrink-0 space-y-2 px-3 pt-2">
            {inviteNotice && (
              <AppNotice
                variant={inviteNotice.variant === 'success' ? 'success' : 'error'}
                onDismiss={() => setInviteNotice(null)}
              >
                {inviteNotice.message}
              </AppNotice>
            )}
            {inviteProcessing && (
              <AppNotice variant="info">
                Behandler invitasjon...
              </AppNotice>
            )}
            {scheduleError && (
              <AppNotice variant="error" onDismiss={clearScheduleError}>
                {scheduleError}
              </AppNotice>
            )}
            {familyError && !hideFamilyBanner && (
              <AppNotice variant="warning" onDismiss={() => setHideFamilyBanner(true)}>
                {familyError}
              </AppNotice>
            )}
          </div>
          <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden">
          {navTab === 'settings' ? (
            <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
              <SettingsScreen
                onPersonRemoved={purgePersonEvents}
                onClearAllEvents={clearAllEvents}
              />
            </div>
          ) : navTab === 'month' ? (
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
            <MonthView
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(date)
              }}
              hasEventsOnDate={(date) => getVisibleEventsForDate(date).length > 0}
              getEventsForDate={getVisibleEventsForDate}
              onVisibleMonthRange={handleMonthRangePrefetch}
              onAddEventForDate={(date) => {
                openAddEvent(date)
              }}
              onSelectEvent={(event, date) => {
                setSelectedDate(date)
                setSelectedEvent({ event, date })
                setNavTab('today')
                setShowListView(false)
              }}
            />
            </div>
          ) : navTab === 'logistics' ? (
            <LogisticsScreen
              weekLayoutData={weekLayoutData}
              loading={weekEventsLoading}
              mePersonId={mePersonId}
              onJumpToEvent={(date, event) => {
                setSelectedDate(date)
                setSelectedEvent({ event, date })
                setNavTab('today')
                setShowListView(false)
              }}
              onAssignTransport={(date, event, role, personId) => {
                startUxTimer('reassign_participant_flow')
                const prevMeta = event.metadata ?? {}
                const prevTransport = prevMeta.transport ?? {}
                const nextTransport =
                  role === 'dropoff'
                    ? { ...prevTransport, dropoffBy: personId ?? undefined }
                    : { ...prevTransport, pickupBy: personId ?? undefined }
                const nextMetadata = { ...prevMeta, transport: nextTransport }
                showSavingFeedback()
                void updateEvent(date, event.id, { metadata: nextMetadata })
                  .then(() => {
                    endUxTimer('reassign_participant_flow', 'time_to_reassign_participant_ms')
                    showSaveFeedback()
                  })
                  .catch(() => {
                    showSaveError()
                  })
              }}
              onChangeWeek={handleChangeWeek}
            />
          ) : (
            <div className="mt-3 flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden px-3 pb-4">
              <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden">
              <FamilyFilterBar
                selectedPersonIds={selectedPersonIds}
                onFilterChange={setSelectedPersonIds}
                mePersonId={mePersonId}
              />
              <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    openAddEvent()
                  }}
                  className="shrink-0 rounded-full bg-brandTeal px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-planner transition hover:brightness-95 active:translate-y-px active:shadow-planner-press focus:outline-none focus:ring-2 focus:ring-brandTeal focus:ring-offset-2"
                >
                  + Legg til
                </button>
                <div className="min-w-0 flex-1">
                  <SearchBar
                    weekLayoutData={weekLayoutData}
                    onJumpToDate={setSelectedDate}
                    onSelectEvent={handleSelectEvent}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between px-4 pt-1 pb-1 text-[12px] gap-2 flex-wrap">
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => handleChangeWeek(-1)}
                    className="rounded-full border-2 border-brandNavy/15 bg-white px-3 py-1 font-medium text-brandNavy shadow-planner-sm transition hover:bg-brandSky/40 active:translate-y-px active:shadow-planner-press"
                  >
                    ‹ Forrige uke
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeWeek(1)}
                    className="rounded-full border-2 border-brandNavy/15 bg-white px-3 py-1 font-medium text-brandNavy shadow-planner-sm transition hover:bg-brandSky/40 active:translate-y-px active:shadow-planner-press"
                  >
                    Neste uke ›
                  </button>
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="rounded-full border-2 border-brandNavy/15 bg-white px-3 py-1 font-medium text-brandNavy shadow-planner-sm transition hover:bg-brandSky/40 active:translate-y-px active:shadow-planner-press"
                  >
                    Gå til i dag
                  </button>
                </div>
                {saveFeedback && (
                  <motion.span
                    initial={reducedMotion ? false : { scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={springSnappy}
                    className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${
                      saveFeedback === 'error'
                        ? 'text-rose-700'
                        : saveFeedback === 'saving'
                          ? 'text-zinc-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {saveFeedback !== 'saving' && (
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                    {saveFeedback === 'saving'
                      ? COPY.feedback.saving
                      : saveFeedback === 'error'
                        ? COPY.feedback.saveFailed
                        : COPY.feedback.saved}
                  </motion.span>
                )}
              </div>
              <WeekStrip
                days={weekLayoutData}
                selectedDate={selectedDate}
                onSelectDay={setSelectedDate}
                loading={weekEventsLoading}
              />
              <WeeklyCheckCard totalActivities={weeklyActivityCount} collisionCount={weeklyCollisionCount} />
              <CalendarDayNote date={selectedDate} />
              <DailyStatusLine
                unresolvedCollisionCount={unresolvedConflictCount}
                remainingCount={visibleActionableEvents.length}
                completedCount={completedEvents.length}
              />
              {!hideTodayActionStrip && (
                <TodayActionStrip
                  nextEvent={nextEvent}
                  minutesUntilNext={nextEventMinutesUntil}
                  nextEventHasConflict={nextEventHasConflict}
                  laterConflictCount={laterConflictCount}
                  moveActionLabel={nextEvent ? `Flytt til i morgen (${nextEvent.start})` : COPY.actions.moveTomorrow}
                  onDismiss={() => setHideTodayActionStrip(true)}
                  onOpenNext={() => {
                    if (!nextEvent) return
                    setSelectedEvent({ event: nextEvent, date: selectedDate })
                  }}
                  onMarkDone={async () => {
                    if (!nextEvent) return
                    showSavingFeedback()
                    try {
                      const previousMetadata = nextEvent.metadata ?? {}
                      const nextMetadata = {
                        ...previousMetadata,
                        completedAt: new Date().toISOString(),
                      }
                      await updateEvent(selectedDate, nextEvent.id, { metadata: nextMetadata })
                      showUndo({
                        message: 'Aktivitet markert som ferdig',
                        onUndo: async () => {
                          await updateEvent(selectedDate, nextEvent.id, { metadata: previousMetadata })
                        },
                      })
                      showSaveFeedback()
                    } catch {
                      showSaveError()
                    }
                  }}
                  onConfirmNext={async () => {
                    if (!nextEvent) return
                    showSavingFeedback()
                    try {
                      const previousMetadata = nextEvent.metadata ?? {}
                      const nextMetadata = {
                        ...previousMetadata,
                        confirmedAt: new Date().toISOString(),
                      }
                      await updateEvent(selectedDate, nextEvent.id, { metadata: nextMetadata })
                      showUndo({
                        message: 'Aktivitet bekreftet',
                        onUndo: async () => {
                          await updateEvent(selectedDate, nextEvent.id, { metadata: previousMetadata })
                        },
                      })
                      showSaveFeedback()
                    } catch {
                      showSaveError()
                    }
                  }}
                  onDelayNext={async () => {
                    if (!nextEvent) return
                    showSavingFeedback()
                    try {
                      await updateEvent(selectedDate, nextEvent.id, {
                        start: shiftTime(nextEvent.start, 15),
                        end: shiftTime(nextEvent.end, 15),
                      })
                      showUndo({
                        message: 'Aktivitet utsatt 15 min',
                        onUndo: async () => {
                          await updateEvent(selectedDate, nextEvent.id, {
                            start: nextEvent.start,
                            end: nextEvent.end,
                          })
                        },
                      })
                      showSaveFeedback()
                    } catch {
                      showSaveError()
                    }
                  }}
                  onMoveNext={async () => {
                    if (!nextEvent) return
                    showSavingFeedback()
                    try {
                      const tomorrow = addCalendarDaysOslo(selectedDate, 1)
                      await updateEvent(selectedDate, nextEvent.id, {}, tomorrow)
                      showUndo({
                        message: 'Aktivitet flyttet til i morgen',
                        onUndo: async () => {
                          await updateEvent(tomorrow, nextEvent.id, {}, selectedDate)
                        },
                      })
                      showSaveFeedback()
                    } catch {
                      showSaveError()
                    }
                  }}
                />
              )}
              {completedEvents.length > 0 && (
                <div className="mx-4 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompletedToday((v) => !v)
                      if (showCompletedToday) setShowAllCompletedToday(false)
                    }}
                    className="min-h-9 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700"
                  >
                    {showCompletedToday
                      ? `Skjul ferdige (${completedEvents.length})`
                      : `Vis ferdige (${completedEvents.length})`}
                  </button>
                  {showCompletedToday && (
                    <div className="mt-2 space-y-1.5 rounded-card border border-zinc-200 bg-white p-2.5">
                      {(showAllCompletedToday ? completedEvents : completedEvents.slice(0, 5)).map((e) => (
                        <div key={e.id} className="flex items-center justify-between gap-2">
                          <p className="text-[12px] text-zinc-600">
                            {e.start} {e.title}
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              showSavingFeedback()
                              try {
                                const nextMetadata = { ...(e.metadata ?? {}) }
                                delete nextMetadata.completedAt
                                await updateEvent(selectedDate, e.id, { metadata: nextMetadata })
                                showSaveFeedback()
                              } catch {
                                showSaveError()
                              }
                            }}
                            className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700"
                          >
                            Angre ferdig
                          </button>
                        </div>
                      ))}
                      {completedEvents.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllCompletedToday((v) => !v)}
                          className="min-h-9 w-full rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700"
                        >
                          {showAllCompletedToday
                            ? 'Vis færre ferdige'
                            : `Vis alle ferdige (${completedEvents.length})`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden">
                {weekEventsLoading ? (
                  <ScheduleLoadingSkeleton />
                ) : showNoFamilyEmpty ? (
                  <EmptyState context="day" variant="no_family" />
                ) : showListView ? (
                  hasAnyWeekEvents ? (
                    <WeeklyList
                      weekLayoutData={weekLayoutData}
                      onSelectEvent={handleSelectEvent}
                      onDeleteEvent={async (event, date) => {
                        const snapshot = { ...event }
                        showSavingFeedback()
                        try {
                          await deleteEvent(date, event.id)
                          showUndo({
                            message: `"${snapshot.title}" ble slettet`,
                            onUndo: async () => {
                              const { id: _id, ...rest } = snapshot
                              await addEvent(date, rest)
                            },
                          })
                          showSaveFeedback()
                        } catch {
                          showSaveError()
                        }
                      }}
                      onMoveEvent={async (event, fromDate, toDate) => {
                        showSavingFeedback()
                        try {
                          await updateEvent(fromDate, event.id, {}, toDate)
                          showUndo({
                            message: 'Aktivitet flyttet',
                            onUndo: async () => {
                              await updateEvent(toDate, event.id, {}, fromDate)
                            },
                          })
                          showSaveFeedback()
                        } catch {
                          showSaveError()
                        }
                      }}
                    />
                  ) : isWeekFilteredEmpty ? (
                    <EmptyState context="week" variant="filtered" />
                  ) : (
                    <EmptyState
                      context="week"
                      onAddEvent={() => {
                        openAddEvent()
                      }}
                    />
                  )
                ) : layoutItems.length > 0 || backgroundLayoutItems.length > 0 ? (
                  <TimelineContainer
                    layoutItems={layoutItems}
                    backgroundLayoutItems={backgroundLayoutItems}
                    gaps={gaps}
                    selectedDate={selectedDate}
                    onSelectEvent={(e) => handleSelectEvent(e, selectedDate)}
                    onSelectBackgroundEvent={(e) => {
                      startUxTimer('resolve_conflict_flow')
                      setSelectedEvent(null)
                      setSelectedBackgroundEvent({ event: e, date: selectedDate })
                    }}
                    onDragReschedule={async (eventId, times) => {
                      showSavingFeedback()
                      try {
                        await updateEvent(selectedDate, eventId, {
                          start: times.nextStart,
                          end: times.nextEnd,
                        })
                        showUndo({
                          message: 'Tid endret',
                          onUndo: async () => {
                            await updateEvent(selectedDate, eventId, {
                              start: times.prevStart,
                              end: times.prevEnd,
                            })
                          },
                        })
                        showSaveFeedback()
                      } catch {
                        showSaveError()
                      }
                    }}
                  />
                ) : isDayFilteredEmpty ? (
                  <EmptyState context="day" variant="filtered" />
                ) : (
                  <EmptyState
                  context="day"
                  onAddEvent={() => {
                    openAddEvent()
                  }}
                />
                )}
              </div>
              </div>
            </div>
          )}
          </div>

          <BottomNav
            active={effectiveNav}
            onSelect={(tab) => {
              setNavTab(tab)
              if (tab === 'week') setShowListView(true)
              if (tab === 'today') setShowListView(false)
            }}

          />
        </div>
      </MobileFrame>

      <AnimatePresence>
        {selectedEvent && (
          <EventDetailSheet
            key={selectedEvent.event.id}
            event={selectedEvent.event}
            date={selectedEvent.date}
            onClose={() => setSelectedEvent(null)}
            onDuplicate={async (targetDate, start, end) => {
              const { event } = selectedEvent
              if (!event) return
              showSavingFeedback()
              try {
                const { id: _id, ...rest } = event
                await addEvent(targetDate, { ...rest, start, end })
                showSaveFeedback()
              } catch {
                showSaveError()
              }
            }}
            onEdit={(scope) => {
              setEditingEvent({ ...selectedEvent, scope })
              setSelectedEvent(null)
            }}
            onDelete={async (scope) => {
              showSavingFeedback()
              try {
                if (scope === 'all' && selectedEvent.event.recurrenceGroupId) {
                  await deleteAllInSeries(selectedEvent.event.recurrenceGroupId)
                  showSaveFeedback()
                  return
                }
                const ev = { ...selectedEvent.event }
                const date = selectedEvent.date
                await deleteEvent(date, ev.id)
                showUndo({
                  message: `"${ev.title}" ble slettet`,
                  onUndo: async () => {
                    const { id: _id, ...rest } = ev
                    await addEvent(date, rest)
                  },
                })
                showSaveFeedback()
              } catch {
                showSaveError()
              }
            }}
          />
        )}
        {selectedBackgroundEvent && (
          <BackgroundDetailSheet
            event={selectedBackgroundEvent.event}
            date={selectedBackgroundEvent.date}
            foregroundEvents={dayEvents}
            onResolveConflict={async (decision) => {
              showSavingFeedback()
              try {
                const previousResolutions = (selectedBackgroundEvent.event.metadata?.conflictResolution ?? []) as unknown[]
                const nextResolution = {
                  ...decision,
                  resolvedAt: new Date().toISOString(),
                }
                const nextMetadata = {
                  ...(selectedBackgroundEvent.event.metadata ?? {}),
                  conflictResolution: [...previousResolutions, nextResolution],
                }
                await updateEvent(selectedBackgroundEvent.date, selectedBackgroundEvent.event.id, { metadata: nextMetadata })
                endUxTimer('resolve_conflict_flow', 'time_to_resolve_conflict_ms')
                showSaveFeedback()
              } catch {
                showSaveError()
              }
            }}
            onClose={() => setSelectedBackgroundEvent(null)}
          />
        )}
        {isAdding && (
          <AddEventSheet
            key={`add-${addEventDateOverride ?? selectedDate}`}
            date={addEventDateOverride ?? selectedDate}
            onSave={async (data, options) => {
              const targetDate = addEventDateOverride ?? selectedDate
              showSavingFeedback()
              try {
                if (options && options.repeat !== 'none' && options.endDate) {
                  const interval = REPEAT_INTERVAL_DAYS[options.repeat]
                  await addRecurring(targetDate, options.endDate, interval, data)
                } else {
                  await addEvent(targetDate, data)
                }
                setAddFlowSaved(true)
                endUxTimer('add_event_flow', 'time_to_add_event_ms')
                showSaveFeedback()
              } catch {
                showSaveError()
              }
            }}
            onClose={() => {
              if (!addFlowSaved) logUxMetric('flow_backtracks', 1)
              setIsAdding(false)
              setAddEventDateOverride(null)
            }}
          />
        )}
        {editingEvent && (
          <EditEventSheet
            key={`edit-${editingEvent.event.id}`}
            event={editingEvent.event}
            date={editingEvent.date}
            onSave={async (data, newDate) => {
              showSavingFeedback()
              try {
                if (editingEvent.scope === 'all' && editingEvent.event.recurrenceGroupId) {
                  // For nå oppdaterer vi transport kun på denne forekomsten,
                  // ikke hele serien.
                  const { metadata: _metadata, ...rest } = data
                  await updateAllInSeries(editingEvent.event.recurrenceGroupId, rest)
                } else {
                  await updateEvent(editingEvent.date, editingEvent.event.id, data, newDate)
                }
                setEditingEvent(null)
                showSaveFeedback()
              } catch {
                showSaveError()
              }
            }}
            onClose={() => setEditingEvent(null)}
          />
        )}
      </AnimatePresence>
    </AppShell>
  )
}

export default App
