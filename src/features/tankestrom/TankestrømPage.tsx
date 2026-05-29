import { useEffect, useRef } from 'react'
import { IconArrowLeft, IconActivity, IconUpload, IconCheck } from '@tabler/icons-react'
import type { Event, Task, Person } from '../../types'
import {
  useTankestromImport,
  type TankestromImportSuccess,
  type TankestromEditEventFn,
} from './useTankestromImport'
import { logEvent } from '../../lib/appLogger'

const TANKESTROM_FILE_ACCEPT =
  'image/*,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

interface TankestrømPageProps {
  onBack: () => void
  people: Person[]
  createEvent: (date: string, input: Omit<Event, 'id'>) => Promise<void>
  createTask: (input: Omit<Task, 'id'>) => Promise<void>
  editEvent?: TankestromEditEventFn
  getAnchoredForegroundEventsForMatching?: () => { event: Event; anchorDate: string }[]
  prefetchEventsForDateRange?: (
    startDate: string,
    endDate: string
  ) => void | Promise<void | Record<string, Event[]>>
  deleteEvent?: (date: string, eventId: string) => Promise<void>
  updatePerson?: (
    id: string,
    updates: Partial<Pick<Person, 'name' | 'colorTint' | 'colorAccent' | 'memberKind' | 'school' | 'work'>>
  ) => Promise<void>
  onImportFinished?: (payload: {
    success: TankestromImportSuccess
    partial: boolean
    failureMessage?: string
  }) => void
}

