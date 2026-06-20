import { createHashRouter, redirect, Outlet, useOutletContext, useNavigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { IconArrowLeft } from '@tabler/icons-react'
import { useAuth } from './context/AuthContext'
import { AuthScreen } from './components/AuthScreen'
import { AppShell } from './components/AppShell'
import { MobileFrame } from './components/MobileFrame'
import { CalendarHomeTab } from './features/calendar/CalendarHomeTab'
import { TasksScreen } from './components/TasksScreen'
import { MerScreen } from './components/MerScreen'
import { AppLayout, type AppOutletContext } from './App'

const FamilieScreen = lazy(() =>
  import('./components/FamilieScreen').then((m) => ({ default: m.FamilieScreen }))
)
const HjelpScreen = lazy(() =>
  import('./components/HjelpScreen').then((m) => ({ default: m.HjelpScreen }))
)
const SettingsScreen = lazy(() =>
  import('./components/SettingsScreen').then((m) => ({ default: m.SettingsScreen }))
)
const TankestrømPage = lazy(() =>
  import('./features/tankestrom/TankestrømPage').then((m) => ({ default: m.TankestrømPage }))
)

function useAppOutletContext() {
  return useOutletContext<AppOutletContext>()
}

/**
 * Gates every authenticated route. Auth is always resolved in-place (no redirect):
 * a spinner while loading, the sign-in screen when signed out, otherwise the app.
 */
function AuthGuard() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <AppShell>
        <MobileFrame>
          <div className="flex h-full w-full min-w-0 max-w-full flex-col items-center justify-center gap-3 overflow-x-hidden text-zinc-500">
            <div className="h-8 w-8 animate-spin rounded-pill border-2 border-zinc-300 border-t-zinc-600" />
            <p className="text-body-sm">Laster…</p>
          </div>
        </MobileFrame>
      </AppShell>
    )
  }
  if (!user) {
    return (
      <AppShell>
        <MobileFrame>
          <AuthScreen />
        </MobileFrame>
      </AppShell>
    )
  }
  return <Outlet />
}

// ── Routed screens ──────────────────────────────────────────────────────────────
// Thin wrappers that pull their ready-to-spread props from the AppLayout outlet
// context. The screen components themselves are mounted here but otherwise unchanged.

function KalenderRoute() {
  const ctx = useAppOutletContext()
  return <CalendarHomeTab {...ctx.calendar} />
}

function TasksRoute() {
  const ctx = useAppOutletContext()
  return <TasksScreen {...ctx.tasks} />
}

function FamilieRoute() {
  const ctx = useAppOutletContext()
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <Suspense fallback={null}>
        <FamilieScreen onBack={ctx.familieOnBack} />
      </Suspense>
    </div>
  )
}

function MerRoute() {
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
      <MerScreen />
    </div>
  )
}

function SettingsRoute() {
  const ctx = useAppOutletContext()
  const navigate = useNavigate()
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 bg-synkaCream border-b border-synkaNavy/8 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/mer')}
          className="flex w-8 h-8 items-center justify-center rounded-full hover:bg-synkaNavy/8 transition touch-manipulation"
          aria-label="Tilbake"
        >
          <IconArrowLeft size={18} className="text-synkaNavy" aria-hidden />
        </button>
        <span className="text-[15px] font-semibold text-synkaNavy">Innstillinger</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <Suspense fallback={null}>
          <SettingsScreen {...ctx.settings} />
        </Suspense>
      </div>
    </div>
  )
}

function TankestromRoute() {
  const ctx = useAppOutletContext()
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <Suspense fallback={null}>
        <TankestrømPage {...ctx.tankestrom} />
      </Suspense>
    </div>
  )
}

function HjelpRoute() {
  const ctx = useAppOutletContext()
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <Suspense fallback={null}>
        <HjelpScreen onBack={ctx.hjelpOnBack} />
      </Suspense>
    </div>
  )
}

export const router = createHashRouter([
  { index: true, loader: () => redirect('/kalender') },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: 'kalender', element: <KalenderRoute /> },
          { path: 'tasks', element: <TasksRoute /> },
          { path: 'familie', element: <FamilieRoute /> },
          {
            path: 'mer',
            children: [
              { index: true, element: <MerRoute /> },
              { path: 'innstillinger', element: <SettingsRoute /> },
              { path: 'tankestrom', element: <TankestromRoute /> },
              { path: 'hjelp', element: <HjelpRoute /> },
            ],
          },
        ],
      },
    ],
  },
])
