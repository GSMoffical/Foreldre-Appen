import type { Event } from '../types'
import { formatTimeRange } from '../lib/time'
import { useFamily } from '../context/FamilyContext'
import { formatParticipantNamesLine } from '../lib/eventParticipants'
import { COPY } from '../lib/norwegianCopy'
import { useState } from 'react'

interface TodayActionStripProps {
  nextEvent: Event | null
  minutesUntilNext: number | null
  nextEventHasConflict: boolean
  laterConflictCount: number
  moveActionLabel: string
  onDismiss: () => void
  onOpenNext: () => void
  onMarkDone: () => void
  onConfirmNext: () => void
  onDelayNext: () => void
  onMoveNext: () => void
}

function statusLabel(minutesUntilNext: number | null): string {
  if (minutesUntilNext == null) return COPY.status.laterToday
  if (minutesUntilNext <= 5) return COPY.status.now
  if (minutesUntilNext <= 120) return COPY.status.next
  return COPY.status.laterToday
}

export function TodayActionStrip({
  nextEvent,
  minutesUntilNext,
  nextEventHasConflict,
  laterConflictCount,
  moveActionLabel,
  onDismiss,
  onOpenNext,
  onMarkDone,
  onConfirmNext,
  onDelayNext,
  onMoveNext,
}: TodayActionStripProps) {
  const { people } = useFamily()
  const showAction = Boolean(nextEvent)
  const who = nextEvent ? formatParticipantNamesLine(nextEvent, people) : ''
  const [showConflictHelp, setShowConflictHelp] = useState(false)

  return (
    <div className="mx-4 mt-2 rounded-xl border border-synkaNavy/10 bg-white px-3.5 py-3 shadow-soft md:px-4 md:py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-zinc-500 md:text-caption">I dag</p>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="rounded-pill bg-synkaTeal/15 px-2.5 py-1 text-caption font-semibold text-synkaTeal">
            {statusLabel(minutesUntilNext)}
          </span>
          {nextEventHasConflict && (
            <div className="relative">
              <div className="flex items-center gap-1">
                <span className="rounded-pill bg-synkaYellow/15 px-2.5 py-1 text-caption font-semibold text-synkaNavy/70">
                  {COPY.status.needsClarification}
                </span>
                <button
                  type="button"
                  onClick={() => setShowConflictHelp((v) => !v)}
                  aria-label="Hva betyr dette?"
                  className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-pill border border-synkaYellow/60 bg-white text-caption font-semibold text-synkaNavy/60"
                >
                  i
                </button>
              </div>
              {showConflictHelp && (
                <p className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-synkaYellow/30 bg-white px-2.5 py-2 text-caption font-medium leading-snug text-zinc-700 shadow-soft">
                  {COPY.conflicts.badgeHelp}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Skjul neste hendelse"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill border border-zinc-300 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>
      {showAction ? (
        <>
          <button
            type="button"
            onClick={onOpenNext}
            className="mt-1 block w-full cursor-pointer text-left"
          >
            <p className="text-body-sm font-semibold text-zinc-900 md:text-body">{nextEvent?.title}</p>
            <p className="mt-0.5 text-caption text-zinc-600 md:text-body-sm">
              {formatTimeRange(nextEvent!.start, nextEvent!.end)}
              {who !== 'Ukjent' ? ` · ${who}` : ''}
            </p>
          </button>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onMarkDone}
              className="min-h-9 cursor-pointer rounded-pill bg-synkaPrimary px-3 py-1.5 text-caption font-semibold text-white transition hover:bg-synkaPrimaryDark"
            >
              {COPY.actions.done}
            </button>
            <button
              type="button"
              onClick={onConfirmNext}
              className="min-h-9 cursor-pointer rounded-pill bg-synkaPrimary px-3 py-1.5 text-caption font-semibold text-white transition hover:bg-synkaPrimaryDark"
            >
              {COPY.actions.confirm}
            </button>
            <button
              type="button"
              onClick={onDelayNext}
              className="min-h-9 cursor-pointer rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-caption font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              {COPY.actions.postpone15}
            </button>
            <button
              type="button"
              onClick={onMoveNext}
              className="min-h-9 cursor-pointer rounded-pill border border-zinc-300 bg-white px-3 py-1.5 text-caption font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              {moveActionLabel}
            </button>
          </div>
          <p className="mt-2 text-caption leading-relaxed text-zinc-600 md:text-caption">
            Hendelsen flyttes fra {nextEvent!.start} i dag til i morgen.
          </p>
          {!nextEventHasConflict && laterConflictCount > 0 && (
            <p className="mt-2 text-caption font-medium text-synkaNavy/70">
              {laterConflictCount === 1
                ? COPY.conflicts.laterTodayOne
                : `${laterConflictCount} ${COPY.conflicts.laterTodayManySuffix}`}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-caption text-zinc-600">Ingen neste hendelse akkurat nå.</p>
      )}
    </div>
  )
}
