import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { IconCalendarDown } from '@tabler/icons-react'
import type { Event, PersonId } from '../types'
import { springDialog } from '../lib/motion'
import { sheetHandle, sheetHandleBar, sheetTitle, btnPrimary, btnSecondary, btnGhost } from '../lib/ui'
import {
  isCalendarSupported,
  checkCalendarPermission,
  requestCalendarPermission,
  listDeviceCalendars,
  readDeviceEvents,
  type DeviceCalendar,
} from '../lib/deviceCalendar'
import { mapDeviceEventToSynka, collectImportedDeviceEventKeys } from '../lib/deviceCalendarImport'

/** How far back / forward we pull events on import. */
const IMPORT_WINDOW_PAST_DAYS = 30
const IMPORT_WINDOW_FUTURE_DAYS = 180

interface DeviceCalendarImportDialogProps {
  open: boolean
  onClose: () => void
  /** Synka's event-creation path — same one used by the manual add flow and Tankestrøm import. */
  createEvent: (date: string, input: Omit<Event, 'id'>) => Promise<void>
  /** Loads existing events for a YYYY-MM-DD range (used to dedupe re-imports). */
  loadEventsInRange: (startKey: string, endKey: string) => Promise<Record<string, Event[]> | undefined>
  /** Person imported events are assigned to (the importing parent), or null = unassigned. */
  defaultPersonId: PersonId | null
}

type Phase =
  | 'web'
  | 'checking'
  | 'intro'
  | 'requesting'
  | 'denied'
  | 'loadingCalendars'
  | 'choose'
  | 'empty'
  | 'importing'
  | 'result'
  | 'error'

interface ImportResult {
  imported: number
  skipped: number
  failed: number
  calendarCount: number
}

