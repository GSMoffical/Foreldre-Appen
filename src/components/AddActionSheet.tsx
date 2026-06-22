import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { IconCalendarPlus, IconSparkles, IconChevronRight } from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'
import { springDialog } from '../lib/motion'
import { sheetHandle, sheetHandleBar, sheetTitle } from '../lib/ui'

interface AddActionSheetProps {
  open: boolean
  onClose: () => void
  onAddEvent: () => void
  onImportSchool: () => void
}

interface ActionRow {
  Icon: Icon
  title: string
  subtitle: string
  onClick: () => void
  /** The hero action — visually emphasised (school-schedule import). */
  hero?: boolean
}

export function AddActionSheet({ open, onClose, onAddEvent, onImportSchool }: AddActionSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  // Accessed via ref so the mount effect can depend on `open` alone — a fresh onClose
  // identity from a parent re-render must not re-run the effect and thrash focus.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Land on the first action ("Legg til hendelse"), not the close button.
    bodyRef.current?.querySelector<HTMLElement>('button')?.focus()

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      previousFocusRef.current?.focus()
    }
  }, [open])

  const rows: ActionRow[] = [
    {
      Icon: IconCalendarPlus,
      title: 'Legg til hendelse',
      subtitle: 'Ny avtale i kalenderen',
      onClick: onAddEvent,
    },
    {
      Icon: IconSparkles,
      title: 'Importer fra skole',
      subtitle: 'Hent timeplan fra bilde eller tekst',
      onClick: onImportSchool,
      hero: true,
    },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-synkaNavy/30"
            onClick={onClose}
            aria-hidden
          />
          <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center px-3">
            <motion.div
              ref={panelRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={springDialog}
              className="pointer-events-auto flex w-full max-w-[460px] flex-col overflow-hidden rounded-t-lg bg-synkaCream shadow-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Legg til"
            >
              <div className={`${sheetHandle} relative`}>
                <div className={sheetHandleBar} aria-hidden />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Lukk"
                  className="absolute right-3 top-1 flex h-7 w-7 items-center justify-center rounded-pill text-synkaNavy/40 transition hover:bg-black/5 hover:text-synkaNavy/70 touch-manipulation"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div ref={bodyRef} className="flex flex-col gap-2.5 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-1">
                <h2 className={`${sheetTitle} pb-1`}>Legg til</h2>
                {rows.map((row) => (
                  <button
                    key={row.title}
                    type="button"
                    onClick={() => {
                      row.onClick()
                      onClose()
                    }}
                    className={`group flex w-full items-center gap-3.5 rounded-lg border p-3.5 text-left transition active:scale-[0.99] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-synkaPrimary/40 ${
                      row.hero
                        ? 'border-synkaPrimary/30 bg-synkaPrimary/8 hover:bg-synkaPrimary/12'
                        : 'border-synkaNavy/10 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                        row.hero ? 'bg-synkaPrimary text-white' : 'bg-synkaPrimary/10 text-synkaPrimary'
                      }`}
                    >
                      <row.Icon size={24} aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-semibold text-synkaNavy">{row.title}</span>
                      <span className="text-body-sm text-synkaNavy/55">{row.subtitle}</span>
                    </span>
                    <IconChevronRight
                      size={20}
                      className="shrink-0 text-synkaNavy/25 transition group-hover:text-synkaNavy/45"
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
