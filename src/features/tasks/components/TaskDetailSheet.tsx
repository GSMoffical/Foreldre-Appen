import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { springDialog } from '../../../lib/motion'
import {
  sheetPanel,
  sheetHandle,
  sheetHandleBar,
  sheetDetailBody,
  typDisplay,
  typBody,
  typBodyMuted,
  typCaption,
  typSectionCap,
  btnPrimary,
  btnSecondary,
  btnDanger,
} from '../../../lib/ui'
import type { Task } from '../../../types'
import { taskIntentLabelNb } from '../../../lib/taskIntent'
import { useFamily } from '../../../context/FamilyContext'

function formatTaskDayHeading(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateKey
  return d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
}

export interface TaskDetailSheetProps {
  task: Task | null
  onClose: () => void
  onEdit: () => void
  onMarkComplete: (task: Task) => void | Promise<void>
  onReopen: (task: Task) => void | Promise<void>
  onDelete: (task: Task) => void | Promise<void>
}

export function TaskDetailSheet({
  task,
  onClose,
  onEdit,
  onMarkComplete,
  onReopen,
  onDelete,
}: TaskDetailSheetProps) {
  const { people } = useFamily()
  const [busy, setBusy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!task) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = dialogRef.current
    const focusables = root?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    focusables?.[0]?.focus()

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Tab' && focusables && focusables.length > 1) {
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      previousFocusRef.current?.focus()
    }
  }, [task, onClose])

  if (!task) return null

  const childPerson = task.childPersonId ? people.find((p) => p.id === task.childPersonId) : undefined
  const assignedPerson = task.assignedToPersonId ? people.find((p) => p.id === task.assignedToPersonId) : undefined
  const isDone = !!task.completedAt
  const intent = task.taskIntent ?? 'must_do'

  async function run(action: () => void | Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await Promise.resolve(action())
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-30 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center px-3">
        <motion.div
          ref={dialogRef}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={springDialog}
          className={sheetPanel}
          role="dialog"
          aria-modal="true"
          aria-label="Gjøremålsdetaljer"
        >
          <div className={`${sheetHandle} relative`}>
            <div className={sheetHandleBar} aria-hidden />
            <button
              type="button"
              onClick={onClose}
              aria-label="Lukk"
              className="absolute right-3 top-1 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 touch-manipulation"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className={sheetDetailBody}>
            <h2 className={`${typDisplay} pr-10`}>{task.title}</h2>
            <p className={`mt-1 ${typBodyMuted}`}>{formatTaskDayHeading(task.date)}</p>
            {task.dueTime ? (
              <p className={`mt-2 ${typBody}`}>
                <span className="font-medium text-zinc-800">Klokkeslett: </span>
                <span className="tabular-nums">{task.dueTime}</span>
              </p>
            ) : null}

            <div className="mt-4 space-y-2">
              <p className={typSectionCap}>Status</p>
              <p className={typBody}>{isDone ? 'Fullført' : 'Åpen'}</p>
            </div>

            <div className="mt-4 space-y-2">
              <p className={typSectionCap}>Type</p>
              <p className={typBody}>{taskIntentLabelNb(intent)}</p>
            </div>

            {childPerson ? (
              <div className="mt-4 space-y-2">
                <p className={typSectionCap}>Gjelder</p>
                <p className={typBody}>{childPerson.name}</p>
              </div>
            ) : null}

            {assignedPerson ? (
              <div className="mt-4 space-y-2">
                <p className={typSectionCap}>Ansvarlig</p>
                <p className={typBody}>{assignedPerson.name}</p>
              </div>
            ) : null}

            {task.notes?.trim() ? (
              <div className="mt-4 space-y-2">
                <p className={typSectionCap}>Notater</p>
                <p className={`${typBody} whitespace-pre-wrap`}>{task.notes.trim()}</p>
                <p className={typCaption}>
                  Importert tekst og kontekst fra Tankestrømmen ligger ofte i notater.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <p className={typSectionCap}>Notater</p>
                <p className={typBodyMuted}>Ingen notater.</p>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <button type="button" className={btnSecondary} disabled={busy} onClick={() => onEdit()}>
                Rediger
              </button>
              {isDone ? (
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy}
                  onClick={() => void run(() => onReopen(task))}
                >
                  Gjenåpne
                </button>
              ) : (
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy}
                  onClick={() => void run(() => onMarkComplete(task))}
                >
                  Marker som fullført
                </button>
              )}
              {showDeleteConfirm ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3">
                  <p className="text-body-sm text-rose-900">Slette dette gjøremålet?</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className={`${btnDanger} flex-1 py-2.5 text-body-sm`}
                      disabled={busy}
                      onClick={() => void run(async () => {
                        await onDelete(task)
                        onClose()
                      })}
                    >
                      Slett
                    </button>
                    <button
                      type="button"
                      className={`${btnSecondary} flex-1 py-2.5 text-body-sm`}
                      disabled={busy}
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={btnDanger}
                  disabled={busy}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Slett
                </button>
              )}
              <button type="button" className={btnSecondary} disabled={busy} onClick={onClose}>
                Lukk
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
