import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Event, Person } from '../types'
import { formatCalendarEventTimeLabel } from '../lib/schedule'
import { getParticipantPeople } from '../lib/eventParticipants'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import {
  ensureNorwegianHolidaysLoaded,
  formatNorwegianCalendarSummary,
} from '../lib/norwegianSchoolCalendar'

interface MonthViewProps {
  selectedDate: string
  onSelectDate: (date: string) => void
  events: Record<string, Event[]>
  people: Person[]
  calendarDayNotes?: Record<string, string>
  onVisibleMonthRange?: (startDate: string, endDate: string) => void
  overdueTaskDates?: Set<string>
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

const MONTH_NAMES_LOW = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]

const LONG_DAY_NB = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']

const DAY_COL_HEADERS = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø']

const PEEK_MAX_EVENTS = 4

/** Local calendar day as YYYY-MM-DD (avoid UTC off-by-one). */
function dateToKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function todayKeyLocal(): string {
  return dateToKey(new Date())
}

function monthDateRange(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { start: ymd(new Date(year, month, 1)), end: ymd(new Date(year, month + 1, 0)) }
}

interface GridCell {
  date: Date
  dateKey: string
  isCurrentMonth: boolean
}

function buildMonthGrid(year: number, month: number): GridCell[] {
  const first = new Date(year, month, 1)
  const startDay = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: GridCell[] = []

  for (let i = startDay; i > 0; i--) {
    const d = new Date(year, month, 1 - i)
    cells.push({ date: d, dateKey: dateToKey(d), isCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    cells.push({ date, dateKey: dateToKey(date), isCurrentMonth: true })
  }
  let next = 1
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, next++)
    cells.push({ date: d, dateKey: dateToKey(d), isCurrentMonth: false })
  }
  return cells
}

