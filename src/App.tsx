import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AppShell } from './components/AppShell'
import { MobileFrame } from './components/MobileFrame'
import { BottomNav } from './components/BottomNav'
import { AuthScreen } from './components/AuthScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { TasksScreen } from './components/TasksScreen'
import type { NavTab } from './components/BottomNav'
import { useScheduleState } from './hooks/useScheduleState'
import { useAutoFillWeek } from './hooks/useAutoFillWeek'
import { useFamily } from './context/FamilyContext'
import type { Event, Task, Person } from './types'
import { SectionDots } from './components/SectionDots'
import { useAuth } from './context/AuthContext'
import { useEffectiveUserId } from './context/EffectiveUserIdContext'
import { useUserPreferences } from './context/UserPreferencesContext'
import { useReminders } from './hooks/useReminders'
import { usePartnerNotify } from './hooks/usePartnerNotify'
import { useNotifications } from './hooks/useNotifications'
import { checkAndRecordNotify } from './lib/notifyPartner'
import { useResolvedMePersonId } from './hooks/useResolvedMePersonId'
import { useTimeOfDaySurface } from './hooks/useTimeOfDaySurface'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { startUxTimer, endUxTimer, logUxMetric } from './lib/uxMetrics'
import { logEvent } from './lib/appLogger'
import { addTankestromSentryBreadcrumb } from './lib/sentry'
import { addCalendarDaysOslo, todayKeyOslo } from './lib/osloCalendar'
import { useSaveFeedback } from './features/app/hooks/useSaveFeedback'
import { useInviteAcceptance } from './features/invites/hooks/useInviteAcceptance'
import { AppNoticeStack } from './features/app/components/AppNoticeStack'
import { CalendarHomeTab } from './features/calendar/CalendarHomeTab'
import { MerScreen } from './components/MerScreen'
import { CalendarOverlays } from './features/calendar/CalendarOverlays'
import { useEventController } from './features/calendar/hooks/useEventController'
import { useTasksState } from './hooks/useTasksState'
import { useTaskController } from './features/tasks/hooks/useTaskController'
import { DebugOverlay } from './components/DebugOverlay'
import { OnboardingTour } from './components/OnboardingTour'
import { loadOnboarding, saveOnboarding } from './lib/onboarding'
import { IconArrowLeft } from '@tabler/icons-react'
import type { TankestromImportSuccess } from './features/tankestrom/useTankestromImport'

const MonthView = lazy(() =>
  import('./components/MonthView').then((m) => ({ default: m.MonthView }))
)
const FamilieScreen = lazy(() =>
  import('./components/FamilieScreen').then((m) => ({ default: m.FamilieScreen }))
)
const HjelpScreen = lazy(() =>
  import('./components/HjelpScreen').then((m) => ({ default: m.HjelpScreen }))
)
const TankestrømPage = lazy(() =>
  import('./features/tankestrom/TankestrømPage').then((m) => ({ default: m.TankestrømPage }))
)
const TankestromImportDialog = lazy(() =>
  import('./features/tankestrom/TankestromImportDialog').then((m) => ({
    default: m.TankestromImportDialog,
  }))
)
const OnboardingFlow = lazy(() =>
  import('./features/onboarding/OnboardingFlow').then(m => ({ default: m.OnboardingFlow }))
)

/** Set to true to re-enable the onboarding tour. */
const ENABLE_ONBOARDING = true

