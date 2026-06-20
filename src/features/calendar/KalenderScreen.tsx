import { useState, useEffect, lazy, Suspense } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CalendarHomeTab } from './CalendarHomeTab'
import { FamilyFilterBar } from '../../components/FamilyFilterBar'
import { todayKeyOslo } from '../../lib/osloCalendar'
import type { AppOutletContext } from '../../App'

const MonthView = lazy(() =>
  import('../../components/MonthView').then((m) => ({ default: m.MonthView }))
)

type Zoom = 'dag' | 'uke' | 'maned'

const ZOOM_STORAGE_KEY = 'synka:kalender-zoom'

const ZOOMS: { id: Zoom; label: string }[] = [
  { id: 'dag', label: 'Dag' },
  { id: 'uke', label: 'Uke' },
  { id: 'maned', label: 'Måned' },
]

/** Reads the persisted zoom, defaulting to 'uke'. Mirrors the try/catch localStorage pattern used elsewhere. */
function readStoredZoom(): Zoom {
  try {
    const stored = localStorage.getItem(ZOOM_STORAGE_KEY)
    if (stored === 'dag' || stored === 'uke' || stored === 'maned') return stored
  } catch {}
  return 'uke'
}

/**
 * The `/kalender` route. Wraps the existing week/day view (CalendarHomeTab) and the
 * month grid (MonthView) behind a Dag / Uke / Måned zoom control. Zoom is owned and
 * persisted here; everything else flows in unchanged from the AppLayout outlet context.
 */
export function KalenderScreen() {
  const { calendar, month } = useOutletContext<AppOutletContext>()
  const [zoom, setZoom] = useState<Zoom>(readStoredZoom)

  // Persist zoom across refreshes.
  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, zoom)
    } catch {}
  }, [zoom])

  // Dag focuses today on first render only — afterwards the user is free to browse other days.
  useEffect(() => {
    if (zoom === 'dag') calendar.setSelectedDate(todayKeyOslo())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden">
      {/* Zoom control — pinned above every zoom level */}
      <div
        className="shrink-0 bg-synkaCream px-4 pb-2 pt-2"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center rounded-pill bg-synkaNavy/8 p-[2px]">
          {ZOOMS.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setZoom(z.id)}
              aria-pressed={zoom === z.id}
              className={`flex-1 rounded-pill px-3 py-1 text-caption transition touch-manipulation ${
                zoom === z.id ? 'bg-white font-semibold text-synkaPrimary' : 'text-synkaNavy/40'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {zoom === 'maned' ? (
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          {/* Month grid is person-filtered via the shared selectedPersonIds, so the filter bar stays useful here. */}
          <FamilyFilterBar
            selectedPersonIds={calendar.selectedPersonIds}
            onFilterChange={(ids) =>
              calendar.setSelectedPersonIds(ids.length === month.people.length ? [] : ids)
            }
            mePersonId={calendar.mePersonId}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Suspense fallback={null}>
              <MonthView
                selectedDate={calendar.selectedDate}
                onSelectDate={(date) => {
                  setZoom('dag')
                  calendar.setSelectedDate(date)
                }}
                events={month.events}
                people={month.people}
                onVisibleMonthRange={month.onVisibleMonthRange}
                overdueTaskDates={month.overdueTaskDates}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <CalendarHomeTab {...calendar} />
      )}
    </div>
  )
}
