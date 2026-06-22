import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { typHeading, typSectionCap, btnPrimaryPill, screenHeaderRow } from '../lib/ui'
import { SectionDots } from './SectionDots'
import type { Task, Person } from '../types'
import { taskIntentBadgeClassName, taskIntentLabelNb } from '../lib/taskIntent'
import type { WeekDayLayout } from '../hooks/useScheduleState'
import { useFamily } from '../context/FamilyContext'
import { todayKeyOslo } from '../lib/osloCalendar'

// ── Date helpers ───────────────────────────────────────────────────────────────

const NB_DAYS: Record<number, string> = {
  0: 'Søndag', 1: 'Mandag', 2: 'Tirsdag', 3: 'Onsdag',
  4: 'Torsdag', 5: 'Fredag', 6: 'Lørdag',
}

function formatDayLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00')
  return `${NB_DAYS[d.getDay()] ?? ''} ${d.getDate()}.`
}

// ── Public interface (unchanged) ───────────────────────────────────────────────

export interface InboxNotification {
  id: string
  body: string
  created_at: string
}

export interface TasksScreenProps {
  weekLayoutData: WeekDayLayout[]
  tasksByDate: Record<string, Task[]>
  openAddTask: () => void
  onCompleteTask: (task: Task) => void
  onUndoCompleteTask: (task: Task) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (task: Task) => void
  /** When provided, shows a bell icon on open tasks and calls this to ping the partner. */
  onNotifyTask?: (task: Task) => void
  /** Unread partner notifications to show in the inbox strip. */
  inboxNotifications?: InboxNotification[]
  /** Called when the user intentionally opens the notification panel (marks all read). */
  onMarkInboxRead?: () => void
  /** Called when the user dismisses a single notification. */
  onDismissNotification?: (id: string) => void
}

// ── Internal types ─────────────────────────────────────────────────────────────

interface DayGroup {
  date: string
  label: string
  tasks: Task[]
}

interface TaskItemProps {
  task: Task
  /** Person the task concerns (childPersonId) */
  child?: Person
  /** Person responsible for executing the task (assignedToPersonId) */
  assignee?: Person
  onComplete: () => void
  onUndoComplete: () => void
  onEdit: () => void
  onDelete: () => void
  /** When provided, a bell button appears and calls this on tap. Omit to hide bell. */
  onNotify?: () => void
}

// ── Micro icon components (keeps JSX readable) ─────────────────────────────────

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  )
}

// ── Staggered task list ────────────────────────────────────────────────────────

/** Each section animates independently: cards rise from below in sequence. */
const TASK_LIST_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
}
const TASK_LIST_ITEM: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}

function StaggeredTasks({
  tasks,
  renderTask,
  reducedMotion,
}: {
  tasks: Task[]
  renderTask: (task: Task) => ReactNode
  reducedMotion: boolean
}) {
  if (reducedMotion) {
    return <div className="space-y-2">{tasks.map((t) => renderTask(t))}</div>
  }
  return (
    <motion.div className="space-y-2" variants={TASK_LIST_CONTAINER} initial="hidden" animate="visible" style={{ willChange: 'transform, opacity' }}>
      {tasks.map((t) => (
        <motion.div key={t.id} variants={TASK_LIST_ITEM} style={{ willChange: 'transform, opacity' }}>
          {renderTask(t)}
        </motion.div>
      ))}
    </motion.div>
  )
}

// ── Task card ──────────────────────────────────────────────────────────────────