function App() {
  useTimeOfDaySurface()
  const { isOnline } = useNetworkStatus()
  const reducedMotion = useReducedMotion() ?? false
  const { user, loading } = useAuth()
  const { refetch: refetchEffectiveUserId, isLinked, effectiveUserId } = useEffectiveUserId()
  const {
    error: familyError,
    people,
    loading: familyLoading,
    loaded: familyLoaded,
    updatePerson,
  } = useFamily()
  const {
    selectedDate,
    setSelectedDate,
    selectedPersonIds,
    setSelectedPersonIds,
    showListView,
    setShowListView,
    visibleEvents,
    allDayEventsForDay,
    unspecifiedEventsForDay,
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
    weekEventsLoading,
    clearAllEvents,
    scheduleError,
    clearScheduleError,
    dayEvents,
    reminderEvents,
    osloTodayDateKey,
    hasRawEventsInWeek,
    getVisibleEventsForDate,
    prefetchEventsForDateRange,
    getAnchoredForegroundEventsForMatching,
  } = useScheduleState()
  useReminders(reminderEvents, osloTodayDateKey)
  const hasLinkedPartner = people.some((p) => p.memberKind === 'parent' && !!p.linkedAuthUserId)

  const partnerAuthId = useMemo(() => {
    if (!hasLinkedPartner) return null
    if (isLinked) return effectiveUserId
    return people.find((p) => p.memberKind === 'parent' && !!p.linkedAuthUserId)?.linkedAuthUserId ?? null
  }, [hasLinkedPartner, isLinked, effectiveUserId, people])

  const { sendTaskNotify } = usePartnerNotify({
    effectiveUserId: hasLinkedPartner ? effectiveUserId : null,
    currentUserId: user?.id ?? null,
    partnerUserId: partnerAuthId,
  })

  const { notifications: inboxNotifications, unreadCount: inboxUnreadCount, markAllRead: markInboxRead, dismiss: dismissNotification } = useNotifications(user?.id ?? null)
  const [isAdding, setIsAdding] = useState(false)
  const [addFlowSaved, setAddFlowSaved] = useState(false)
  /** When set, AddEventSheet targets this date (e.g. måned → langt trykk) instead of selectedDate */
  const [addEventDateOverride, setAddEventDateOverride] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<{ event: Event; date: string; scope: 'this' | 'all' } | null>(null)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedBackgroundEvent, setSelectedBackgroundEvent] = useState<{ event: Event; date: string } | null>(null)
  const [navTab, setNavTab] = useState<NavTab>('today')
  const [merSubScreen, setMerSubScreen] = useState<'settings' | 'familie' | 'tankestrom' | 'hjelp' | null>(null)
  const { currentPersonId, hapticsEnabled } = useUserPreferences()
  const mePersonId = useResolvedMePersonId(people, currentPersonId, user?.id)

  const [hideFamilyBanner, setHideFamilyBanner] = useState(false)
  const [justReconnected, setJustReconnected] = useState(false)
  const [joinedPerson, setJoinedPerson] = useState<Person | null>(null)
  const seenLinkedIdsRef = useRef<Set<string>>(new Set())
  const familyInitializedRef = useRef(false)
  const [lastSaveType, setLastSaveType] = useState<'event' | 'other' | null>(null)
  const prevOnlineRef = useRef<boolean | null>(null)
  const [notifyToast, setNotifyToast] = useState<string | null>(null)
  const notifyToastTimerRef = useRef<number | null>(null)
  const [tankestromToast, setTankestromToast] = useState<{
    title: string
    detail: string
    variant: 'success' | 'warning'
    firstDate?: string
    highlightEventIds: string[]
    undoEvents?: Array<{ id: string; date: string }>
    showErrors?: string
    openTasks?: boolean
  } | null>(null)
  const tankestromToastTimerRef = useRef<number | null>(null)
  const [recentImportedEventIds, setRecentImportedEventIds] = useState<Set<string>>(new Set())
  const { saveFeedback, showSaveFeedback, showSavingFeedback, showSaveError } = useSaveFeedback(hapticsEnabled)
  const showSaveFeedbackForControllers = useCallback(() => { setLastSaveType('other'); showSaveFeedback() }, [showSaveFeedback])
  const { tasksByDate, addTask, patchTask, removeTask, prefetchTasksForRange } = useTasksState(selectedDate)

  const handleMonthRangePrefetch = useCallback(
    (start: string, end: string) => {
      void prefetchEventsForDateRange(start, end)
      void prefetchTasksForRange(start, end)
    },
    [prefetchEventsForDateRange, prefetchTasksForRange]
  )

  const monthViewEvents = useMemo<Record<string, Event[]>>(
    () =>
      new Proxy({} as Record<string, Event[]>, {
        get(_target, prop) {
          if (typeof prop === 'string') return getVisibleEventsForDate(prop) ?? []
          return undefined
        },
      }),
    [getVisibleEventsForDate]
  )

  const filteredTasksByDate = useMemo(() => {
    if (selectedPersonIds.length === 0) return tasksByDate
    const ids = new Set(selectedPersonIds)
    return Object.fromEntries(
      Object.entries(tasksByDate).map(([date, tasks]) => [
        date,
        tasks.filter(
          (t) =>
            (t.childPersonId != null && ids.has(t.childPersonId)) ||
            (t.assignedToPersonId != null && ids.has(t.assignedToPersonId))
        ),
      ])
    )
  }, [tasksByDate, selectedPersonIds])

  const calendarDayTasks = filteredTasksByDate[selectedDate] ?? []
  useEffect(() => {
    setSelectedTaskId(null)
  }, [selectedDate])
  useEffect(() => {
    if (!selectedTaskId) return
    if (!calendarDayTasks.some((t) => t.id === selectedTaskId)) {
      setSelectedTaskId(null)
    }
  }, [selectedTaskId, calendarDayTasks])

  const taskController = useTaskController({
    addTask,
    patchTask,
    removeTask,
    showSavingFeedback,
    showSaveFeedback: showSaveFeedbackForControllers,
    showSaveError,
  })
  const controller = useEventController({
    addEvent,
    addRecurring,
    updateEvent,
    deleteEvent,
    updateAllInSeries,
    deleteAllInSeries,
    showSavingFeedback,
    showSaveFeedback: showSaveFeedbackForControllers,
    showSaveError,
  })

  const dismissTankestromToast = useCallback(() => {
    if (tankestromToastTimerRef.current != null) {
      window.clearTimeout(tankestromToastTimerRef.current)
      tankestromToastTimerRef.current = null
    }
    setTankestromToast(null)
  }, [])

  const openTankestromToast = useCallback((payload: {
    success: TankestromImportSuccess
    partial: boolean
    failureMessage?: string
  }) => {
    const { success, partial, failureMessage } = payload
    if (
      success.createdEvents.length === 0 &&
      success.updatedEvents.length === 0 &&
      success.createdTasks.length === 0
    ) {
      if (import.meta.env.DEV) { console.warn('[Tankestrom import toast skipped: empty success payload]') }
      return
    }
    const firstEvent = [...success.createdEvents, ...success.updatedEvents]
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    const firstDate = firstEvent?.date
    const createdEventCount = success.createdEvents.length
    const createdTaskCount = success.createdTasks.length
    const promisedEvents = success.promisedForegroundEventCount ?? 0
    const calendarShortfall =
      promisedEvents > 0 &&
      createdEventCount === 0 &&
      success.updatedEvents.length === 0 &&
      createdTaskCount > 0
    const detail = (() => {
      if (calendarShortfall) {
        return `${promisedEvents} kalenderhendelse(r) ble ikke opprettet. ${createdTaskCount} gjøremål ble lagt til.`
      }
      if (createdTaskCount > 0 && createdEventCount === 0) {
        const firstTask = success.createdTasks[0]
        return firstTask ? firstTask.title : `${createdTaskCount} gjøremål`
      }
      if (success.arrangementTitle && createdEventCount > 1) {
        return `${success.arrangementTitle} · ${createdEventCount} hendelser`
      }
      if (createdEventCount === 1 && firstEvent) {
        return `${new Date(`${firstEvent.date}T12:00:00`).toLocaleDateString('nb-NO', {
          weekday: 'short',
          day: 'numeric',
          month: 'long',
        })} · ${(firstEvent.start ?? '').trim() && (firstEvent.end ?? '').trim() ? `${firstEvent.start}–${firstEvent.end}` : 'Tid ikke avklart'}`
      }
      if (createdEventCount > 1) return `${createdEventCount} hendelser`
      if (createdTaskCount > 0) return `${createdTaskCount} gjøremål`
      return 'Import fullført'
    })()
    const title = calendarShortfall
      ? 'Gjøremål importert, men kalenderhendelser mangler'
      : createdTaskCount > 0 && createdEventCount === 0
        ? 'Gjøremål lagt til'
        : partial
          ? 'Delvis importert'
          : 'Importert til kalenderen'

    setTankestromToast({
      title,
      detail:
        partial && createdEventCount > 0
          ? `${createdEventCount} hendelser ble lagt til. ${failureMessage ? 'Noe kunne ikke lagres.' : ''}`.trim()
          : detail,
      variant: partial || calendarShortfall ? 'warning' : 'success',
      firstDate,
      highlightEventIds: success.createdEvents.map((e) => e.id),
      undoEvents: success.createdTasks.length === 0
        ? success.createdEvents.map((e) => ({ id: e.id, date: e.date }))
        : undefined,
      showErrors: partial || calendarShortfall ? failureMessage : undefined,
      openTasks: createdTaskCount > 0 && createdEventCount === 0 && !calendarShortfall,
    })
    if (tankestromToastTimerRef.current != null) window.clearTimeout(tankestromToastTimerRef.current)
    tankestromToastTimerRef.current = window.setTimeout(() => {
      setTankestromToast(null)
      tankestromToastTimerRef.current = null
    }, 6000)
  }, [])

  const jumpToImportedCalendar = useCallback(() => {
    if (!tankestromToast) return
    setTankestromImportOpen(false)
    if (tankestromToast.openTasks) {
      setNavTab('tasks')
      dismissTankestromToast()
      return
    }
    if (tankestromToast.firstDate) {
      setSelectedDate(tankestromToast.firstDate)
    }
    setNavTab('today')
    setShowListView(false)
    if (tankestromToast.highlightEventIds.length > 0) {
      const ids = new Set(tankestromToast.highlightEventIds)
      setRecentImportedEventIds(ids)
      window.setTimeout(() => setRecentImportedEventIds(new Set()), 2800)
    }
    dismissTankestromToast()
  }, [tankestromToast, dismissTankestromToast, setSelectedDate, setShowListView])

  const undoTankestromImport = useCallback(async () => {
    if (!tankestromToast?.undoEvents || tankestromToast.undoEvents.length === 0) return
    for (const ev of tankestromToast.undoEvents) {
      try {
        await deleteEvent(ev.date, ev.id)
      } catch {
        // ignore partial undo failures
      }
    }
    dismissTankestromToast()
    setNotifyToast('Import angret')
  }, [tankestromToast, deleteEvent, dismissTankestromToast])
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showTour, setShowTour] = useState(false)
  useEffect(() => {
    if (!user) return
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0
    const isNewUser = Date.now() - createdAt < 60_000
    if (isNewUser) {
      setShowOnboarding(true)
    }
  }, [user])
  useEffect(() => {
    return () => {
      if (notifyToastTimerRef.current != null) window.clearTimeout(notifyToastTimerRef.current)
      if (tankestromToastTimerRef.current != null) window.clearTimeout(tankestromToastTimerRef.current)
    }
  }, [])

  const [tankestromImportOpen, setTankestromImportOpen] = useState(false)
  const openTankestromImport = useCallback((source: 'settings' | 'toast') => {
    addTankestromSentryBreadcrumb('tankestrom_import_opened', { source })
    setTankestromImportOpen(true)
  }, [])
  useEffect(() => {
    if (user) logEvent('session_start', { userId: user.id.slice(0, 8) })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { inviteNotice, setInviteNotice, inviteProcessing } = useInviteAcceptance({
    userId: user?.id,
    onAccepted: refetchEffectiveUserId,
  })
  const taskCountByDate = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(filteredTasksByDate).map(([date, tasks]) => [
          date,
          tasks.filter((t) => !t.completedAt).length,
        ])
      ),
    [filteredTasksByDate]
  )

  const overdueTaskDates = useMemo(() => {
    const today = todayKeyOslo()
    const result = new Set<string>()
    for (const [date, tasks] of Object.entries(tasksByDate)) {
      if (date < today && tasks.some((t) => !t.completedAt)) {
        result.add(date)
      }
    }
    return result
  }, [tasksByDate])

  useAutoFillWeek({
    week: weekLayoutData,
    addEvent,
    addRecurring,
    clearAllEvents,
  })

  useEffect(() => {
    setHideFamilyBanner(false)
  }, [familyError])

  useEffect(() => {
    if (!familyLoaded || people.length === 0) return
    if (!familyInitializedRef.current) {
      familyInitializedRef.current = true
      people.forEach((p) => { if (p.linkedAuthUserId) seenLinkedIdsRef.current.add(p.linkedAuthUserId) })
      return
    }
    for (const p of people) {
      if (p.linkedAuthUserId && !seenLinkedIdsRef.current.has(p.linkedAuthUserId)) {
        seenLinkedIdsRef.current.add(p.linkedAuthUserId)
        setJoinedPerson(p)
        break
      }
    }
  }, [people, familyLoaded])

  useEffect(() => {
    if (!joinedPerson) return
    const t = setTimeout(() => setJoinedPerson(null), 4000)
    return () => clearTimeout(t)
  }, [joinedPerson])

  useEffect(() => {
    if (!isOnline) {
      setJustReconnected(false)
      prevOnlineRef.current = false
    } else if (prevOnlineRef.current === false) {
      setJustReconnected(true)
      const t = window.setTimeout(() => setJustReconnected(false), 2000)
      prevOnlineRef.current = true
      return () => window.clearTimeout(t)
    } else {
      prevOnlineRef.current = isOnline
    }
  }, [isOnline])

  if (loading) {
    return (
      <AppShell>
        <MobileFrame>
          <div className="flex h-full w-full min-w-0 max-w-full flex-col items-center justify-center gap-3 overflow-x-hidden text-zinc-500">
            <div className="h-8 w-8 animate-spin rounded-pill border-2 border-zinc-300 border-t-zinc-600" />
            <p className="text-body-sm">Laster…</p>
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

  if (ENABLE_ONBOARDING && showOnboarding) {
    return (
      <Suspense fallback={null}>
        <OnboardingFlow
          onComplete={() => {
            setShowOnboarding(false)
            if (user) {
              const tourState = loadOnboarding(user.id)
              if (!tourState.tourCompleted) {
                saveOnboarding({ ...tourState, tourStep: 0 }, user.id)
                setShowTour(true)
              }
            } else {
              setShowTour(true)
            }
          }}
        />
      </Suspense>
    )
  }

  const handleSelectEvent = (event: Event, date: string) => {
    if (event.metadata?.calendarLayer === 'background') return
    logEvent('event_opened', { eventId: event.id, title: event.title, date })
    setSelectedEvent({ event, date })
  }

  const shiftSelectedDateByDays = (days: number) => {
    setSelectedDate((prev) => addCalendarDaysOslo(prev, days))
  }

  const handleChangeWeek = (deltaWeeks: number) => {
    shiftSelectedDateByDays(deltaWeeks * 7)
  }

  const openAddEvent = (dateOverride: string | null = null) => {
    logEvent('sheet_opened', { sheet: 'add_event', date: dateOverride ?? selectedDate })
    startUxTimer('add_event_flow')
    setAddFlowSaved(false)
    setAddEventDateOverride(dateOverride)
    setIsAdding(true)
  }

  const openAddTask = () => {
    logEvent('sheet_opened', { sheet: 'add_task' })
    setEditingTask(null)
    setIsAddingTask(true)
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
  const effectiveNav: NavTab = navTab

  return (
    <AppShell>
      <AnimatePresence>
        {joinedPerson && (
          <motion.div
            key={joinedPerson.id}
            initial={{ opacity: 0, y: -64 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -64 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed inset-x-0 top-4 z-[200] pointer-events-none"
          >
            <div className="mx-4 flex items-center gap-2.5 rounded-xl bg-synkaPrimary px-4 py-3 shadow-lg">
              <SectionDots size="sm" />
              <p className="text-body-sm font-semibold text-white">{joinedPerson.name} er nå med i Synka! 🎉</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <MobileFrame>
        <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden">
          {!isOnline && (
            <div
              className="shrink-0 bg-synkaNavy text-white text-caption text-center py-2 px-4"
              role="status"
              aria-live="polite"
            >
              Ingen internettforbindelse
            </div>
          )}
          {isOnline && justReconnected && (
            <div
              className="shrink-0 bg-synkaPrimary text-white text-caption text-center py-2 px-4"
              role="status"
              aria-live="polite"
            >
              Tilkoblet igjen
            </div>
          )}
          {saveFeedback === 'saved' && lastSaveType === 'event' && (
            <div
              className="shrink-0 bg-synkaTeal text-white text-caption text-center py-2 px-4"
              role="status"
              aria-live="polite"
            >
              Hendelse lagret
            </div>
          )}
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={navTab}
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden"
            >
          {navTab === 'mer' ? (
            merSubScreen === 'settings' ? (
              <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden overflow-hidden">
                <div className="flex shrink-0 items-center gap-2 bg-synkaCream border-b border-synkaNavy/8 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setMerSubScreen(null)}
                    className="flex w-8 h-8 items-center justify-center rounded-full hover:bg-synkaNavy/8 transition touch-manipulation"
                    aria-label="Tilbake"
                  >
                    <IconArrowLeft size={18} className="text-synkaNavy" aria-hidden />
                  </button>
                  <span className="text-[15px] font-semibold text-synkaNavy">Innstillinger</span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                  <SettingsScreen
                    onClearAllEvents={clearAllEvents}
                    onRestartOnboarding={() => {
                      setNavTab('today')
                      setShowListView(false)
                      setMerSubScreen(null)
                    }}
                  />
                </div>
              </div>
            ) : merSubScreen === 'tankestrom' ? (
              <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
                <Suspense fallback={null}>
                  <TankestrømPage
                    onBack={() => setMerSubScreen(null)}
                    onNavigateFamilie={() => setMerSubScreen('familie')}
                    people={people}
                    createEvent={controller.createEvent}
                    createTask={taskController.createTask}
                    editEvent={controller.editEvent}
                    getAnchoredForegroundEventsForMatching={getAnchoredForegroundEventsForMatching}
                    prefetchEventsForDateRange={prefetchEventsForDateRange}
                    deleteEvent={deleteEvent}
                    updatePerson={updatePerson}
                    onImportFinished={openTankestromToast}
                    onOpenExistingEvent={(eventId) => {
                      // Åpne den eksisterende hendelsen i detalj-arket (globalt montert overlay).
                      // Samme kilde kandidaten ble matchet mot, så id-en er løsbar.
                      const match = getAnchoredForegroundEventsForMatching().find(
                        (r) => r.event.id === eventId
                      )
                      if (match) setSelectedEvent({ event: match.event, date: match.anchorDate })
                    }}
                  />
                </Suspense>
              </div>
            ) : merSubScreen === 'familie' ? (
              <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
                <Suspense fallback={null}>
                  <FamilieScreen onBack={() => setMerSubScreen(null)} />
                </Suspense>
              </div>
            ) : merSubScreen === 'hjelp' ? (
              <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
                <Suspense fallback={null}>
                  <HjelpScreen onBack={() => setMerSubScreen(null)} />
                </Suspense>
              </div>
            ) : (
              <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                <MerScreen
                  onNavigateSettings={() => setMerSubScreen('settings')}
                  onNavigateTankestrom={() => setMerSubScreen('tankestrom')}
                  onNavigateFamilie={() => setMerSubScreen('familie')}
                  onNavigateHjelp={() => setMerSubScreen('hjelp')}
                />
              </div>
            )
          ) : navTab === 'month' ? (
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
              <Suspense fallback={null}>
                <MonthView
                  selectedDate={selectedDate}
                  onSelectDate={(date) => {
                    setSelectedDate(date)
                    setNavTab('today')
                    setShowListView(false)
                  }}
                  events={monthViewEvents}
                  people={people}
                  onVisibleMonthRange={handleMonthRangePrefetch}
                  overdueTaskDates={overdueTaskDates}
                />
              </Suspense>
            </div>
          ) : navTab === 'tasks' ? (
            <TasksScreen
              weekLayoutData={weekLayoutData}
              tasksByDate={filteredTasksByDate}
              openAddTask={openAddTask}
              onCompleteTask={(task) => { void taskController.markTaskDone(task).catch(() => {}) }}
              onUndoCompleteTask={(task) => { void taskController.undoTaskComplete(task).catch(() => {}) }}
              onEditTask={(task) => {
                setIsAddingTask(false)
                setSelectedTaskId(null)
                setEditingTask(task)
              }}
              onDeleteTask={(task) => { void taskController.deleteTask(task).catch(() => {}) }}
              onNotifyTask={hasLinkedPartner ? (task) => {
                if (!checkAndRecordNotify(task.id)) return
                void sendTaskNotify(task.title, task.id, task.notes)
                if (notifyToastTimerRef.current != null) window.clearTimeout(notifyToastTimerRef.current)
                setNotifyToast(task.title)
                notifyToastTimerRef.current = window.setTimeout(() => {
                  setNotifyToast(null)
                  notifyToastTimerRef.current = null
                }, 2500)
              } : undefined}
              inboxNotifications={inboxNotifications}
              onMarkInboxRead={() => { void markInboxRead() }}
              onDismissNotification={(id) => { void dismissNotification(id) }}
            />
          ) : navTab === 'today' ? (
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
              reducedMotion={reducedMotion}
              weekEventsLoading={weekEventsLoading}
              showNoFamilyEmpty={showNoFamilyEmpty}
              showListView={showListView}
              setShowListView={setShowListView}
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
                await controller.dragReschedule(selectedDate, eventId, times).catch(() => {})
              }}
              onDeleteWeeklyEvent={async (event, date) => {
                await controller.deleteEvent(date, event).catch(() => {})
              }}
              openAddTask={openAddTask}
              taskCountByDate={taskCountByDate}
              dayTasks={calendarDayTasks}
              onSelectTask={(task) => setSelectedTaskId(task.id)}
              allDayEvents={allDayEventsForDay}
              unspecifiedEvents={unspecifiedEventsForDay}
              highlightedEventIds={recentImportedEventIds}
              onOpenMer={() => { setNavTab('mer'); setMerSubScreen('familie') }}
            />
          ) : null}
            </motion.div>
          </AnimatePresence>
          </div>

          {notifyToast && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none fixed inset-x-0 z-[50] flex justify-center px-3"
              style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex w-full max-w-[390px] items-center gap-3 rounded-lg border-2 border-synkaPrimary/30 bg-synkaPrimary px-3 py-2.5 text-white shadow-planner">
                <p className="min-w-0 flex-1 text-body-sm font-medium leading-snug">Varslet din partner om «{notifyToast}»</p>
              </div>
            </div>
          )}
          <AnimatePresence>
            {tankestromToast && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.22 }}
                role="status"
                aria-live="polite"
                className="fixed inset-x-0 z-[55] flex justify-center px-3"
                style={{ bottom: 'calc(132px + env(safe-area-inset-bottom, 0px))' }}
              >
                <div
                  className={`w-full max-w-[390px] rounded-lg border px-3 py-2.5 shadow-planner ${
                    tankestromToast.variant === 'warning'
                      ? 'border-synkaYellow/30 bg-synkaYellow/8'
                      : 'border-synkaPrimary/30 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-body-sm font-semibold text-zinc-900">{tankestromToast.title}</p>
                      <p className="mt-0.5 text-caption text-zinc-600">{tankestromToast.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={dismissTankestromToast}
                      className="rounded-md px-1 text-zinc-500 hover:bg-zinc-100"
                      aria-label="Lukk importbekreftelse"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={jumpToImportedCalendar}
                      className="rounded-pill bg-synkaPrimary px-3 py-1.5 text-caption font-semibold text-white"
                    >
                      {tankestromToast.openTasks ? 'Åpne gjøremål' : 'Se i kalenderen'}
                    </button>
                    {tankestromToast.undoEvents && tankestromToast.undoEvents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void undoTankestromImport()}
                        className="rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-caption font-semibold text-zinc-700"
                      >
                        Angre
                      </button>
                    )}
                    {tankestromToast.showErrors && (
                      <button
                        type="button"
                        onClick={() => {
                          openTankestromImport('toast')
                          dismissTankestromToast()
                        }}
                        className="rounded-pill border border-synkaYellow/30 bg-white px-3 py-1.5 text-caption font-semibold text-synkaNavy/80"
                      >
                        Vis feil
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <BottomNav
            active={effectiveNav}
            logisticsNotifyCount={inboxUnreadCount}
            onSelect={(tab) => {
              logEvent('tab_switched', { tab })
              setNavTab(tab)
              setMerSubScreen(null)
              if (tab === 'today') setShowListView(false)
            }}
          />
        </div>
      </MobileFrame>

      <DebugOverlay />
      {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}
      <Suspense fallback={null}>
        <TankestromImportDialog
          open={tankestromImportOpen}
          onClose={() => setTankestromImportOpen(false)}
          people={people}
          createEvent={controller.createEvent}
          createTask={taskController.createTask}
          editEvent={controller.editEvent}
          getAnchoredForegroundEventsForMatching={getAnchoredForegroundEventsForMatching}
          prefetchEventsForDateRange={prefetchEventsForDateRange}
          deleteEvent={deleteEvent}
          updatePerson={updatePerson}
          onImportFinished={openTankestromToast}
        />
      </Suspense>
      <CalendarOverlays
        selectedEvent={selectedEvent}
        setSelectedEvent={setSelectedEvent}
        selectedBackgroundEvent={selectedBackgroundEvent}
        setSelectedBackgroundEvent={setSelectedBackgroundEvent}
        dayEvents={dayEvents}
        dayTasks={filteredTasksByDate[selectedDate] ?? []}
        isAdding={isAdding}
        selectedDate={selectedDate}
        addEventDateOverride={addEventDateOverride}
        addFlowSaved={addFlowSaved}
        setAddFlowSaved={setAddFlowSaved}
        setIsAdding={setIsAdding}
        setAddEventDateOverride={setAddEventDateOverride}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEvent}
        controller={controller}
        mePersonId={mePersonId}
        onAddFlowSaved={() => { endUxTimer('add_event_flow', 'time_to_add_event_ms'); setLastSaveType('event') }}
        onEventSaved={() => setLastSaveType('event')}
        onAddFlowClosedWithoutSave={() => logUxMetric('flow_backtracks', 1)}
        onConflictResolved={() => endUxTimer('resolve_conflict_flow', 'time_to_resolve_conflict_ms')}
        isAddingTask={isAddingTask}
        setIsAddingTask={setIsAddingTask}
        editingTask={editingTask}
        setEditingTask={setEditingTask}
        taskController={taskController}
        selectedTaskId={selectedTaskId}
        setSelectedTaskId={setSelectedTaskId}
      />
    </AppShell>
  )
}

export default App
