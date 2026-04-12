import { useCallback } from 'react'
import type { Task } from '../../../types'
import type { TaskUpdates } from '../../../lib/tasksApi'
import { useUndo } from '../../../context/UndoContext'
import { logEvent } from '../../../lib/appLogger'

// ─── Options ──────────────────────────────────────────────────────────────────

export interface UseTaskControllerOptions {
  addTask: (input: Omit<Task, 'id'>) => Promise<void>
  patchTask: (taskId: string, date: string, updates: TaskUpdates) => Promise<void>
  removeTask: (taskId: string, date: string) => Promise<void>
  showSavingFeedback: () => void
  showSaveFeedback: () => void
  showSaveError: () => void
}

// ─── Return ────────────────────────────────────────────────────────────────────

export interface UseTaskControllerReturn {
  /** Create a new task. Wraps with saving/saved/error feedback. */
  createTask: (input: Omit<Task, 'id'>) => Promise<void>
  /** Save edits to an existing task. Wraps with feedback. */
  editTask: (task: Task, updates: Omit<TaskUpdates, 'completedAt'>) => Promise<void>
  /** Mark task done (sets completedAt). Registers undo. */
  markTaskDone: (task: Task) => Promise<void>
  /** Remove completedAt (reverse of markTaskDone). Wraps with feedback. */
  undoTaskComplete: (task: Task) => Promise<void>
  /** Delete task with undo (re-creates on undo). */
  deleteTask: (task: Task) => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTaskController({
  addTask: addTaskData,
  patchTask: patchTaskData,
  removeTask: removeTaskData,
  showSavingFeedback,
  showSaveFeedback,
  showSaveError,
}: UseTaskControllerOptions): UseTaskControllerReturn {
  const { showUndo } = useUndo()

  const run = useCallback(
    async (fn: () => Promise<void>): Promise<void> => {
      showSavingFeedback()
      try {
        await fn()
        showSaveFeedback()
      } catch (err) {
        showSaveError()
        throw err
      }
    },
    [showSavingFeedback, showSaveFeedback, showSaveError]
  )

  const runWithUndo = useCallback(
    async (
      fn: () => Promise<void>,
      undoMessage: string,
      onUndo: () => Promise<void>
    ): Promise<void> => {
      showSavingFeedback()
      try {
        await fn()
        showUndo({ message: undoMessage, onUndo })
        showSaveFeedback()
      } catch (err) {
        showSaveError()
        throw err
      }
    },
    [showSavingFeedback, showSaveFeedback, showSaveError, showUndo]
  )

  const createTask = useCallback(
    async (input: Omit<Task, 'id'>) => {
      await run(() => addTaskData(input))
      logEvent('task_created', { title: input.title, date: input.date, hasAssignee: !!input.assignedToPersonId })
    },
    [run, addTaskData]
  )

  const editTask = useCallback(
    async (task: Task, updates: Omit<TaskUpdates, 'completedAt'>) => {
      await run(() => patchTaskData(task.id, task.date, updates))
      logEvent('task_edited', { taskId: task.id, fields: Object.keys(updates) })
    },
    [run, patchTaskData]
  )

  const markTaskDone = useCallback(
    (task: Task) => {
      logEvent('task_completed', { title: task.title, date: task.date })
      const previousCompleted = task.completedAt
      return runWithUndo(
        () => patchTaskData(task.id, task.date, { completedAt: new Date().toISOString() }),
        `"${task.title}" markert som ferdig`,
        () => patchTaskData(task.id, task.date, { completedAt: previousCompleted })
      )
    },
    [runWithUndo, patchTaskData]
  )

  const undoTaskComplete = useCallback(
    async (task: Task) => {
      await run(() => patchTaskData(task.id, task.date, { completedAt: undefined }))
      logEvent('task_uncompleted', { title: task.title, date: task.date })
    },
    [run, patchTaskData]
  )

  const deleteTask = useCallback(
    (task: Task) => {
      logEvent('task_deleted', { title: task.title, date: task.date })
      const snapshot = { ...task }
      return runWithUndo(
        () => removeTaskData(snapshot.id, snapshot.date),
        `"${snapshot.title}" ble slettet`,
        async () => {
          const { id: _id, ...rest } = snapshot
          await addTaskData(rest)
        }
      )
    },
    [runWithUndo, removeTaskData, addTaskData]
  )

  return { createTask, editTask, markTaskDone, undoTaskComplete, deleteTask }
}