export function TankestrømPage({
  onBack,
  people,
  createEvent,
  createTask,
  editEvent,
  getAnchoredForegroundEventsForMatching,
  prefetchEventsForDateRange,
  deleteEvent,
  updatePerson,
  onImportFinished,
}: TankestrømPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    pendingFiles,
    addFilesFromList,
    primaryCalendarProposalItems,
    selectedIds,
    toggleProposal,
    draftByProposalId,
    analyzeLoading,
    saveLoading,
    approveSelected,
    canApproveSelection,
    runAnalyze,
    bundle,
  } = useTankestromImport({
    open: true,
    people,
    createEvent,
    createTask,
    editEvent,
    getAnchoredForegroundEventsForMatching,
    prefetchEventsForDateRange,
    deleteEvent,
    updatePerson,
  })

  // Auto-trigger analysis when files are added
  const prevPendingFilesLengthRef = useRef(0)
  useEffect(() => {
    const prev = prevPendingFilesLengthRef.current
    prevPendingFilesLengthRef.current = pendingFiles.length
    if (pendingFiles.length > prev && !analyzeLoading && !bundle) {
      logEvent('tankestrom_analyze_started', { mode: 'file', fileCount: pendingFiles.length })
      void runAnalyze()
    }
  }, [pendingFiles, analyzeLoading, bundle, runAnalyze])

  const displayItems = primaryCalendarProposalItems.filter(
    (item) => item.kind === 'event' || item.kind === 'task'
  )

  const selectedCount = displayItems.filter((item) => selectedIds.has(item.proposalId)).length

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (list && list.length > 0) addFilesFromList(list)
    e.target.value = ''
  }

  const handleApprove = async () => {
    if (saveLoading) return
    const result = await approveSelected()
    if (result.ok && result.success) {
      onImportFinished?.({
        success: result.success,
        partial: result.partial,
        failureMessage: result.failureMessage,
      })
      onBack()
    }
  }

  return (
    <div className="flex h-full flex-col bg-synkaCream">
      {/* Header */}
      <div className="shrink-0 px-4 pb-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full transition touch-manipulation hover:bg-synkaNavy/8 active:bg-synkaNavy/12"
          aria-label="Tilbake"
        >
          <IconArrowLeft size={18} aria-hidden />
        </button>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-synkaNavy">
            <IconActivity size={18} color="#7bc7c4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-heading font-bold text-synkaNavy">Tankestrøm</p>
            <p className="truncate text-caption text-synkaNavy/50">
              Last opp dokument eller bilde for å importere hendelser
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-6 [-webkit-overflow-scrolling:touch]">
        {/* Upload zone */}
        <div
          role="button"
          tabIndex={0}
          className="mx-4 mt-2 cursor-pointer bg-synkaTeal/5 p-8 text-center transition touch-manipulation active:bg-synkaTeal/10"
          style={{ border: '2px dashed rgba(123,199,196,0.5)', borderRadius: 12 }}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          aria-label="Last opp fil"
        >
          {analyzeLoading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-synkaTeal/30 border-t-synkaTeal" />
              <p className="text-body-sm font-medium text-synkaNavy/60">Analyserer…</p>
            </div>
          ) : (
            <>
              <IconUpload size={32} color="rgba(123,199,196,0.7)" style={{ display: 'block', marginBottom: 12 }} aria-hidden />
              <p className="text-body-sm font-medium text-synkaNavy">
                Last opp dokument eller bilde
              </p>
              <p className="mt-1 text-caption text-synkaNavy/40">PDF, bilde, eller lim inn tekst</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={TANKESTROM_FILE_ACCEPT}
          className="sr-only"
          aria-label="Velg filer til analyse"
          onChange={handleFileChange}
        />

        {/* Proposals section */}
        {displayItems.length > 0 && (
          <div className="mt-5">
            {/* Section header */}
            <div className="mb-3 flex items-center gap-2 px-4">
              <span className="inline-flex items-center gap-1" aria-hidden>
                <span className="h-2 w-2 rounded-full bg-synkaTeal" />
                <span className="h-2 w-2 rounded-full bg-synkaYellow" />
              </span>
              <span className="text-caption font-semibold text-synkaNavy">Foreslåtte hendelser</span>
              <span className="rounded-pill bg-synkaTeal/15 px-2 text-caption text-synkaTeal">
                {displayItems.length}
              </span>
            </div>

            {/* Proposal cards */}
            {displayItems.map((item) => {
              const isSelected = selectedIds.has(item.proposalId)
              const draft = draftByProposalId[item.proposalId]

              let title = ''
              let dateKey = ''
              let timeLabel = ''
              let personColor = '#94a3b8'

              if (item.kind === 'event') {
                const eventDraft = draft?.importKind === 'event' ? draft.event : null
                title = eventDraft?.title ?? item.event.title
                dateKey = eventDraft?.date ?? item.event.date
                const start = eventDraft?.start ?? item.event.start
                const end = eventDraft?.end ?? item.event.end
                if (start?.trim() && end?.trim()) timeLabel = `${start}–${end}`
                const personId = eventDraft?.personId ?? item.event.personId
                personColor = people.find((p) => p.id === personId)?.colorAccent ?? '#94a3b8'
              } else if (item.kind === 'task') {
                const taskDraft = draft?.importKind === 'task' ? draft.task : null
                title = taskDraft?.title ?? item.task.title
                dateKey = taskDraft?.date ?? item.task.date
                const dueTime = taskDraft?.dueTime ?? item.task.dueTime
                if (dueTime) timeLabel = dueTime
                const personId = taskDraft?.childPersonId ?? item.task.childPersonId
                personColor = people.find((p) => p.id === personId)?.colorAccent ?? '#94a3b8'
              }

              const dateLabel = dateKey
                ? new Date(`${dateKey}T12:00:00`).toLocaleDateString('nb-NO', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                  })
                : ''
              const subLabel = [dateLabel, timeLabel].filter(Boolean).join(' · ')

              return (
                <button
                  key={item.proposalId}
                  type="button"
                  onClick={() => toggleProposal(item.proposalId)}
                  className="mb-2 flex w-[calc(100%-2rem)] items-center gap-3 rounded-md border-l-4 bg-white p-3 text-left mx-4 touch-manipulation active:bg-synkaCream/60"
                  style={{ borderLeftColor: personColor }}
                >
                  {/* Checkbox circle */}
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      isSelected ? 'border-synkaPrimary bg-synkaPrimary' : 'border-synkaNavy/20'
                    }`}
                  >
                    {isSelected && (
                      <IconCheck size={10} color="white" aria-hidden />
                    )}
                  </div>
                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold text-synkaNavy">{title}</p>
                    {subLabel && (
                      <p className="text-caption text-synkaNavy/50">{subLabel}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Sticky footer — only shows when proposals exist */}
      {displayItems.length > 0 && (
        <div className="shrink-0 border-t border-synkaNavy/8 bg-synkaCream px-4 pb-4 pt-3">
          <button
            type="button"
            disabled={selectedCount === 0 || saveLoading || !canApproveSelection}
            onClick={() => void handleApprove()}
            className="h-12 w-full rounded-pill bg-synkaPrimary font-semibold text-white touch-manipulation disabled:opacity-40"
          >
            {saveLoading
              ? 'Importerer…'
              : `Legg til ${selectedCount} hendelse${selectedCount === 1 ? '' : 'r'}`}
          </button>
        </div>
      )}
    </div>
  )
}
