/**
 * Developer-only floating debug panel.
 *
 * Rendered only when:
 *   • localStorage.debug_overlay === '1'  (set from browser console to enable in any build)
 *
 * The overlay is intentionally NOT auto-enabled in development builds so that
 * real test participants are never distracted by it.
 *
 * Toggle: click the small ⚙ button fixed in the bottom-left corner (above BottomNav).
 * Clear:  "Clear" link inside the panel wipes the in-memory log.
 *
 * To enable in a production build (temporarily):
 *   localStorage.setItem('debug_overlay', '1') then reload.
 * To disable:
 *   localStorage.removeItem('debug_overlay') then reload.
 */

import { useState, useEffect } from 'react'
import {
  getRecentEvents,
  clearEventLog,
  subscribeToLog,
  type AppLogEntry,
} from '../lib/appLogger'

function isEnabled(): boolean {
  try {
    return localStorage.getItem('debug_overlay') === '1'
  } catch {
    return false
  }
}

function fmtTime(ts: string): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

/** Colour-codes event names for quick visual scanning. */
function eventColor(name: string): string {
  if (name.startsWith('task_')) return 'text-emerald-400'
  if (name.startsWith('event_')) return 'text-sky-400'
  if (name.startsWith('onboarding_')) return 'text-amber-400'
  if (name.startsWith('search_')) return 'text-violet-400'
  if (name.startsWith('tab_') || name.startsWith('sheet_') || name.startsWith('session_')) return 'text-zinc-300'
  return 'text-zinc-400'
}

export function DebugOverlay() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<AppLogEntry[]>([])

  useEffect(() => {
    if (!open) return
    setEntries(getRecentEvents(25))
    const unsub = subscribeToLog(() => setEntries(getRecentEvents(25)))
    return unsub
  }, [open])

  if (!isEnabled()) return null

  return (
    <>
      {/* Toggle button — fixed bottom-left, above BottomNav (72px) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Debug log"
        className="fixed bottom-[80px] left-2 z-[300] flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800/85 text-[11px] text-zinc-300 shadow-lg backdrop-blur-sm transition hover:bg-zinc-700 active:scale-95"
        aria-label="Toggle debug log"
      >
        {open ? '✕' : '⚙'}
      </button>

      {/* Log panel */}
      {open && (
        <div className="fixed bottom-[116px] left-2 right-2 z-[300] flex max-h-64 flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950/96 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              APP LOG
            </span>
            <span className="text-[10px] text-zinc-600">{entries.length} events</span>
            <button
              type="button"
              onClick={() => {
                clearEventLog()
                setEntries([])
              }}
              className="text-[10px] text-rose-500 hover:text-rose-400"
            >
              Clear
            </button>
          </div>

          {/* Event list — newest first */}
          <div className="overflow-y-auto overscroll-contain">
            {entries.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-zinc-600">
                No events yet. Trigger an action.
              </p>
            ) : (
              [...entries].reverse().map((e, i) => (
                <div
                  key={i}
                  className="flex items-baseline gap-2 border-b border-zinc-900 px-3 py-1 last:border-0"
                >
                  <span className="shrink-0 font-mono text-[9px] text-zinc-600">
                    {fmtTime(e.ts)}
                  </span>
                  <span className={`shrink-0 text-[11px] font-semibold ${eventColor(e.name)}`}>
                    {e.name}
                  </span>
                  {Object.keys(e.payload).length > 0 && (
                    <span className="min-w-0 truncate text-[10px] text-zinc-500">
                      {JSON.stringify(e.payload)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
