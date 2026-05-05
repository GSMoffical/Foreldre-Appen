import { LayoutGroup, motion } from 'framer-motion'
import { springSnappy } from '../../lib/motion'

export type NavTab = 'today' | 'week' | 'month' | 'logistics' | 'settings'

interface SynkaBottomNavProps {
  active: NavTab
  onSelect?: (tab: NavTab) => void
  logisticsNotifyCount?: number
  /** The last active calendar tab — used to restore context when returning from tasks/settings. */
  lastCalendarTab?: 'today' | 'week' | 'month'
}

const VIEW_CYCLE: NavTab[] = ['today', 'week', 'month']

function viewLabel(tab: NavTab): string {
  if (tab === 'today') return 'I dag'
  if (tab === 'week') return 'Uke'
  if (tab === 'month') return 'Måned'
  return 'I dag'
}

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="18" rx="3"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
)

const TasksIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
)

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
)

export function SynkaBottomNav({ active, onSelect, logisticsNotifyCount = 0, lastCalendarTab = 'today' }: SynkaBottomNavProps) {
  const calendarActive = active !== 'settings' && active !== 'logistics'
  const currentView = calendarActive ? active : lastCalendarTab

  function cycleView() {
    const idx = VIEW_CYCLE.indexOf(currentView)
    const next = VIEW_CYCLE[(idx + 1) % VIEW_CYCLE.length]
    onSelect?.(next)
  }

  const navItemBase = 'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-150 touch-manipulation select-none'

  return (
    <nav
      className="synka-nav relative flex h-[68px] min-h-[68px] w-full max-w-full min-w-0 shrink-0 items-stretch overflow-hidden px-3"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <LayoutGroup id="synka-bottom-nav">
        <div className="relative flex min-w-0 flex-1 items-center gap-1 py-2">

          {/* Calendar button */}
          <button
            id="onb-nav-cycle"
            type="button"
            aria-label={calendarActive ? `Bytt kalendervisning (${viewLabel(currentView)})` : `Tilbake til kalender`}
            onClick={() => {
              if (active === 'settings' || active === 'logistics') {
                onSelect?.(lastCalendarTab)
              } else {
                cycleView()
              }
            }}
            className={navItemBase}
          >
            {calendarActive && (
              <motion.div
                layoutId="synka-nav-active"
                className="pointer-events-none absolute inset-0 rounded-xl bg-white/15"
                transition={springSnappy}
              />
            )}
            <CalendarIcon />
            <span className={`relative z-10 text-[11px] font-semibold tracking-wide ${calendarActive ? 'text-white' : 'text-white/50'}`}>
              {viewLabel(currentView)}
            </span>
          </button>

          {/* Tasks button */}
          <button
            id="onb-tasks-tab"
            type="button"
            onClick={() => onSelect?.('logistics')}
            className={navItemBase}
          >
            {active === 'logistics' && (
              <motion.div
                layoutId="synka-nav-active"
                className="pointer-events-none absolute inset-0 rounded-xl bg-white/15"
                transition={springSnappy}
              />
            )}
            <span className="relative">
              <TasksIcon />
              {logisticsNotifyCount > 0 && (
                <span
                  aria-label={`${logisticsNotifyCount} uleste varsler`}
                  className="absolute -top-1 -right-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-semantic-red-500 px-0.5 text-[9px] font-bold leading-none text-white"
                >
                  {logisticsNotifyCount > 9 ? '9+' : logisticsNotifyCount}
                </span>
              )}
            </span>
            <span className={`relative z-10 text-[11px] font-semibold tracking-wide ${active === 'logistics' ? 'text-white' : 'text-white/50'}`}>
              Gjøremål
            </span>
          </button>

          {/* Settings button */}
          <button
            type="button"
            onClick={() => onSelect?.('settings')}
            className={navItemBase}
          >
            {active === 'settings' && (
              <motion.div
                layoutId="synka-nav-active"
                className="pointer-events-none absolute inset-0 rounded-xl bg-white/15"
                transition={springSnappy}
              />
            )}
            <SettingsIcon />
            <span className={`relative z-10 text-[11px] font-semibold tracking-wide ${active === 'settings' ? 'text-white' : 'text-white/50'}`}>
              Profil
            </span>
          </button>

        </div>
      </LayoutGroup>
    </nav>
  )
}