export function DeviceCalendarImportDialog({
  open,
  onClose,
  createEvent,
  loadEventsInRange,
  defaultPersonId,
}: DeviceCalendarImportDialogProps) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Incremented every time the dialog (re)initialises; async steps bail if it changes
  // (dialog closed/reopened) so stale results never land on a fresh session.
  const seqRef = useRef(0)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const loadCalendars = useCallback(async (seq: number) => {
    setPhase('loadingCalendars')
    const cals = await listDeviceCalendars()
    if (seqRef.current !== seq) return
    if (!cals.length) {
      setPhase('empty')
      return
    }
    setCalendars(cals)
    setSelected(new Set(cals.map((c) => c.id)))
    setPhase('choose')
  }, [])

  // Initialise the flow whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    const seq = seqRef.current + 1
    seqRef.current = seq
    setResult(null)
    setErrorMessage('')
    setCalendars([])
    setSelected(new Set())

    if (!isCalendarSupported()) {
      setPhase('web')
      return
    }

    setPhase('checking')
    void (async () => {
      const perm = await checkCalendarPermission()
      if (seqRef.current !== seq) return
      if (perm === 'granted') {
        await loadCalendars(seq)
      } else if (perm === 'denied') {
        setPhase('denied')
      } else {
        setPhase('intro')
      }
    })()
  }, [open, loadCalendars])

  // Closing the dialog invalidates any in-flight async session: bumping seqRef makes every
  // pending `seqRef.current !== seq` guard fail, so stale setState — and the import loop's
  // remaining createEvent writes — stop after dismissal.
  useEffect(() => {
    if (open) return
    seqRef.current += 1
  }, [open])

  // Escape to close + focus management, mirroring AddActionSheet.
  useEffect(() => {
    if (!open) return
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [open])

  const handleRequestAccess = useCallback(async () => {
    const seq = seqRef.current
    setPhase('requesting')
    const perm = await requestCalendarPermission()
    if (seqRef.current !== seq) return
    if (perm === 'granted') {
      await loadCalendars(seq)
    } else {
      setPhase('denied')
    }
  }, [loadCalendars])

  const toggleCalendar = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allSelected = calendars.length > 0 && selected.size === calendars.length
  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === calendars.length ? new Set() : new Set(calendars.map((c) => c.id))))
  }, [calendars])

  const handleImport = useCallback(async () => {
    const seq = seqRef.current
    const selectedIds = [...selected]
    if (!selectedIds.length) return
    setPhase('importing')

    try {
      const now = new Date()
      const fromDate = new Date(now.getTime())
      fromDate.setDate(fromDate.getDate() - IMPORT_WINDOW_PAST_DAYS)
      fromDate.setHours(0, 0, 0, 0)
      const toDate = new Date(now.getTime())
      toDate.setDate(toDate.getDate() + IMPORT_WINDOW_FUTURE_DAYS)
      toDate.setHours(23, 59, 59, 999)

      const deviceEvents = await readDeviceEvents(fromDate.toISOString(), toDate.toISOString(), selectedIds)
      if (seqRef.current !== seq) return

      const calendarTitleById = new Map(calendars.map((c) => [c.id, c.title]))
      const importedAtISO = new Date().toISOString()
      const mapped = deviceEvents.map((ev) =>
        mapDeviceEventToSynka(ev, { defaultPersonId, calendarTitleById, importedAtISO })
      )

      // Dedupe across the exact span of anchor dates we're about to write to (not the read
      // window) — `listEventsInRange` can return events that start before the window, so an
      // imported event may anchor outside it; loading by anchor span guarantees coverage.
      const seen = new Set<string>()
      if (mapped.length) {
        const anchorKeys = mapped.map((m) => m.dateKey).sort()
        const existing = await loadEventsInRange(anchorKeys[0], anchorKeys[anchorKeys.length - 1])
        if (seqRef.current !== seq) return
        for (const key of collectImportedDeviceEventKeys(existing)) seen.add(key)
      }

      let imported = 0
      let skipped = 0
      let failed = 0
      for (const m of mapped) {
        if (seqRef.current !== seq) return
        if (seen.has(m.dedupeKey)) {
          skipped++
          continue
        }
        seen.add(m.dedupeKey)
        try {
          await createEvent(m.dateKey, m.input)
          imported++
        } catch (err) {
          console.error('[deviceCalendar] failed to create imported event:', err)
          failed++
        }
      }

      if (seqRef.current !== seq) return
      setResult({ imported, skipped, failed, calendarCount: selectedIds.length })
      setPhase('result')
    } catch (err) {
      console.error('[deviceCalendar] import failed:', err)
      if (seqRef.current !== seq) return
      setErrorMessage('Noe gikk galt under importen. Prøv igjen.')
      setPhase('error')
    }
  }, [selected, calendars, loadEventsInRange, defaultPersonId, createEvent])

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
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={springDialog}
              className="pointer-events-auto flex max-h-[88dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-lg bg-synkaCream shadow-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Koble til kalender"
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

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-1">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-synkaPrimary/10 text-synkaPrimary">
                    <IconCalendarDown size={22} aria-hidden />
                  </span>
                  <h2 className={sheetTitle}>Koble til kalender</h2>
                </div>

                <DialogBody
                  phase={phase}
                  calendars={calendars}
                  selected={selected}
                  allSelected={allSelected}
                  result={result}
                  errorMessage={errorMessage}
                  onRequestAccess={handleRequestAccess}
                  onToggleCalendar={toggleCalendar}
                  onToggleAll={toggleAll}
                  onImport={handleImport}
                  onClose={onClose}
                />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

interface DialogBodyProps {
  phase: Phase
  calendars: DeviceCalendar[]
  selected: Set<string>
  allSelected: boolean
  result: ImportResult | null
  errorMessage: string
  onRequestAccess: () => void
  onToggleCalendar: (id: string) => void
  onToggleAll: () => void
  onImport: () => void
  onClose: () => void
}

const HELPER_TEXT =
  'Henter inn avtalene du allerede har i telefonens kalender – som Spond og skoletimeplaner du abonnerer på – og samler dem i Synka.'

