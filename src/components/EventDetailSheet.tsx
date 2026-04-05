import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { springDialog } from '../lib/motion'
import type { Event } from '../types'
import { formatTimeRange, durationMinutes } from '../lib/time'
import { useFamily } from '../context/FamilyContext'
import { getParticipantPeople } from '../lib/eventParticipants'

interface EventDetailSheetProps {
  event: Event | null
  date: string
  onClose: () => void
  onEdit: (scope: 'this' | 'all') => void
  onDelete: (scope: 'this' | 'all') => void | Promise<void>
  /** Optional: duplicate this event to another date with given start/end times. */
  onDuplicate?: (targetDate: string, start: string, end: string) => void | Promise<void>
}

export function EventDetailSheet({ event, date, onClose, onEdit, onDelete, onDuplicate }: EventDetailSheetProps) {
  const [deleting, setDeleting] = useState(false)
  const [showSeriesChoice, setShowSeriesChoice] = useState<'edit' | 'delete' | null>(null)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [dupDate, setDupDate] = useState(date)
  const [dupStart, setDupStart] = useState(event?.start ?? '15:00')
  const [dupEnd, setDupEnd] = useState(event?.end ?? '16:00')
  const [dupSaving, setDupSaving] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  if (!event) return null

  const isRecurring = !!event.recurrenceGroupId

  function handleEditClick() {
    if (isRecurring) {
      setShowSeriesChoice('edit')
    } else {
      onEdit('this')
    }
  }

  function handleDeleteClick() {
    if (isRecurring) {
      setShowSeriesChoice('delete')
    } else {
      doDelete('this')
    }
  }

  async function doDelete(scope: 'this' | 'all') {
    if (!window.confirm(
      scope === 'all'
        ? 'Slette alle aktiviteter i denne serien?'
        : 'Slette denne aktiviteten?'
    )) {
      setShowSeriesChoice(null)
      return
    }
    setDeleting(true)
    try {
      await Promise.resolve(onDelete(scope))
      onClose()
    } finally {
      setDeleting(false)
      setShowSeriesChoice(null)
    }
  }

  const { people } = useFamily()
  const participants = getParticipantPeople(event, people)
  const transport = (event.metadata as any)?.transport as
    | { dropoffBy?: string; pickupBy?: string }
    | undefined
  const dropoffPerson =
    transport?.dropoffBy != null ? people.find((p) => p.id === transport.dropoffBy) : undefined
  const pickupPerson =
    transport?.pickupBy != null ? people.find((p) => p.id === transport.pickupBy) : undefined
  const duration = durationMinutes(event.start, event.end)
  const durationStr =
    duration < 60 ? `${duration} min` : `${Math.floor(duration / 60)} t ${duration % 60} min`

  useEffect(() => {
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
  }, [onClose])

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
          className="pointer-events-auto flex w-full min-h-[52dvh] max-h-[min(92dvh,920px)] flex-col overflow-y-auto overflow-x-hidden rounded-t-[28px] bg-white shadow-card scrollbar-none"
          role="dialog"
          aria-modal="true"
          aria-label="Aktivitetsdetaljer"
        >
        <div className="sticky top-0 z-10 flex shrink-0 justify-center bg-white py-2">
          <div className="h-1 w-10 rounded-full bg-zinc-200" aria-hidden />
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-2">
          {participants.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {participants.map((person) => (
                <span
                  key={person.id}
                  className="text-[12px] font-semibold"
                  style={{ color: person.colorAccent }}
                >
                  {person.name}
                </span>
              ))}
            </div>
          )}
          <h2 className="mt-1 text-[22px] font-bold text-zinc-900">{event.title}</h2>
          <p className="mt-2 text-[15px] text-zinc-700">
            {formatTimeRange(event.start, event.end)}
          </p>
          <p className="text-[13px] text-zinc-500">Varighet: {durationStr}</p>
          {(dropoffPerson || pickupPerson) && (
            <p className="mt-1 text-[13px] text-zinc-600">
              <span className="font-medium">Transport:</span>{' '}
              {dropoffPerson && pickupPerson && dropoffPerson.id === pickupPerson.id
                ? `Leveres og hentes av ${dropoffPerson.name}`
                : [
                    dropoffPerson ? `Leveres av ${dropoffPerson.name}` : null,
                    pickupPerson ? `Hentes av ${pickupPerson.name}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
          )}
          {isRecurring && (
            <p className="mt-1 text-[12px] font-medium text-indigo-500">Gjentakende aktivitet</p>
          )}
          {event.location && (
            <p className="mt-3 text-[13px] text-zinc-600">
              <span className="font-medium">Sted:</span> {event.location}
            </p>
          )}
          {event.notes && (
            <p className="mt-2 text-[13px] text-zinc-600">
              <span className="font-medium">Notater:</span> {event.notes}
            </p>
          )}

          {showSeriesChoice ? (
            <div className="mt-6 space-y-2">
              <p className="text-[13px] font-medium text-zinc-700">
                {showSeriesChoice === 'edit' ? 'Hvilke hendelser vil du redigere?' : 'Hvilke hendelser vil du slette?'}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (showSeriesChoice === 'edit') {
                    onEdit('this')
                  } else {
                    doDelete('this')
                  }
                }}
                className="w-full rounded-full border border-zinc-300 py-3 text-[15px] font-semibold text-zinc-700 touch-manipulation"
              >
                Denne forekomsten
              </button>
              <button
                type="button"
                onClick={() => {
                  if (showSeriesChoice === 'edit') {
                    onEdit('all')
                  } else {
                    doDelete('all')
                  }
                }}
                disabled={deleting}
                className={`w-full rounded-full py-3 text-[15px] font-semibold touch-manipulation disabled:opacity-70 ${
                  showSeriesChoice === 'delete'
                    ? 'bg-red-600 text-white'
                    : 'bg-black text-white'
                }`}
              >
                {deleting ? 'Sletter…' : 'Alle i serien'}
              </button>
              <button
                type="button"
                onClick={() => setShowSeriesChoice(null)}
                className="w-full rounded-full bg-zinc-100 py-2.5 text-[14px] font-medium text-zinc-600 touch-manipulation"
              >
                Avbryt
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="flex-1 rounded-full border border-zinc-300 py-3 text-[15px] font-semibold text-zinc-700 touch-manipulation"
                >
                  Rediger
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={deleting}
                  className="flex-1 rounded-full bg-red-600 py-3 text-[15px] font-semibold text-white touch-manipulation disabled:opacity-70"
                >
                  {deleting ? 'Sletter…' : 'Slett'}
                </button>
              </div>
              {onDuplicate && !showDuplicate && (
                <button
                  type="button"
                  onClick={() => {
                    setDupDate(date)
                    setDupStart(event.start)
                    setDupEnd(event.end)
                    setShowDuplicate(true)
                  }}
                  className="mt-3 w-full rounded-full border border-dashed border-zinc-300 py-2.5 text-[14px] font-medium text-zinc-700 touch-manipulation"
                >
                  Dupliser til en annen dag…
                </button>
              )}
              {onDuplicate && showDuplicate && (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 space-y-3">
                  <p className="text-[13px] font-medium text-zinc-800">Kopier til dato og tid</p>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">Dato</label>
                    <input
                      type="date"
                      value={dupDate}
                      onChange={(e) => setDupDate(e.target.value)}
                      className="w-full rounded-full border border-zinc-200 px-3 py-2 text-[14px] outline-none focus:border-zinc-400"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">Start</label>
                      <input
                        type="time"
                        value={dupStart}
                        onChange={(e) => setDupStart(e.target.value)}
                        className="w-full rounded-full border border-zinc-200 px-3 py-2 text-[14px] outline-none focus:border-zinc-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">Slutt</label>
                      <input
                        type="time"
                        value={dupEnd}
                        onChange={(e) => setDupEnd(e.target.value)}
                        className="w-full rounded-full border border-zinc-200 px-3 py-2 text-[14px] outline-none focus:border-zinc-400"
                      />
                    </div>
                  </div>
                  {dupStart >= dupEnd && (
                    <p className="text-[11px] text-amber-600">Starttid må være før sluttid.</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDuplicate(false)}
                      className="flex-1 rounded-full border border-zinc-200 py-2 text-[13px] font-medium text-zinc-600"
                    >
                      Avbryt
                    </button>
                    <button
                      type="button"
                      disabled={dupSaving || dupStart >= dupEnd}
                      onClick={async () => {
                        setDupSaving(true)
                        try {
                          await Promise.resolve(onDuplicate(dupDate, dupStart, dupEnd))
                          onClose()
                        } finally {
                          setDupSaving(false)
                        }
                      }}
                      className="flex-1 rounded-full bg-brandTeal py-2 text-[13px] font-semibold text-white shadow-planner transition hover:brightness-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brandTeal focus:ring-offset-2"
                    >
                      {dupSaving ? 'Kopierer…' : 'Dupliser'}
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full rounded-full bg-zinc-200 py-2.5 text-[14px] font-medium text-zinc-700 touch-manipulation"
              >
                Lukk
              </button>
            </>
          )}
        </div>
      </motion.div>
      </div>
    </>
  )
}
