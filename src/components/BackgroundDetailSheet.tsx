import { motion } from 'framer-motion'
import type { Event, Person, WeekdayMonFri } from '../types'
import { springDialog } from '../lib/motion'
import { useFamily } from '../context/FamilyContext'
import { dateKeyToWeekdayMon0 } from '../lib/weekday'
import { subjectLabelForKey } from '../data/norwegianSubjects'
import { formatTimeRange, parseTime } from '../lib/time'
import { getEventParticipantIds } from '../lib/schedule'
import { COPY } from '../lib/norwegianCopy'
import { hasTimeOverlap } from '../lib/collisions'

interface BackgroundDetailSheetProps {
  event: Event | null
  date: string
  foregroundEvents: Event[]
  onResolveConflict?: (input: {
    rowLabel: string
    rowStart: string
    rowEnd: string
    conflictEventId: string
    conflictTitle: string
    severity: 'soft' | 'hard'
    decision: 'prioritize_background' | 'prioritize_foreground' | 'clarify_later'
  }) => void | Promise<void>
  onClose: () => void
}

type TimeRow = {
  start: string
  end: string
  label: string
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return hasTimeOverlap(aStart, aEnd, bStart, bEnd)
}

function toTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function buildAlternativeSlots(rowStart: string, rowEnd: string, conflictStart: string, conflictEnd: string): string[] {
  const rowDuration = Math.max(15, parseTime(rowEnd) - parseTime(rowStart))
  const beforeEnd = parseTime(conflictStart)
  const beforeStart = beforeEnd - rowDuration
  const afterStart = parseTime(conflictEnd)
  const afterEnd = afterStart + rowDuration
  return [`${toTime(beforeStart)}-${toTime(beforeEnd)}`, `${toTime(afterStart)}-${toTime(afterEnd)}`]
}

function buildSchoolRows(person: Person, dateKey: string): TimeRow[] {
  const school = person.school
  if (!school) return []
  const mon0 = dateKeyToWeekdayMon0(dateKey)
  if (mon0 > 4) return []
  const wd = mon0 as WeekdayMonFri
  const plan = school.weekdays[wd]
  if (!plan?.lessons?.length || plan.useSimpleDay) {
    return [{ start: plan?.schoolStart ?? '08:15', end: plan?.schoolEnd ?? '14:30', label: 'Skole' }]
  }
  const lessons = [...plan.lessons].sort((a, b) => a.start.localeCompare(b.start))
  return lessons.map((L) => ({
    start: L.start,
    end: L.end,
    label: subjectLabelForKey(school.gradeBand, L.subjectKey, L.customLabel),
  }))
}

export function BackgroundDetailSheet({ event, date, foregroundEvents, onResolveConflict, onClose }: BackgroundDetailSheetProps) {
  const { people } = useFamily()
  if (!event) return null

  const person = people.find((p) => p.id === event.personId)
  if (!person) return null
  const isSchool = event.metadata?.backgroundKind === 'school'
  const title = isSchool ? 'Timeplan' : 'Arbeidsblokk'
  const rows = isSchool ? buildSchoolRows(person, date) : [{ start: event.start, end: event.end, label: 'Arbeid' }]

  const relevantForeground = foregroundEvents.sort((a, b) => a.start.localeCompare(b.start))

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
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={springDialog}
          className="pointer-events-auto flex w-full min-h-[44dvh] max-h-[min(86dvh,820px)] flex-col overflow-y-auto overflow-x-hidden rounded-t-[28px] bg-white shadow-card scrollbar-none"
          role="dialog"
          aria-modal="true"
          aria-label="Detaljer skole og jobb"
        >
          <div className="sticky top-0 z-10 flex shrink-0 justify-center bg-white py-2">
            <div className="h-1 w-10 rounded-full bg-zinc-200" aria-hidden />
          </div>
          <div className="px-5 pb-[calc(1.75rem+env(safe-area-inset-bottom,0px))] pt-1">
            <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-500">{title}</p>
            <h2 className="mt-1 text-[20px] font-bold text-zinc-900">{person.name}</h2>
            <p className="mt-1 text-[13px] text-zinc-600">{formatTimeRange(event.start, event.end)}</p>

            <div className="mt-4 space-y-2">
              {rows.map((r, idx) => {
                const conflicts = relevantForeground.filter((ev) => overlaps(r.start, r.end, ev.start, ev.end))
                return (
                  <div key={`${r.start}-${r.end}-${idx}`} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-zinc-900">{r.label}</p>
                      <p className="text-[12px] text-zinc-600">{formatTimeRange(r.start, r.end)}</p>
                    </div>
                    {conflicts.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {conflicts.map((c) => {
                          const needsResolution = !isSchool && getEventParticipantIds(c).includes(person.id)
                          const severity: 'soft' | 'hard' = needsResolution ? 'hard' : 'soft'
                          const severityLabel = severity === 'hard' ? COPY.status.needsClarification : COPY.conflicts.note
                          const alternatives = buildAlternativeSlots(r.start, r.end, c.start, c.end)
                          return (
                            <div key={c.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[12px] font-semibold text-amber-900">
                                  {COPY.conflicts.collidesWith}: {c.title} ({formatTimeRange(c.start, c.end)})
                                </p>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                  {severityLabel}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-amber-800">
                                {COPY.conflicts.suggestion}: {alternatives[0]} eller {alternatives[1]}
                              </p>
                              {needsResolution ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onResolveConflict?.({
                                        rowLabel: r.label,
                                        rowStart: r.start,
                                        rowEnd: r.end,
                                        conflictEventId: c.id,
                                        conflictTitle: c.title,
                                        severity,
                                        decision: 'prioritize_background',
                                      })
                                    }
                                    className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100"
                                  >
                                    Prioriter {r.label.toLowerCase()}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onResolveConflict?.({
                                        rowLabel: r.label,
                                        rowStart: r.start,
                                        rowEnd: r.end,
                                        conflictEventId: c.id,
                                        conflictTitle: c.title,
                                        severity,
                                        decision: 'prioritize_foreground',
                                      })
                                    }
                                    className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100"
                                  >
                                    {COPY.actions.prioritizeActivity}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onResolveConflict?.({
                                        rowLabel: r.label,
                                        rowStart: r.start,
                                        rowEnd: r.end,
                                        conflictEventId: c.id,
                                        conflictTitle: c.title,
                                        severity,
                                        decision: 'clarify_later',
                                      })
                                    }
                                    className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100"
                                  >
                                    {COPY.actions.clarifyLater}
                                  </button>
                                </div>
                              ) : (
                                <p className="mt-2 text-[11px] text-amber-800">
                                  Skole + avtale regnes som planlagt og trenger ikke avklaring.
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-[12px] text-zinc-500">{COPY.conflicts.noCollisions}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
