import { useState, useCallback, useEffect, useRef } from 'react'
import type { Task } from '../types'
import type { TaskUpdates } from '../lib/tasksApi'
import {
  fetchTasksForDateRange,
  createTask as createTaskApi,
  updateTask as updateTaskApi,
  deleteTask as deleteTaskApi,
} from '../lib/tasksApi'
import { useAuth } from '../context/AuthContext'
import { useEffectiveUserId } from '../context/EffectiveUserIdContext'
import { weekDateKeysMondayStartOslo, todayKeyOslo, addCalendarDaysOslo } from '../lib/osloCalendar'
import { useMobileRefreshTriggers, useRealtimeRefresh } from '../features/sync/useRefreshTriggers'

export function useTasksState(selectedDate: string) {
  const { user } = useAuth()
  const { effectiveUserId } = useEffectiveUserId()
  const [tasksByDate, setTasksByDate] = useState<Record<string, Task[]>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const refreshDebounceRef = useRef<number | null>(null)
  const lookbackFetchedRef = useRef(false)
  const fetchRequestIdRef = useRef(0)

  const queueRefresh = useCallback(() => {
    if (refreshDebounceRef.current != null) return
    refreshDebounceRef.current = window.setTimeout(() => {
      refreshDebounceRef.current = null
      setRefreshKey((k) => k + 1)
    }, 350)
  }, [])

  useEffect(() => {
    if (!user || !effectiveUserId) return
    const weekKeys = weekDateKeysMondayStartOslo(selectedDate)
    const startDate = weekKeys[0]
    const endDate = weekKeys[weekKeys.length - 1]
    const requestId = ++fetchRequestIdRef.current
    ;(async () => {
      const { byDate } = await fetchTasksForDateRange(startDate, endDate)
      // Discard if a newer fetch has already been dispatched.
      if (requestId !== fetchRequestIdRef.current) return
      setTasksByDate((prev) => {
        const next = { ...prev }
        for (const key of weekKeys) {
          next[key] = byDate[key] ?? []
        }
        return next
      })
    })()
  }, [user, effectiveUserId, selectedDate, refreshKey])

  useEffect(() => {
    setTasksByDate({})
    lookbackFetchedRef.current = false
    fetchRequestIdRef.current = 0
  }, [effectiveUserId])

  // One-time lookback: fetch the past 28 days on sign-in so the Tasks screen
  // "Forfalt" section shows genuinely overdue tasks from prior weeks.
  useEffect(() => {
    if (!user || !effectiveUserId || lookbackFetchedRef.current) return
    lookbackFetchedRef.current = true
    const todayKey = todayKeyOslo()
    const startKey = addCalendarDaysOslo(todayKey, -28)
    const endKey = addCalendarDaysOslo(todayKey, -1)
    ;(async () => {
      try {
        const { byDate } = await fetchTasksForDateRange(startKey, endKey)
        setTasksByDate((prev) => {
          const next = { ...prev }
          for (const [key, tasks] of Object.entries(byDate)) {
            if (!(key in next)) next[key] = tasks
          }
          return next
        })
      } catch {
        // non-critical — overdue section degrades gracefully to current week only
      }
    })()
  }, [user, effectiveUserId])

  useEffect(
    () => () => {
      if (refreshDebounceRef.current != null)
        window.clearTimeout(refreshDebounceRef.current)
    },
    []
  )

  useMobileRefreshTriggers({
    enabled: Boolean(user && effectiveUserId),
    onRefresh: queueRefresh,
    includeVisibilityChange: true,
  })

  useRealtimeRefresh({
    enabled: Boolean(user && effectiveUserId),
    channelName: `realtime-tasks-${effectiveUserId ?? 'none'}`,
    table: 'tasks',
    filter: `user_id=eq.${effectiveUserId ?? ''}`,
    onRefresh: queueRefresh,
  })

  function applyTaskUpdates(task: Task, updates: TaskUpdates): Task {
    const next: Task = { ...task }
    if (updates.title != null) next.title = updates.title
    if (updates.date != null) next.date = updates.date
    if ('notes' in updates) next.notes = updates.notes
    if ('dueTime' in updates) next.dueTime = updates.dueTime
    if ('assignedToPersonId' in updates) next.assignedToPersonId = updates.assignedToPersonId
    if ('childPersonId' in updates) next.childPersonId = updates.childPersonId
    if ('completedAt' in updates) next.completedAt = updates.completedAt
    if ('showInMonthView' in updates) next.showInMonthView = updates.showInMonthView
    if ('taskIntent' in updates && updates.taskIntent != null) next.taskIntent = updates.taskIntent
    return next
  }

  function snapshotTasksByDate(prev: Record<string, Task[]>): Record<string, Task[]> {
    const snap: Record<string, Task[]> = {}
    for (const [key, tasks] of Object.entries(prev)) {
      snap[key] = tasks.map((t) => ({ ...t }))
    }
    return snap
  }

  function setTaskInByDate(
    prev: Record<string, Task[]>,
    taskId: string,
    oldDate: string,
    newDate: string,
    nextTask: Task
  ): Record<string, Task[]> {
    if (newDate !== oldDate) {
      return {
        ...prev,
        [oldDate]: (prev[oldDate] ?? []).filter((t) => t.id !== taskId),
        [newDate]: [...(prev[newDate] ?? []).filter((t) => t.id !== taskId), nextTask],
      }
    }
    return {
      ...prev,
      [oldDate]: (prev[oldDate] ?? []).map((t) => (t.id === taskId ? nextTask : t)),
    }
  }

  async function addTask(input: Omit<Task, 'id'>) {
    if (!user || !effectiveUserId) throw new Error('Must be signed in to add tasks')
    fetchRequestIdRef.current++
    const created = await createTaskApi(effectiveUserId, input)
    setTasksByDate((prev) => {
      const existing = prev[input.date] ?? []
      return { ...prev, [input.date]: [...existing, created] }
    })
  }

  async function patchTask(taskId: string, oldDate: string, updates: TaskUpdates) {
    if (!user) throw new Error('Must be signed in to edit tasks')
    // Drop in-flight week fetches so they cannot overwrite this patch when they complete.
    fetchRequestIdRef.current++

    const newDate = updates.date ?? oldDate
    let revertSnapshot: Record<string, Task[]> | null = null

    setTasksByDate((prev) => {
      const existing = prev[oldDate]?.find((t) => t.id === taskId)
      if (!existing) return prev
      revertSnapshot = snapshotTasksByDate(prev)
      const optimistic = applyTaskUpdates(existing, updates)
      return setTaskInByDate(prev, taskId, oldDate, newDate, optimistic)
    })

    try {
      const updated = await updateTaskApi(taskId, updates)
      if (!updated) throw new Error('Could not update task')
      setTasksByDate((prev) => setTaskInByDate(prev, taskId, oldDate, newDate, updated))
    } catch (err) {
      if (revertSnapshot) setTasksByDate(revertSnapshot)
      throw err
    }
  }

  async function removeTask(taskId: string, date: string) {
    if (!user || !effectiveUserId) throw new Error('Must be signed in to delete tasks')
    fetchRequestIdRef.current++
    const ok = await deleteTaskApi(taskId, effectiveUserId)
    if (!ok) throw new Error('Could not delete task')
    setTasksByDate((prev) => ({
      ...prev,
      [date]: (prev[date] ?? []).filter((t) => t.id !== taskId),
    }))
  }

  function getTasksForDate(date: string): Task[] {
    return tasksByDate[date] ?? []
  }

  async function prefetchTasksForRange(startDate: string, endDate: string) {
    if (!user || !effectiveUserId) return
    try {
      const { byDate } = await fetchTasksForDateRange(startDate, endDate)
      setTasksByDate((prev) => {
        const next = { ...prev }
        for (const [key, tasks] of Object.entries(byDate)) {
          if (!(key in next)) next[key] = tasks
        }
        return next
      })
    } catch {
      // non-critical — month-view indicators degrade gracefully if prefetch fails
    }
  }

  return {
    tasksByDate,
    getTasksForDate,
    addTask,
    patchTask,
    removeTask,
    prefetchTasksForRange,
  }
}
