import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { springSnappy } from '../lib/motion'

export type ShowUndoOptions = {
  message: string
  onUndo: () => void | Promise<void>
}

type UndoContextValue = {
  showUndo: (options: ShowUndoOptions) => void
}

const UndoContext = createContext<UndoContextValue | null>(null)

export function UndoProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<{
    id: number
    message: string
    onUndo: () => void | Promise<void>
  } | null>(null)
  const idRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)
  const reducedMotion = useReducedMotion() ?? false

  const clearTimer = useCallback(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    setPayload(null)
  }, [clearTimer])

  const showUndo = useCallback(
    ({ message, onUndo }: ShowUndoOptions) => {
      clearTimer()
      const id = ++idRef.current
      setPayload({ id, message, onUndo })
      timeoutRef.current = window.setTimeout(() => {
        setPayload((p) => (p?.id === id ? null : p))
        timeoutRef.current = null
      }, 5500)
    },
    [clearTimer]
  )

  const runUndo = useCallback(async () => {
    if (!payload) return
    const fn = payload.onUndo
    dismiss()
    try {
      await Promise.resolve(fn())
    } catch {
      // best-effort
    }
  }, [payload, dismiss])

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      <AnimatePresence>
        {payload && (
          <motion.div
            key={payload.id}
            role="status"
            aria-live="polite"
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={springSnappy}
            className="pointer-events-none fixed inset-x-0 z-[50] flex justify-center px-3"
            style={{
              bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="pointer-events-auto flex w-full max-w-[390px] items-center justify-between gap-3 rounded-2xl border-2 border-brandNavy/20 bg-brandNavy px-3 py-2.5 text-white shadow-planner">
              <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug">{payload.message}</p>
              <button
                type="button"
                onClick={() => void runUndo()}
                className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-brandNavy shadow-sm transition hover:bg-brandSky focus:outline-none focus:ring-2 focus:ring-brandSky focus:ring-offset-2 focus:ring-offset-brandNavy"
              >
                Angre
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </UndoContext.Provider>
  )
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext)
  if (!ctx) {
    throw new Error('useUndo must be used within UndoProvider')
  }
  return ctx
}