function chunkRows(cells: GridCell[]): GridCell[][] {
  const rows: GridCell[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

function formatPeekDate(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00')
  return `${LONG_DAY_NB[d.getDay()]} ${d.getDate()}. ${MONTH_NAMES_LOW[d.getMonth()]}`
}

function getPersonDotsForDay(dayEvents: Event[], people: Person[]): Person[] {
  const ids = new Set<string>()
  for (const ev of dayEvents) {
    if (ev.metadata?.calendarLayer === 'background') continue
    if (ev.personId) ids.add(ev.personId)
    if (ev.metadata?.participants) {
      for (const pid of ev.metadata.participants) ids.add(pid)
    }
  }
  return people.filter((p) => ids.has(p.id)).slice(0, 3)
}

export function MonthView({
  selectedDate,
  onSelectDate,
  events,
  people,
  calendarDayNotes,
  onVisibleMonthRange,
  overdueTaskDates = new Set(),
}: MonthViewProps) {
  const initParts = selectedDate.split('-').map(Number)
  const [viewYear, setViewYear] = useState(() => initParts[0])
  const [viewMonth, setViewMonth] = useState(() => initParts[1] - 1)
  const [direction, setDirection] = useState(1)
  const [holidaysReady, setHolidaysReady] = useState(false)
  const reducedMotion = useReducedMotion() ?? false

  const todayKey = useMemo(() => todayKeyLocal(), [])

  useEffect(() => {
    void ensureNorwegianHolidaysLoaded().then(() => setHolidaysReady(true))
  }, [])

  useEffect(() => {
    const { start, end } = monthDateRange(viewYear, viewMonth)
    onVisibleMonthRange?.(start, end)
  }, [viewYear, viewMonth, onVisibleMonthRange])

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])
  const weekRows = useMemo(() => chunkRows(cells), [cells])

  function prevMonth() {
    setDirection(-1)
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11) }
    else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    setDirection(1)
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0) }
    else setViewMonth((m) => m + 1)
  }

  function handleTodayPill() {
    const today = new Date()
    setDirection(0)
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    onSelectDate(todayKey)
  }

  const selectedDayEvents = useMemo(() => {
    const list = [...(events[selectedDate] ?? [])].filter(
      (ev) => ev.metadata?.calendarLayer !== 'background'
    )
    list.sort((a, b) => a.start.localeCompare(b.start))
    return list
  }, [events, selectedDate])

  const selectedDayCalendarNote = useMemo(() => {
    if (calendarDayNotes?.[selectedDate]) return calendarDayNotes[selectedDate]
    if (!holidaysReady) return null
    return formatNorwegianCalendarSummary(selectedDate)
  }, [calendarDayNotes, selectedDate, holidaysReady])

  const gridVariants = reducedMotion
    ? { enter: {}, center: {}, exit: {} }
    : {
        enter: (dir: number) => ({ x: dir >= 0 ? 20 : -20, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir >= 0 ? -20 : 20, opacity: 0 }),
      }

  const peekTotal = selectedDayEvents.length
  const peekPreview = selectedDayEvents.slice(0, PEEK_MAX_EVENTS)
  const peekRest = Math.max(0, peekTotal - PEEK_MAX_EVENTS)

  return (
    <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto scrollbar-none">
      {/* HEADER */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-baseline">
          <span className="text-display font-bold text-synkaPrimary">{MONTH_NAMES[viewMonth]}</span>
          <span className="ml-1.5 text-body text-synkaNavy/40">{viewYear}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTodayPill}
            className="rounded-pill bg-synkaPrimary/8 px-3 py-1.5 text-caption font-semibold text-synkaPrimary active:opacity-70 touch-manipulation"
            aria-label="Gå til i dag"
          >
            I dag
          </button>
          <button
            type="button"
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-synkaNavy/10 bg-white text-synkaNavy/60 active:opacity-70 touch-manipulation"
            aria-label="Forrige måned"
          >
            <IconChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-synkaNavy/10 bg-white text-synkaNavy/60 active:opacity-70 touch-manipulation"
            aria-label="Neste måned"
          >
            <IconChevronRight size={18} aria-hidden />
          </button>
        </div>
      </div>

      {/* DAY COLUMN HEADERS */}
      <div className="grid shrink-0 grid-cols-7 px-4 mb-1">
        {DAY_COL_HEADERS.map((d) => (
          <div key={d} className="text-center text-caption font-semibold uppercase text-synkaNavy/40">
            {d}
          </div>
        ))}
      </div>

      {/* CALENDAR GRID */}
      <div className="relative shrink-0 px-4 overflow-hidden">
        <AnimatePresence custom={direction} mode="wait" initial={false}>
          <motion.div
            key={`${viewYear}-${viewMonth}`}
            custom={direction}
            variants={gridVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.18 }}
            className="grid grid-cols-7"
          >
            {weekRows.map((row, rowIdx) =>
              row.map((cell, colIdx) => {
                const isCurrentMonth = cell.isCurrentMonth
                const isSelected = cell.dateKey === selectedDate
                const isToday = cell.dateKey === todayKey
                const dayNum = cell.date.getDate()
                const dayEvents = events[cell.dateKey] ?? []
                const dots = isCurrentMonth ? getPersonDotsForDay(dayEvents, people) : []

                let cellBg = ''
                let numClass = 'text-[15px] font-normal text-synkaNavy/70'

                if (!isCurrentMonth) {
                  numClass = 'text-[15px] text-synkaNavy/20'
                } else if (isSelected) {
                  cellBg = 'bg-synkaPrimary rounded-xl'
                  numClass = 'text-[15px] font-bold text-white'
                } else if (isToday) {
                  cellBg = 'bg-synkaPrimary/6 rounded-xl'
                  numClass = 'text-[15px] font-semibold text-synkaPrimary'
                }

                return (
                  <button
                    key={`${rowIdx}-${colIdx}`}
                    type="button"
                    aria-label={`${dayNum}. ${MONTH_NAMES[cell.date.getMonth()]} ${cell.date.getFullYear()}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelectDate(cell.dateKey)}
                    className={`relative min-h-[48px] flex flex-col items-center justify-center rounded-xl cursor-pointer active:scale-95 touch-manipulation select-none transition-transform ${cellBg}`}
                  >
                    {isCurrentMonth && (overdueTaskDates.has(cell.dateKey) || isToday) && (
                      <span
                        className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                          overdueTaskDates.has(cell.dateKey) ? 'bg-synkaCoral' : 'bg-synkaYellow'
                        }`}
                        aria-hidden
                      />
                    )}
                    <span className={numClass}>{dayNum}</span>
                    {dots.length > 0 && (
                      <span className="flex gap-[3px] mt-1 h-[5px] items-center" aria-hidden>
                        {dots.map((p) => (
                          <span
                            key={p.id}
                            className="w-[5px] h-[5px] rounded-full"
                            style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : p.colorAccent }}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* DIVIDER */}
      <div className="shrink-0 border-t border-synkaNavy/8 mx-4 mt-3" />

      {/* DAY PEEK SECTION */}
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-body-sm font-semibold text-synkaNavy">
            {formatPeekDate(selectedDate)}
          </span>
          <button
            type="button"
            onClick={() => onSelectDate(selectedDate)}
            className="text-caption font-semibold text-synkaPrimary active:opacity-70 touch-manipulation"
          >
            Se dagen →
          </button>
        </div>

        {selectedDayCalendarNote && (
          <p className="text-caption text-synkaNavy/50 mb-2">{selectedDayCalendarNote}</p>
        )}

        {peekTotal === 0 ? (
          <p className="text-body-sm text-synkaNavy/40 italic">Ingen hendelser</p>
        ) : (
          <ul className="space-y-0">
            {peekPreview.map((ev) => {
              const plist = getParticipantPeople(ev, people)
              const firstPerson = plist[0]
              const personName = firstPerson?.name
              const timeLabel = ev.metadata?.isAllDay
                ? 'Heldags'
                : formatCalendarEventTimeLabel(ev)
              return (
                <li key={ev.id} className="flex items-center gap-2 py-1.5">
                  <span
                    className="w-2 h-2 shrink-0 rounded-full"
                    style={{ backgroundColor: firstPerson?.colorAccent ?? 'rgb(113,113,122)' }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm text-synkaNavy font-medium truncate">{ev.title}</p>
                    {personName && (
                      <p className="text-caption text-synkaNavy/50">{personName}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-caption text-synkaNavy/40 tabular-nums">
                    {timeLabel}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {peekRest > 0 && (
          <p className="text-caption text-synkaNavy/40 mt-1">og {peekRest} til…</p>
        )}
      </div>
    </div>
  )
}
