import { LayoutGroup, motion } from 'framer-motion'
import { IconCalendar, IconHome, IconCheck, IconMenu2 } from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'
import { springSnappy } from '../lib/motion'

export type NavTab = 'month' | 'today' | 'tasks' | 'mer'

interface BottomNavProps {
  active: NavTab
  onSelect?: (tab: NavTab) => void
  logisticsNotifyCount?: number
}

interface TabDef {
  id: NavTab
  label: string
  Icon: Icon
}

const TABS: TabDef[] = [
  { id: 'month', label: 'Måned', Icon: IconCalendar },
  { id: 'today', label: 'I dag', Icon: IconHome },
  { id: 'tasks', label: 'Gjøremål', Icon: IconCheck },
  { id: 'mer', label: 'Mer', Icon: IconMenu2 },
]

export function BottomNav({ active, onSelect, logisticsNotifyCount = 0 }: BottomNavProps) {
  return (
    <nav className="relative flex h-[72px] min-h-[72px] w-full max-w-full min-w-0 shrink-0 items-stretch overflow-x-hidden overflow-y-visible px-4 py-2">
      <div
        className="pointer-events-none absolute inset-0 -z-10 border-t border-zinc-200/90 bg-surface/98 backdrop-blur-md"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 gap-1">
        <LayoutGroup id="bottom-nav">
          {TABS.map((tab) => {
            const isActive = active === tab.id
            return (
              <button
                key={tab.id}
                id={tab.id === 'tasks' ? 'onb-tasks-tab' : undefined}
                type="button"
                onClick={() => onSelect?.(tab.id)}
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
                        className="absolute -top-1.5 -right-2.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-pill bg-synkaCoral px-1 text-[9px] font-bold leading-none text-white"
                      >
                        {logisticsNotifyCount > 9 ? '9+' : logisticsNotifyCount}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
                </span>
              </button>
            )
          })}
        </LayoutGroup>
      </div>
    </nav>
  )
}