function DialogBody({
  phase,
  calendars,
  selected,
  allSelected,
  result,
  errorMessage,
  onRequestAccess,
  onToggleCalendar,
  onToggleAll,
  onImport,
  onClose,
}: DialogBodyProps) {
  switch (phase) {
    case 'web':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-body text-synkaNavy/70">
            Denne funksjonen er tilgjengelig i Synka-appen på telefonen. Telefonens kalender finnes
            bare der – åpne Synka på mobilen for å hente inn avtalene dine.
          </p>
          <button type="button" className={btnPrimary} onClick={onClose}>
            Greit
          </button>
        </div>
      )

    case 'checking':
    case 'loadingCalendars':
      return <Centered label={phase === 'checking' ? 'Sjekker tilgang …' : 'Henter kalendere …'} />

    case 'intro':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-body text-synkaNavy/70">{HELPER_TEXT}</p>
          <p className="text-body-sm text-synkaNavy/55">
            Synka leser kun kalenderen din – vi endrer aldri noe i telefonkalenderen.
          </p>
          <button type="button" className={btnPrimary} onClick={onRequestAccess}>
            Gi tilgang til kalenderen
          </button>
        </div>
      )

    case 'requesting':
      return <Centered label="Ber om tilgang …" />

    case 'denied':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-body text-synkaNavy/70">
            Synka har ikke tilgang til kalenderen din ennå. Du kan gi tilgang i
            telefonens innstillinger under Synka → Kalender, og deretter prøve igjen.
          </p>
          <button type="button" className={btnPrimary} onClick={onRequestAccess}>
            Prøv igjen
          </button>
          <button type="button" className={btnSecondary} onClick={onClose}>
            Avbryt
          </button>
        </div>
      )

    case 'empty':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-body text-synkaNavy/70">
            Fant ingen kalendere på enheten. Legg til en kalenderkonto på telefonen
            (f.eks. Google eller iCloud) og prøv igjen.
          </p>
          <button type="button" className={btnPrimary} onClick={onClose}>
            Lukk
          </button>
        </div>
      )

    case 'choose':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-body-sm text-synkaNavy/60">{HELPER_TEXT}</p>
          <div className="flex items-center justify-between">
            <span className="text-caption uppercase tracking-wide text-synkaPrimary/60">
              Velg kalendere
            </span>
            <button type="button" className={btnGhost} onClick={onToggleAll}>
              {allSelected ? 'Fjern alle' : 'Velg alle'}
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {calendars.map((cal) => {
              const checked = selected.has(cal.id)
              return (
                <li key={cal.id}>
                  <button
                    type="button"
                    onClick={() => onToggleCalendar(cal.id)}
                    aria-pressed={checked}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition touch-manipulation ${
                      checked
                        ? 'border-synkaPrimary/30 bg-synkaPrimary/8'
                        : 'border-synkaNavy/10 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: cal.color ?? '#9ca3af' }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-body text-synkaNavy">{cal.title}</span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        checked ? 'border-synkaPrimary bg-synkaPrimary text-white' : 'border-synkaNavy/25 bg-white'
                      }`}
                      aria-hidden
                    >
                      {checked && (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="text-caption text-synkaNavy/45">
            Henter avtaler fra omtrent en måned tilbake til et halvår frem. Du kan endre
            hvem hendelsene tilhører etterpå.
          </p>
          <button type="button" className={btnPrimary} onClick={onImport} disabled={selected.size === 0}>
            Importer {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      )

    case 'importing':
      return <Centered label="Importerer hendelser …" />

    case 'result': {
      const r = result ?? { imported: 0, skipped: 0, failed: 0, calendarCount: 0 }
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-synkaPrimary/10 text-synkaPrimary">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <p className="text-heading text-synkaNavy">
              {r.imported} {r.imported === 1 ? 'hendelse' : 'hendelser'} importert
            </p>
            <p className="text-body-sm text-synkaNavy/60">
              fra {r.calendarCount} {r.calendarCount === 1 ? 'kalender' : 'kalendere'}
              {r.skipped > 0 ? ` · ${r.skipped} allerede importert` : ''}
              {r.failed > 0 ? ` · ${r.failed} feilet` : ''}
            </p>
          </div>
          <button type="button" className={btnPrimary} onClick={onClose}>
            Ferdig
          </button>
        </div>
      )
    }

    case 'error':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-body text-synkaCoral">{errorMessage}</p>
          <button type="button" className={btnPrimary} onClick={onClose}>
            Lukk
          </button>
        </div>
      )

    default:
      return null
  }
}

function Centered({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-synkaPrimary/25 border-t-synkaPrimary" aria-hidden />
      <p className="text-body-sm text-synkaNavy/60">{label}</p>
    </div>
  )
}
