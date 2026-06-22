import { LayoutGroup, motion } from 'framer-motion'
import { IconCalendar, IconCheck, IconUsers, IconMenu2, IconPlus } from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { springSnappy } from '../lib/motion'

export type NavTab = 'kalender' | 'tasks' | 'familie' | 'mer'

interface BottomNavProps {
  /** Optional side-effect hook fired after navigation (e.g. analytics, list-view reset). */
  onSelect?: (tab: NavTab) => void
  logisticsNotifyCount?: number
  /** Opens the "+" creation action sheet. The FAB is an action, not a route — no active state. */
  onAddAction?: () => void
}

interface TabDef {
  id: NavTab
  label: string
  Icon: Icon
}

const TABS: TabDef[] = [
  { id: 'kalender', label: 'Kalender', Icon: IconCalendar },
  { id: 'tasks', label: 'Gjøremål', Icon: IconCheck },
  { id: 'familie', label: 'Familie', Icon: IconUsers },
  { id: 'mer', label: 'Mer', Icon: IconMenu2 },
]

/**
 * Notch + FAB geometry — a single source of truth so the cutout and the button can never desync.
 * Both the FAB and the masked notch are centred via `left-1/2` of the SAME <nav>, so their
 * horizontal centre is the identical computed value at every viewport width (320 → 768+). The
 * notch is a fixed-radius circular hole, so it stays a perfect arc regardless of bar width — no
 * SVG path to stretch, no aspect-ratio distortion.
 */
const FAB_DIAMETER = 56 // px — comfortably above the 44px tap-target minimum
const NOTCH_RADIUS = 36 // px — cutout carved into the bar's top edge, ~8px ring around the FAB

/** Radial-gradient mask punching a real semicircular hole at the top-centre of the bar fill. */
const NOTCH_MASK = `radial-gradient(circle ${NOTCH_RADIUS}px at 50% 0, transparent ${NOTCH_RADIUS - 1}px, #000 ${NOTCH_RADIUS}px)`

/** Derive the active top-level tab from the current pathname. */
function activeTabFromPath(pathname: string): NavTab {
  if (pathname.startsWith('/tasks')) return 'tasks'
  if (pathname.startsWith('/familie')) return 'familie'
  if (pathname.startsWith('/mer')) return 'mer'
  return 'kalender'
}

export function BottomNav({ onSelect, logisticsNotifyCount = 0, onAddAction }: BottomNavProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = activeTabFromPath(pathname)

  const renderTab = (tab: TabDef) => {
    const isActive = active === tab.id
    return (
      <button
        key={tab.id}
        id={tab.id === 'tasks' ? 'onb-tasks-tab' : tab.id === 'mer' ? 'onb-mer-tab' : undefined}
        type="button"
        onClick={() => {
          navigate(`/${tab.id}`)
          onSelect?.(tab.id)
        }}
        aria-label={tab.label}
        className={`relative z-0 flex flex-1 flex-col items-center justify-center gap-1 overflow-visible rounded-md py-2 transition-colors touch-manipulation ${
          isActive ? 'text-white' : 'text-synkaNavy/50 hover:bg-synkaCream/25'
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="bottom-nav-indicator"
            className="pointer-events-none absolute inset-0 z-20 rounded-md bg-synkaPrimary shadow-planner-sm"
            style={{ zIndex: 30 }}
            transition={springSnappy}
          />
        )}
        <span className="relative z-[40] flex flex-col items-center gap-1">
          <span className="relative">
            <tab.Icon size={18} aria-hidden />
            {tab.id === 'tasks' && logisticsNotifyCount > 0 && (
              <span
                aria-label={`${logisticsNotifyCount} uleste varsler`}
                className="absolute -top-1.5 -right-2.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-pill bg-synkaCoral px-1 text-caption font-bold leading-none text-white"
              >
                {logisticsNotifyCount > 9 ? '9+' : logisticsNotifyCount}
              </span>
            )}
          </span>
          <span className="text-caption font-semibold leading-none">{tab.label}</span>
        </span>
      </button>
    )
  }

  return (
    <nav className="relative flex h-[72px] min-h-[72px] w-full max-w-full min-w-0 shrink-0 items-stretch overflow-visible px-4 py-2">
      {/* Bar fill + blur, with a real semicircular notch masked out at top-centre (`at 50% 0`). */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 border-t border-zinc-200/90 bg-surface/98 backdrop-blur-md"
        style={{
          WebkitMaskImage: NOTCH_MASK,
          maskImage: NOTCH_MASK,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        }}
        aria-hidden
      />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 items-stretch gap-1">
        <LayoutGroup id="bottom-nav">
          {renderTab(TABS[0])}
          {renderTab(TABS[1])}
          {/* Centre slot: reserves the FAB's column so the four tabs stay evenly spaced. */}
          <div className="flex-1" aria-hidden />
          {renderTab(TABS[2])}
          {renderTab(TABS[3])}
        </LayoutGroup>
      </div>

      {/*
        Docked FAB. Shares `left-1/2 -translate-x-1/2` with the notch above — both resolve against
        the same <nav> width, so they are concentric at every viewport size. `top-0 -translate-y-1/2`
        seats its centre on the bar's top edge so it nests in the cutout. `z-30` keeps it above the
        backdrop-blur layer; the nav's `overflow-visible` keeps its upward poke (and tap area) unclipped.
      */}
      <button
        type="button"
        onClick={onAddAction}
        aria-label="Legg til"
        className="absolute left-1/2 top-0 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill bg-synkaPrimary text-white shadow-float transition active:shadow-planner-press touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-synkaPrimary/40 focus-visible:ring-offset-2"
        style={{ height: FAB_DIAMETER, width: FAB_DIAMETER }}
      >
        <IconPlus size={26} stroke={2.5} aria-hidden />
      </button>
    </nav>
  )
}
