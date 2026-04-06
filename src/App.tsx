import { useState, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { AppShell } from './components/AppShell'
import { MobileFrame } from './components/MobileFrame'
import { BottomNav } from './components/BottomNav'
import { AuthScreen } from './components/AuthScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { MonthView } from './components/MonthView'
import { LogisticsScreen } from './components/LogisticsScreen'
import type { NavTab } from './components/BottomNav'
import { useScheduleState } from './hooks/useScheduleState'
import { useAutoFillWeek } from './hooks/useAutoFillWeek'
import { useFamily } from './context/FamilyContext'
import type { Event } from './types'
import { useAuth } from './context/AuthContext'
import { useEffectiveUserId } from './context/EffectiveUserIdContext'
import { useUserPreferences } from './context/UserPreferencesContext'
import { useReminders } from './hooks/useReminders'
import { useResolvedMePersonId } from './hooks/useResolvedMePersonId'
import { useUndo } from './context/UndoContext'
import { useTimeOfDaySurface } from './hooks/useTimeOfDaySurface'
import { shiftTime } from './lib/time'
import { startUxTimer, endUxTimer, logUxMetric } from './lib/uxMetrics'
import { addCalendarDaysOslo, todayKeyOslo } from './lib/osloCalendar'
import { useSaveFeedback } from './features/app/hooks/useSaveFeedback'
import { useInviteAcceptance } from './features/invites/hooks/useInviteAcceptance'
import { AppNoticeStack } from './features/app/components/AppNoticeStack'
import { useCalendarDerivedState } from './features/calendar/hooks/useCalendarDerivedState'
import { CalendarHomeTab } from './features/calendar/CalendarHomeTab'
import { CalendarOverlays } from './features/calendar/CalendarOverlays'

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
  const { currentPersonId, hapticsEnabled } = useUserPreferences()
  const mePersonId = useResolvedMePersonId(people, currentPersonId, user?.id)

  const handleMonthRangePrefetch = useCallback(
    (start: string, end: string) => {
      void prefetchEventsForDateRange(start, end)
    },
    [prefetchEventsForDateRange]
  )
  const [hideFamilyBanner, setHideFamilyBanner] = useState(false)
  const { saveFeedback, showSaveFeedback, showSavingFeedback, showSaveError } = useSaveFeedback(hapticsEnabled)
  const { inviteNotice, setInviteNotice, inviteProcessing } = useInviteAcceptance({
    userId: user?.id,
    onAccepted: refetchEffectiveUserId,
  })
  const {
    unresolvedConflictCount,
    completedEvents,
    visibleActionableEvents,
    nextEvent,
    nextEventMinutesUntil,
    nextEventHasConflict,
    laterConflictCount,
    weeklyCollisionCount,
    weeklyActivityCount,
    hideTodayActionStrip,
    setHideTodayActionStrip,
    showCompletedToday,
    setShowCompletedToday,
    showAllCompletedToday,
    setShowAllCompletedToday,
  } = useCalendarDerivedState({
    selectedDate,
    visibleEvents,
    backgroundLayoutItems,
    weekLayoutData,
    daySummary,
  })

  useAutoFillWeek({
    week: weekLayoutData,
    addEvent,
    addRecurring,
    clearAllEvents,
  })

  useEffect(() => {
    setHideFamilyBanner(false)
  }, [familyError])

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
          <AppNoticeStack
            inviteNotice={inviteNotice}
            onDismissInvite={() => setInviteNotice(null)}
            inviteProcessing={inviteProcessing}
            scheduleError={scheduleError}
            onDismissScheduleError={clearScheduleError}
            familyError={familyError}
            hideFamilyBanner={hideFamilyBanner}
            onDismissFamilyError={() => setHideFamilyBanner(true)}
          />
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
            <CalendarHomeTab
              selectedPersonIds={selectedPersonIds}
              setSelectedPersonIds={setSelectedPersonIds}
              mePersonId={mePersonId}
              openAddEvent={openAddEvent}
              weekLayoutData={weekLayoutData}
              setSelectedDate={setSelectedDate}
              selectedDate={selectedDate}
              handleSelectEvent={handleSelectEvent}
              handleChangeWeek={handleChangeWeek}
              handleJumpToToday={handleJumpToToday}
              saveFeedback={saveFeedback}
              reducedMotion={reducedMotion}
              weeklyActivityCount={weeklyActivityCount}
              weeklyCollisionCount={weeklyCollisionCount}
              unresolvedConflictCount={unresolvedConflictCount}
              visibleActionableCount={visibleActionableEvents.length}
              completedCount={completedEvents.length}
              hideTodayActionStrip={hideTodayActionStrip}
              setHideTodayActionStrip={setHideTodayActionStrip}
              nextEvent={nextEvent}
              nextEventMinutesUntil={nextEventMinutesUntil}
              nextEventHasConflict={nextEventHasConflict}
              laterConflictCount={laterConflictCount}
              onOpenNextEvent={() => {
                if (!nextEvent) return
                setSelectedEvent({ event: nextEvent, date: selectedDate })
              }}
              onMarkNextDone={async () => {
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
              completedEvents={completedEvents}
              showCompletedToday={showCompletedToday}
              setShowCompletedToday={setShowCompletedToday}
              showAllCompletedToday={showAllCompletedToday}
              setShowAllCompletedToday={setShowAllCompletedToday}
              onUndoComplete={async (event) => {
                showSavingFeedback()
                try {
                  const nextMetadata = { ...(event.metadata ?? {}) }
                  delete nextMetadata.completedAt
                  await updateEvent(selectedDate, event.id, { metadata: nextMetadata })
                  showSaveFeedback()
                } catch {
                  showSaveError()
                }
              }}
              weekEventsLoading={weekEventsLoading}
              showNoFamilyEmpty={showNoFamilyEmpty}
              showListView={showListView}
              hasAnyWeekEvents={hasAnyWeekEvents}
              isWeekFilteredEmpty={isWeekFilteredEmpty}
              isDayFilteredEmpty={isDayFilteredEmpty}
              layoutItems={layoutItems}
              backgroundLayoutItems={backgroundLayoutItems}
              gaps={gaps}
              onSelectBackgroundEvent={(event) => {
                startUxTimer('resolve_conflict_flow')
                setSelectedEvent(null)
                setSelectedBackgroundEvent({ event, date: selectedDate })
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
              onDeleteWeeklyEvent={async (event, date) => {
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
              onMoveWeeklyEvent={async (event, fromDate, toDate) => {
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

      <CalendarOverlays
        selectedEvent={selectedEvent}
        setSelectedEvent={setSelectedEvent}
        selectedBackgroundEvent={selectedBackgroundEvent}
        setSelectedBackgroundEvent={setSelectedBackgroundEvent}
        dayEvents={dayEvents}
        isAdding={isAdding}
        selectedDate={selectedDate}
        addEventDateOverride={addEventDateOverride}
        addFlowSaved={addFlowSaved}
        setAddFlowSaved={setAddFlowSaved}
        setIsAdding={setIsAdding}
        setAddEventDateOverride={setAddEventDateOverride}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEvent}
        addEvent={addEvent}
        addRecurring={addRecurring}
        updateEvent={updateEvent}
        updateAllInSeries={updateAllInSeries}
        deleteEvent={deleteEvent}
        deleteAllInSeries={deleteAllInSeries}
        showSavingFeedback={showSavingFeedback}
        showSaveFeedback={showSaveFeedback}
        showSaveError={showSaveError}
        showUndo={showUndo}
        onAddFlowSaved={() => endUxTimer('add_event_flow', 'time_to_add_event_ms')}
        onAddFlowClosedWithoutSave={() => logUxMetric('flow_backtracks', 1)}
        onConflictResolved={() => endUxTimer('resolve_conflict_flow', 'time_to_resolve_conflict_ms')}
      />
    </AppShell>
  )
}

export default App