function TaskItem({ task, child, assignee, onComplete, onUndoComplete, onEdit, onDelete, onNotify }: TaskItemProps) {
  const isDone = !!task.completedAt
  const primaryPerson = child ?? assignee
  const showSecondPerson = !!(child && assignee && child.id !== assignee.id)

  return (
    <div
      className={`flex items-start gap-3 rounded-md border px-3.5 py-3 transition-colors ${
        isDone
          ? 'border-zinc-100 bg-zinc-50/60'
          : 'border-synkaNavy/8 bg-white/60 shadow-soft'
      }`}
      style={!isDone && primaryPerson ? {
        backgroundColor: primaryPerson.colorTint,
        borderLeftWidth: 5,
        borderLeftColor: primaryPerson.colorAccent,
        borderTopColor: 'rgba(15, 30, 43, 0.08)',
        borderRightColor: 'rgba(15, 30, 43, 0.08)',
        borderBottomColor: 'rgba(15, 30, 43, 0.08)',
      } : undefined}
    >
      {/* Completion toggle */}
      <button
        type="button"
        onClick={() => (isDone ? onUndoComplete() : onComplete())}
        className="mt-0.5 shrink-0 active:scale-90 transition-transform"
        aria-label={isDone ? 'Angre ferdig' : 'Merk som ferdig'}
      >
        {isDone ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-pill bg-synkaPrimary">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
        ) : (
          <div className="h-5 w-5 rounded-pill border-2 border-zinc-300 transition-colors hover:border-synkaPrimary" />
        )}
      </button>

      {/* Task body */}
      <div className={`min-w-0 flex-1 ${isDone ? 'opacity-50' : ''}`}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p
            className={`min-w-0 flex-1 text-body-sm font-medium leading-snug ${
              isDone ? 'text-zinc-500 line-through decoration-zinc-300' : 'text-zinc-900'
            }`}
          >
            {task.title}
          </p>
          {!isDone && (task.taskIntent ?? 'must_do') === 'can_help' ? (
            <span
              className={`shrink-0 rounded-pill border px-2 py-0.5 text-[10px] font-semibold ${taskIntentBadgeClassName(
                'can_help'
              )}`}
            >
              {taskIntentLabelNb('can_help')}
            </span>
          ) : null}
        </div>

        {/* Metadata row — only on open tasks */}
        {!isDone && (task.dueTime || primaryPerson) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {task.dueTime && (
              <span className="inline-flex items-center gap-1 rounded-pill border border-synkaYellow/40 bg-synkaYellow/10 px-2 py-0.5 text-caption font-semibold text-synkaNavy/70">
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                {task.dueTime}
              </span>
            )}
            {primaryPerson && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-pill"
                  style={{ backgroundColor: primaryPerson.colorAccent }}
                />
                <span className="text-caption text-zinc-500">{primaryPerson.name}</span>
                {showSecondPerson && (
                  <span className="text-caption text-zinc-400">→ {assignee!.name}</span>
                )}
              </span>
            )}
          </div>
        )}

        {!isDone && task.notes && (
          <p className="mt-1.5 line-clamp-2 text-caption leading-relaxed text-zinc-400">
            {task.notes}
          </p>
        )}
      </div>

      {/* Icon action buttons — less visual noise than text chips */}
      <div className="flex shrink-0 items-center gap-0.5">
        {!isDone && onNotify && (
          <button
            type="button"
            onClick={onNotify}
            className="rounded-lg p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-300 transition hover:bg-zinc-100 hover:text-synkaPrimary"
            aria-label="Varsle partner"
            title="Varsle partner om gjøremålet"
          >
            <BellIcon />
          </button>
        )}
        {!isDone && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-500"
            aria-label="Rediger"
          >
            <PencilIcon />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-300 transition hover:bg-synkaCoral/10 hover:text-synkaCoral"
          aria-label="Slett"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

// ── Section header variants ────────────────────────────────────────────────────

/**
 * overdue — rose accent, communicates urgency
 * today   — teal accent, communicates currency
 * neutral — plain zinc, used for upcoming day labels
 */
function SectionLabel({
  label,
  variant,
  sublabel,
}: {
  label: string
  variant: 'overdue' | 'today' | 'neutral'
  sublabel?: string
}) {
  if (variant === 'neutral') {
    return <h3 className={`mb-3 ${typSectionCap}`}>{label}</h3>
  }
  const dot = variant === 'overdue' ? 'bg-synkaCoral' : 'bg-synkaTeal'
  const text = variant === 'overdue' ? 'text-synkaCoral' : 'text-synkaPrimary'
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-pill ${dot}`} />
      <h3 className={`text-caption font-semibold uppercase tracking-wider ${text}`}>{label}</h3>
      {sublabel && <span className="ml-0.5 text-caption text-zinc-400">{sublabel}</span>}
    </div>
  )
}

// ── Relative time helper ──────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Nå nettopp'
  if (minutes < 60) return `${minutes} min siden`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} t siden`
  const days = Math.floor(hours / 24)
  return `${days} d siden`
}

// ── Notification inbox strip ───────────────────────────────────────────────────

interface NotificationStripProps {
  notifications: InboxNotification[]
  onMarkAllRead: () => void
  onDismiss: (id: string) => void
}

function NotificationStrip({ notifications, onMarkAllRead, onDismiss }: NotificationStripProps) {
  const [expanded, setExpanded] = useState(false)
  const [snapshot, setSnapshot] = useState<InboxNotification[]>([])

  const handleExpand = useCallback(() => {
    setSnapshot([...notifications])
    setExpanded(true)
    onMarkAllRead()
  }, [notifications, onMarkAllRead])

  const handleDismiss = useCallback((id: string) => {
    setSnapshot((prev) => prev.filter((n) => n.id !== id))
    onDismiss(id)
  }, [onDismiss])

  const handleCollapse = useCallback(() => {
    setExpanded(false)
    setSnapshot([])
  }, [])

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={handleExpand}
        className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-2 rounded-lg border border-synkaPrimary/30 bg-synkaPrimary/8 px-3 py-2 text-left transition hover:bg-synkaPrimary/15"
        aria-label={`${notifications.length} uleste partnervarsler. Trykk for å vise.`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-synkaPrimary text-white">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </span>
        <span className="flex-1 text-body-sm font-medium text-synkaPrimary">
          {notifications.length === 1 ? '1 nytt varsel' : `${notifications.length} nye varsler`} fra din partner
        </span>
        <svg className="h-4 w-4 shrink-0 text-synkaPrimary/60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    )
  }

  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-lg border border-synkaPrimary/20 bg-synkaPrimary/8">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-synkaPrimary">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          Varsler
        </span>
        <button
          type="button"
          onClick={handleCollapse}
          className="text-caption font-medium text-zinc-400 hover:text-zinc-600 transition"
        >
          Lukk
        </button>
      </div>

      {snapshot.length === 0 ? (
        <p className="px-3 pb-3 text-body-sm text-zinc-400">Ingen varsler</p>
      ) : (
        <div className="divide-y divide-synkaPrimary/10">
          {snapshot.map((n) => (
            <div key={n.id} className="flex items-start gap-2 px-3 py-2">
              <p className="min-w-0 flex-1 text-body-sm leading-snug text-zinc-700">{n.body}</p>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-caption text-zinc-400">{formatRelativeTime(n.created_at)}</span>
                <button
                  type="button"
                  onClick={() => handleDismiss(n.id)}
                  aria-label="Fjern varsel"
                  className="rounded p-0.5 text-zinc-300 hover:text-synkaCoral transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

const OVERDUE_RECENT_DAYS = 7

export function TasksScreen({
  weekLayoutData,
  tasksByDate,
  openAddTask,
  onCompleteTask,
  onUndoCompleteTask,
  onEditTask,
  onDeleteTask,
  onNotifyTask,
  inboxNotifications = [],
  onMarkInboxRead,
  onDismissNotification,
}: TasksScreenProps) {
  const { people } = useFamily()
  const reducedMotion = useReducedMotion() ?? false
  const [showCompleted, setShowCompleted] = useState(false)
  const [showAllOverdue, setShowAllOverdue] = useState(false)
  const today = todayKeyOslo()

  /**
   * Split the week's tasks into three urgency buckets:
   * - overdueGroups: past days with open tasks
   * - todayTasks: today's open tasks (flat list, not per-day)
   * - upcomingGroups: future days with open tasks
   * - allCompleted: every completed task in the week (collapsed by default)
   */
  const { overdueGroups, todayTasks, upcomingGroups, allCompleted } = useMemo(() => {
    const overdueGroups: DayGroup[] = []
    let todayTasks: Task[] = []
    const upcomingGroups: DayGroup[] = []
    const allCompleted: Task[] = []

    // Overdue: all loaded dates strictly before today (lookback covers past 28 days)
    for (const dateKey of Object.keys(tasksByDate).sort()) {
      if (dateKey >= today) break
      const tasks = tasksByDate[dateKey] ?? []
      const open = tasks
        .filter((t) => !t.completedAt)
        .sort((a, b) => (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'))
      if (open.length > 0) {
        overdueGroups.push({ date: dateKey, label: formatDayLabel(dateKey), tasks: open })
      }
    }

    // Today, upcoming, completed: scoped to the currently visible week
    for (const day of weekLayoutData) {
      const tasks = tasksByDate[day.date] ?? []
      const done = tasks.filter((t) => !!t.completedAt)
      allCompleted.push(...done)

      if (day.date < today) continue // already handled above

      const open = tasks
        .filter((t) => !t.completedAt)
        .sort((a, b) => (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'))

      if (day.date === today) {
        todayTasks = open
      } else if (open.length > 0) {
        upcomingGroups.push({ date: day.date, label: formatDayLabel(day.date), tasks: open })
      }
    }

    return { overdueGroups, todayTasks, upcomingGroups, allCompleted }
  }, [weekLayoutData, tasksByDate, today])

  function resolvePeople(task: Task): { child?: Person; assignee?: Person } {
    const child = task.childPersonId ? people.find((p) => p.id === task.childPersonId) : undefined
    const assignee = task.assignedToPersonId
      ? people.find((p) => p.id === task.assignedToPersonId)
      : undefined
    return { child, assignee }
  }

  const handleCompleteTask = useCallback(
    (task: Task) => {
      setShowCompleted(true)
      onCompleteTask(task)
    },
    [onCompleteTask]
  )

  function renderTask(task: Task) {
    const { child, assignee } = resolvePeople(task)
    return (
      <TaskItem
        key={task.id}
        task={task}
        child={child}
        assignee={assignee}
        onComplete={() => handleCompleteTask(task)}
        onUndoComplete={() => onUndoCompleteTask(task)}
        onEdit={() => onEditTask(task)}
        onDelete={() => onDeleteTask(task)}
        onNotify={onNotifyTask ? () => onNotifyTask(task) : undefined}
      />
    )
  }

  const hasOpenTasks =
    overdueGroups.length > 0 || todayTasks.length > 0 || upcomingGroups.length > 0
  const hasAnything = hasOpenTasks || allCompleted.length > 0

  return (
    <div className="mt-3 flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden pb-4">
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scrollbar-none">
        {/* Screen header */}
        <div className={screenHeaderRow}>
          <h2 className={`${typHeading} inline-flex items-center gap-2`}>
            <SectionDots />
            Gjøremål
          </h2>
          <button type="button" onClick={openAddTask} className={btnPrimaryPill}>
            + Nytt gjøremål
          </button>
        </div>

        {/* Notification inbox strip — only visible when there are unread notifications */}
        {inboxNotifications.length > 0 && onMarkInboxRead && onDismissNotification && (
          <NotificationStrip
            notifications={inboxNotifications}
            onMarkAllRead={onMarkInboxRead}
            onDismiss={onDismissNotification}
          />
        )}

        {!hasAnything ? (
          /* ── Empty state ──────────────────────────────────────────────────── */
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <img src="/synka-mark.svg" className="mb-4 h-16 w-16 opacity-40" alt="" />
            <h3 className="text-body font-semibold text-zinc-700">Ingen gjøremål denne uken</h3>
            <p className="mt-1.5 text-body-sm leading-relaxed text-zinc-400">
              Kjøp melk, ring legen, send skjema — alt uten fast klokkeslett.
            </p>
            <button type="button" onClick={openAddTask} className={`mt-5 ${btnPrimaryPill}`}>
              + Nytt gjøremål
            </button>
          </div>
        ) : (
          /* ── Task sections ────────────────────────────────────────────────── */
          <div className="space-y-6 px-4 pb-2">

            {/* Forfalt — past days with open tasks, capped to last 7 days by default */}
            {overdueGroups.length > 0 && (() => {
              const cutoff = new Date(today)
              cutoff.setDate(cutoff.getDate() - OVERDUE_RECENT_DAYS)
              const cutoffKey = cutoff.toISOString().slice(0, 10)
              const recentGroups = overdueGroups.filter((g) => g.date >= cutoffKey)
              const olderGroups = overdueGroups.filter((g) => g.date < cutoffKey)
              const olderCount = olderGroups.reduce((sum, g) => sum + g.tasks.length, 0)
              return (
                <section>
                  <SectionLabel label="Forfalt" variant="overdue" />
                  {!showAllOverdue && olderGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllOverdue(true)}
                      className="mb-3 flex items-center gap-1.5 rounded-lg border border-synkaCoral/20 bg-synkaCoral/8 px-3 py-1.5 text-caption font-medium text-synkaCoral hover:bg-synkaCoral/15 transition"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                      {olderCount} eldre forfalt fra {olderGroups.length} {olderGroups.length === 1 ? 'dag' : 'dager'}
                    </button>
                  )}
                  <div className="space-y-4">
                    {recentGroups.map((group) => (
                      <div key={group.date}>
                        <p className="mb-2 text-caption font-medium uppercase tracking-wide text-synkaPrimary/70">{group.label}</p>
                        <StaggeredTasks tasks={group.tasks} renderTask={renderTask} reducedMotion={reducedMotion} />
                      </div>
                    ))}
                    {showAllOverdue && olderGroups.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="h-px flex-1 bg-zinc-100" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">Eldre forfalt</span>
                          <div className="h-px flex-1 bg-zinc-100" />
                        </div>
                        <div className="space-y-4 opacity-75">
                          {olderGroups.map((group) => (
                            <div key={group.date}>
                              <p className="mb-2 text-caption font-medium uppercase tracking-wide text-synkaPrimary/50">{group.label}</p>
                              <div className="space-y-2">{group.tasks.map((t) => renderTask(t))}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {showAllOverdue && olderGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllOverdue(false)}
                      className="mt-3 text-caption font-medium text-zinc-400 hover:text-zinc-600 transition"
                    >
                      Skjul eldre
                    </button>
                  )}
                </section>
              )
            })()}

            {/* I dag */}
            {todayTasks.length > 0 && (
              <section>
                <SectionLabel label="I dag" variant="today" sublabel={formatDayLabel(today)} />
                <StaggeredTasks tasks={todayTasks} renderTask={renderTask} reducedMotion={reducedMotion} />
              </section>
            )}

            {/* Kommende — one section per future day */}
            {upcomingGroups.map((group) => (
              <section key={group.date}>
                <SectionLabel label={group.label} variant="neutral" />
                <StaggeredTasks tasks={group.tasks} renderTask={renderTask} reducedMotion={reducedMotion} />
              </section>
            ))}

            {/* Ferdige — collapsed by default */}
            {allCompleted.length > 0 && (
              <section className={hasOpenTasks ? 'border-t border-zinc-100 pt-5' : ''}>
                <button
                  type="button"
                  onClick={() => setShowCompleted((v) => !v)}
                  className="mb-3 flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-500"
                >
                  <svg
                    className={`h-3 w-3 transition-transform duration-200 ${showCompleted ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  {allCompleted.length} {allCompleted.length === 1 ? 'ferdig' : 'ferdige'}
                </button>
                {showCompleted && (
                  <div className="space-y-2">{allCompleted.map((t) => renderTask(t))}</div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
