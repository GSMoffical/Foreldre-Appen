import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { Task } from '../types'
import type { TaskUpdates, SupabaseTaskRow } from '../lib/tasksApi'
import {
  fetchTasksForDateRange,
  createTask as createTaskApi,
  updateTask as updateTaskApi,
  deleteTask as deleteTaskApi,
  taskFromSupabaseRow,
} from '../lib/tasksApi'
import { useAuth } from '../context/AuthContext'
import { useEffectiveUserId } from '../context/EffectiveUserIdContext'
import { weekDateKeysMondayStartOslo, todayKeyOslo, addCalendarDaysOslo } from '../lib/osloCalendar'
import { useMobileRefreshTriggers } from '../features/sync/useRefreshTriggers'
import { supabase } from '../lib/supabaseClient'

function mergeFetchedTasksForDates(
  prev: Record<string, Task[]>,
  fetched: Record<string, Task[]>,
  dateKeys: string[],
  overrides: Map<string, Partial<Task>> = new Map()
): Record<string, Task[]> {
  const next = { ...prev }
  for (const key of dateKeys) {
    const fetchedTasks = fetched[key] ?? []
    next[key] = fetchedTasks.map((fetchedTask) => {
      const override = overrides.get(fetchedTask.id)
      if (override) return { ...fetchedTask, ...override }
      return fetchedTask
    })
  }
  return next
}

function mergeLookbackTasks(
  prev: Record<string, Task[]>,
  fetched: Record<string, Task[]>
): Record<string, Task[]> {
  const next = { ...prev }
  for (const [key, tasks] of Object.entries(fetched)) {
    if (!(key in next)) next[key] = tasks
  }
  return next
}

function applyLocalOverrides(
  state: Record<string, Task[]>,
  overrides: Map<string, Partial<Task>>
): Record<string, Task[]> {
  if (overrides.size === 0) return state
  const next: Record<string, Task[]> = {}
  for (const [date, tasks] of Object.entries(state)) {
    next[date] = tasks.map((t) => {
      const o = overrides.get(t.id)
      if (!o) return t
      return { ...t, ...o }
    })
  }
  return next
}

function applyRealtimeTaskChange(
  prev: Record<string, Task[]>,
  eventType: string,
  newRow: SupabaseTaskRow | null,
  oldRow: Partial<SupabaseTaskRow> | null
): Record<string, Task[]> {
  const next: Record<string, Task[]> = {}
  for (const [date, tasks] of Object.entries(prev)) {
    next[date] = [...tasks]
  }

  if (eventType === 'DELETE') {
    const id = oldRow?.id
    if (!id) return prev
    const date = oldRow?.date
    if (date && next[date]) {
      next[date] = next[date].filter((t) => t.id !== id)
      return next
    }
    for (const d of Object.keys(next)) {
      next[d] = next[d].filter((t) => t.id !== id)
    }
    return next
  }

  if (!newRow?.id) return prev
  const task = taskFromSupabaseRow(newRow)
  const oldDate = oldRow?.date

  if (oldDate && oldDate !== task.date && next[oldDate]) {
    next[oldDate] = next[oldDate].filter((t) => t.id !== task.id)
  }

  const list = (next[task.date] ?? []).filter((t) => t.id !== task.id)
  next[task.date] = [...list, task]
  return next
}

