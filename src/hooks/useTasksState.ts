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

  async function addTask(input: Omit<Task, 'id'>) {
    if (!user || !effectiveUserId) throw new Error('Must be signed in to add tasks')
    const created = await createTaskApi(effectiveUserId, input)
    if (!created) throw new Error('Could not save task')
    setTasksByDate((prev) => {
      const existing = prev[input.date] ?? []
      return { ...prev, [input.date]: [...existing, created] }
    })
  }

  async function patchTask(taskId: string, oldDate: string, updates: TaskUpdates) {
    if (!user) throw new Error('Must be signed in to edit tasks')
    const updated = await updateTaskApi(taskId, updates)
    if (!updated) throw new Error('Could not update task')
    const newDate = updates.date ?? oldDate
    if (newDate !== oldDate) {
      setTasksByDate((prev) => ({
        ...prev,
        [oldDate]: (prev[oldDate] ?? []).filter((t) => t.id !== taskId),
        [newDate]: [...(prev[newDate] ?? []), updated],
      }))
    } else {
      setTasksByDate((prev) => ({
        ...prev,
        [oldDate]: (prev[oldDate] ?? []).map((t) => (t.id === taskId ? updated : t)),
      }))
    }
  }

  async function removeTask(taskId: string, date: string) {
    if (!user || !effectiveUserId) throw new Error('Must be signed in to delete tasks')
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
