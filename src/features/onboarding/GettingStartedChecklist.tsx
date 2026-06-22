import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface GettingStartedState {
  addedEvent: boolean
  addedTask: boolean
  invitedPartner: boolean
  dismissed?: boolean
}

interface GettingStartedChecklistProps {
  userId: string
  hasAddedEvent: boolean
  hasAddedTask: boolean
  hasInvitedPartner: boolean
  onNavigateToMer: () => void
}

const STORAGE_PREFIX = 'synka_getting_started_v1_'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function readState(userId: string): GettingStartedState {
  const fallback: GettingStartedState = {
    addedEvent: false,
    addedTask: false,
    invitedPartner: false,
  }
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<GettingStartedState>
    return {
      addedEvent: !!parsed.addedEvent,
      addedTask: !!parsed.addedTask,
      invitedPartner: !!parsed.invitedPartner,
      dismissed: !!parsed.dismissed,
    }
  } catch {
    return fallback
  }
}

function writeState(userId: string, state: GettingStartedState) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch {}
}

function CheckCircle() {
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-synkaPrimary">
      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    </div>
  )
}

function EmptyCircle() {
  return <div className="h-5 w-5 shrink-0 rounded-full border-2 border-zinc-300" />
}

export function GettingStartedChecklist({
  userId,
  hasAddedEvent,
  hasAddedTask,
  hasInvitedPartner,
  onNavigateToMer,
}: GettingStartedChecklistProps) {
  const reducedMotion = useReducedMotion() ?? false
  const [state, setState] = useState<GettingStartedState>(() => readState(userId))
  const [completing, setCompleting] = useState(false)

  // Re-read when the user changes
  useEffect(() => {
    setState(readState(userId))
  }, [userId])

  // Latch each task to true once the corresponding real action is done.
  useEffect(() => {
    setState((prev) => {
      const next: GettingStartedState = {
        ...prev,
        addedEvent: prev.addedEvent || hasAddedEvent,
        addedTask: prev.addedTask || hasAddedTask,
        invitedPartner: prev.invitedPartner || hasInvitedPartner,
      }
      if (
        next.addedEvent !== prev.addedEvent ||
        next.addedTask !== prev.addedTask ||
        next.invitedPartner !== prev.invitedPartner
      ) {
        writeState(userId, next)
        return next
      }
      return prev
    })
  }, [userId, hasAddedEvent, hasAddedTask, hasInvitedPartner])

  const allDone = state.addedEvent && state.addedTask && state.invitedPartner

  // Once everything is complete, persist a dismissed flag so the card never shows again.
  useEffect(() => {
    if (allDone && !state.dismissed) {
      writeState(userId, { ...state, dismissed: true })
      if (reducedMotion) {
        setState((prev) => ({ ...prev, dismissed: true }))
      } else {
        setCompleting(true)
      }
    }
  }, [allDone, state, userId, reducedMotion])

  if (state.dismissed) return null
  if (reducedMotion && allDone) return null

  const dismissEarly = () => {
    const next = { ...state, dismissed: true }
    writeState(userId, next)
    setState(next)
  }

  const rows: { label: string; done: boolean; showInvite?: boolean }[] = [
    { label: 'Legg til din første hendelse', done: state.addedEvent },
    { label: 'Legg til et gjøremål', done: state.addedTask },
    { label: 'Inviter partneren din', done: state.invitedPartner, showInvite: true },
  ]

  const content = (
    <div className="mx-4 mb-3 rounded-xl border border-synkaPrimary/15 bg-synkaPrimary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-synkaPrimary" />
          <span className="text-caption font-semibold uppercase tracking-wide text-synkaPrimary">
            Kom i gang
          </span>
        </div>
        <button
          type="button"
          onClick={dismissEarly}
          aria-label="Skjul"
          className="flex h-5 w-5 items-center justify-center rounded-full text-synkaNavy/40 transition hover:bg-synkaNavy/8"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            {row.done ? <CheckCircle /> : <EmptyCircle />}
            <span
              className={`min-w-0 flex-1 text-body-sm ${
                row.done ? 'text-zinc-400 line-through' : 'text-zinc-700'
              }`}
            >
              {row.label}
            </span>
            {row.showInvite && !row.done && (
              <button
                type="button"
                onClick={onNavigateToMer}
                className="shrink-0 text-caption font-semibold text-synkaPrimary"
              >
                → Mer
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  if (completing) {
    return (
      <motion.div
        initial={{ opacity: 1, height: 'auto' }}
        animate={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        onAnimationComplete={() => setState((prev) => ({ ...prev, dismissed: true }))}
        className="overflow-hidden"
      >
        {content}
      </motion.div>
    )
  }

  return content
}