export function useTasksState(selectedDate: string) {
  const { user } = useAuth()
  const { effectiveUserId } = useEffectiveUserId()
  const [rawTasksByDate, setRawTasksByDate] = useState<Record<string, Task[]>>({})
  const [localOverrides, setLocalOverrides] = useState<Map<string, Partial<Task>>>(new Map())
  const [refreshKey, setRefreshKey] = useState(0)
  const refreshDebounceRef = useRef<number | null>(null)
  const lookbackFetchedRef = useRef(false)
  const fetchRequestIdRef = useRef(0)

  const tasksByDate = useMemo(
    () => applyLocalOverrides(rawTasksByDate, localOverrides),
    [rawTasksByDate, localOverrides]
  )

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
      if (requestId !== fetchRequestIdRef.current) return
      setRawTasksByDate((prev) => mergeFetchedTasksForDates(prev, byDate, weekKeys, localOverrides))
    })()
  }, [user, effectiveUserId, selectedDate, refreshKey, localOverrides])

  useEffect(() => {
    setRawTasksByDate({})
    setLocalOverrides(new Map())
    lookbackFetchedRef.current = false
    fetchRequestIdRef.current = 0
  }, [effectiveUserId])

  useEffect(() => {
    if (!user || !effectiveUserId || lookbackFetchedRef.current) return
    lookbackFetchedRef.current = true
    const todayKey = todayKeyOslo()
    const startKey = addCalendarDaysOslo(todayKey, -28)
    const endKey = addCalendarDaysOslo(todayKey, -1)
    ;(async () => {
      try {
        const { byDate } = await fetchTasksForDateRange(startKey, endKey)
        setRawTasksByDate((prev) => mergeLookbackTasks(prev, byDate))
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
    intervalMs: 30_000,
  })

  useEffect(() => {
    if (!user || !effectiveUserId) return

    const channel = supabase
      .channel(`realtime-tasks-${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${effectiveUserId}`,
        },
        (payload) => {
          const newRow = payload.new as SupabaseTaskRow | null
          const oldRow = payload.old as Partial<SupabaseTaskRow> | null
          setRawTasksByDate((prev) => {
            if (payload.eventType === 'UPDATE' && newRow?.id && newRow?.updated_at) {
              const existingDate = newRow.date ?? oldRow?.date
              const existingTasks = existingDate ? (prev[existingDate] ?? []) : []
              const existingRow = existingTasks.find((t) => t.id === newRow.id)
              if (existingRow) {
                const existingCompletedAt = existingRow.completedAt
                const incomingCompletedAt = newRow.completed_at
                if (existingCompletedAt && !incomingCompletedAt) {
                  return prev
                }
              }
            }
            return applyRealtimeTaskChange(prev, payload.eventType, newRow, oldRow)
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, effectiveUserId])

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
    setRawTasksByDate((prev) => {
      const existing = prev[input.date] ?? []
      return { ...prev, [input.date]: [...existing, created] }
    })
  }

  async function patchTask(taskId: string, oldDate: string, updates: TaskUpdates) {
    if (!user) throw new Error('Must be signed in to edit tasks')
    fetchRequestIdRef.current++
    setLocalOverrides((prev) => new Map(prev).set(taskId, updates as Partial<Task>))

    const newDate = updates.date ?? oldDate
    let revertSnapshot: Record<string, Task[]> | null = null

    setRawTasksByDate((prev) => {
      const existing = prev[oldDate]?.find((t) => t.id === taskId)
      if (!existing) return prev
      revertSnapshot = snapshotTasksByDate(prev)
      const optimistic = applyTaskUpdates(existing, updates)
      return setTaskInByDate(prev, taskId, oldDate, newDate, optimistic)
    })

    try {
      const updated = await updateTaskApi(taskId, updates)
      if (!updated) throw new Error('Could not update task')
      setRawTasksByDate((prev) => setTaskInByDate(prev, taskId, oldDate, newDate, updated))
    } catch (err) {
      if (revertSnapshot) setRawTasksByDate(revertSnapshot)
      setLocalOverrides((prev) => { const m = new Map(prev); m.delete(taskId); return m })
      throw err
    } finally {
      window.setTimeout(() => {
        setLocalOverrides((prev) => { const m = new Map(prev); m.delete(taskId); return m })
      }, 5000)
    }
  }

  async function removeTask(taskId: string, date: string) {
    if (!user || !effectiveUserId) throw new Error('Must be signed in to delete tasks')
    fetchRequestIdRef.current++
    const ok = await deleteTaskApi(taskId, effectiveUserId)
    if (!ok) throw new Error('Could not delete task')
    setRawTasksByDate((prev) => ({
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
      const keys = Object.keys(byDate)
      setRawTasksByDate((prev) => mergeFetchedTasksForDates(prev, byDate, keys))
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
