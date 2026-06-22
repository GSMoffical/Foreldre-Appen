import { useEffect, useRef, useState } from 'react'
import { IconArrowLeft, IconUpload, IconCheck } from '@tabler/icons-react'
import { SectionDots } from '../../components/SectionDots'
import { TankestromScheduleDetails } from '../../components/TankestromScheduleDetails'
import { btnPrimaryPill } from '../../lib/ui'
import { flattenEmbeddedScheduleOrdered } from '../../lib/embeddedSchedule'
import {
  embeddedScheduleChildTitleForReview,
  normalizeEmbeddedScheduleParentDisplayTitle,
} from '../../lib/tankestromCupEmbeddedScheduleMerge'
import { tankestromConditionalBadgeLabelNb } from '../../lib/tankestromConditionalCopy'
import { taskIntentBadgeClassName, taskIntentLabelNb } from '../../lib/taskIntent'
import { normalizeSingleEventCalendarTitle } from '../../lib/tankestromTitleNormalization'
import { readTankestromScheduleDetailsFromMetadata } from '../../lib/tankestromScheduleDetails'
import { parseSingleEventNoteSections } from '../../lib/tankestromSingleEventNoteSections'
import type { Event, Task, Person, EmbeddedScheduleSegment, EventMetadata } from '../../types'
import type { PortalEventProposal } from './types'
import {
  useTankestromImport,
  buildEmbeddedChildCanonicalPreviewForReview,
  makeEmbeddedChildProposalId,
  type TankestromImportSuccess,
  type TankestromEditEventFn,
} from './useTankestromImport'
import { logEvent } from '../../lib/appLogger'

const TANKESTROM_FILE_ACCEPT =
  'image/*,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Datospenn for et arrangement (cup o.l.) — viser «12.–14. juni» heller enn 00:00–23:59. */
function formatArrangementDateRange(startKey: string, segments: EmbeddedScheduleSegment[]): string {
  const dates = segments.map((s) => s.date).filter(Boolean).sort()
  const start = dates[0] || startKey
  const end = dates[dates.length - 1] || startKey
  if (!start) return ''
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
  if (start === end) return fmt(start)
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${new Date(`${start}T12:00:00`).getDate()}.–${fmt(end)}`
  }
  return `${fmt(start)} – ${fmt(end)}`
}

/**
 * Rolig forhåndsvisning av et arrangements delprogram (cup o.l.): én dagsblokk per dag,
 * i samme kortstil som «Foreslåtte hendelser». Gjenbruker import-dialogens preview-pipeline
 * (`buildEmbeddedChildCanonicalPreviewForReview` + delt `TankestromScheduleDetails`) slik at
 * innholdet matcher dialogen. Read-only: selve valget styres av forelder-kortet over.
 */
function EmbeddedScheduleDayBlocks({
  parentItem,
  segments,
  originalImportText,
}: {
  parentItem: PortalEventProposal
  segments: EmbeddedScheduleSegment[]
  originalImportText: string
}) {
  if (segments.length === 0) return null
  const cardTitleRaw = parentItem.event.title.trim() || 'Uten tittel'
  const parentCardTitle = normalizeEmbeddedScheduleParentDisplayTitle(cardTitleRaw).title
  const siblingTitlesBlob = segments.map((s) => s.title.trim()).join('\n')
  return (
    <div className="mt-1.5 space-y-1.5 pl-3">
      {segments.map((segment, origIndex) => {
        const displayTitle = embeddedScheduleChildTitleForReview(cardTitleRaw, segment, siblingTitlesBlob)
        const childId = makeEmbeddedChildProposalId(parentItem.proposalId, origIndex)
        const preview = buildEmbeddedChildCanonicalPreviewForReview(segment, parentCardTitle, displayTitle, childId, {
          originalImportText: originalImportText.trim().length > 0 ? originalImportText : undefined,
        })
        const details = preview.normalized
        const dateLabel = segment.date
          ? new Date(`${segment.date}T12:00:00`).toLocaleDateString('nb-NO', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })
          : ''
        const hasDetails =
          details.highlights.length > 0 ||
          details.notes.length > 0 ||
          details.bringItems.length > 0 ||
          details.timeWindowSummaries.length > 0
        return (
          <div
            key={childId}
            data-testid={`tankestrom-day-${segment.date}`}
            className="rounded-md border border-synkaNavy/10 bg-white px-3 py-2"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-body-sm font-semibold text-synkaNavy">{displayTitle}</span>
              {preview.hasConcreteTimeDisplay && preview.timeLabel && (
                <span className="text-caption tabular-nums text-synkaNavy/50">{preview.timeLabel}</span>
              )}
              {segment.isConditional && (
                <span className="rounded-pill bg-synkaYellow/15 px-2 py-0.5 text-[10px] font-semibold text-synkaNavy/70">
                  {tankestromConditionalBadgeLabelNb()}
                </span>
              )}
            </div>
            {dateLabel && <p className="mt-0.5 text-caption text-synkaNavy/50">{dateLabel}</p>}
            {hasDetails && (
              <div className="mt-1.5">
                <TankestromScheduleDetails
                  compact
                  useNormalizedInput
                  highlights={details.highlights}
                  notes={details.notes}
                  bringItems={details.bringItems}
                  precomputedTimeWindowSummaries={details.timeWindowSummaries}
                  titleContext={[displayTitle, cardTitleRaw]}
                  highlightsTestId={`tankestrom-day-highlights-${segment.date}`}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Rikere forhåndsvisning for en *enkelthendelse* (ikke cup/embedded): sted, notater/beskrivelse,
 * ta-med og ev. høydepunkter — uten å gjøre kortet om til underblokker. Gjenbruker samme
 * normalisering (`readTankestromScheduleDetailsFromMetadata`) og delte `TankestromScheduleDetails`
 * som dagblokkene. Viser ingen tomme seksjoner og finner ikke opp data som ikke finnes.
 */
/** Én detaljseksjon i enkelthendelse-previewen — samme stil som de delte dagblokkene. */
function SingleEventDetailSection({
  label,
  text,
  items,
}: {
  label: string
  text?: string
  items?: string[]
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[10px]">
        {label}
      </p>
      {text != null && (
        <p className="mt-1 break-words text-caption leading-snug text-zinc-800">{text}</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-caption leading-snug text-zinc-800 sm:text-caption">
          {items.map((n, i) => (
            <li key={`${n}-${i}`} className="break-words pl-0.5">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SingleEventDetails({
  metadata,
  title,
  location,
  notes,
}: {
  metadata: EventMetadata | undefined
  title: string
  location: string
  notes: string
}) {
  const meta = readTankestromScheduleDetailsFromMetadata(metadata, [title])
  const freeNotes = notes.trim()
  const noteKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const metaNoteKeys = new Set(meta.notes.map(noteKey))
  const allNotes =
    freeNotes && !metaNoteKeys.has(noteKey(freeNotes)) ? [...meta.notes, freeNotes] : meta.notes
  // Lett UI-parsing: trekk møtested/gruppekode/praktisk info ut av fritekst-notatene slik at
  // de ikke havner som én rå linje under «Notater». Ren presentasjon (rører ikke draft/persist).
  const sections = parseSingleEventNoteSections(allNotes)

  const loc = location.trim()
  // Eksplisitt location-felt vinner som «Sted»; ellers vis møtested parset fra notatene.
  const placeLabel = loc ? 'Sted' : sections.meetingPlace ? 'Møtested' : ''
  const placeValue = loc || sections.meetingPlace || ''

  const hasHighlightData =
    meta.highlights.length > 0 || meta.timeWindowSummaries.length > 0 || meta.bringItems.length > 0
  const hasAnything =
    !!placeValue ||
    hasHighlightData ||
    sections.practical.length > 0 ||
    sections.appliesTo.length > 0 ||
    sections.notes.length > 0
  if (!hasAnything) return null

  return (
    <div className="mt-1.5 space-y-2 rounded-md border border-synkaNavy/10 bg-white px-3 py-2">
      {/* Høydepunkter/tidspunkter + Husk-ta-med fra metadata — delt komponent, uendret.
          Notater rendres separat under, slik at møtested/praktisk/gjelder kan komme imellom. */}
      {hasHighlightData && (
        <TankestromScheduleDetails
          compact
          useNormalizedInput
          highlights={meta.highlights}
          notes={[]}
          bringItems={meta.bringItems}
          precomputedTimeWindowSummaries={meta.timeWindowSummaries}
          titleContext={[title]}
        />
      )}
      {placeValue && <SingleEventDetailSection label={placeLabel} text={placeValue} />}
      {sections.practical.length > 0 && (
        <SingleEventDetailSection label="Praktisk info" items={sections.practical} />
      )}
      {sections.appliesTo.length > 0 && (
        <SingleEventDetailSection label="Gjelder" text={sections.appliesTo.join(', ')} />
      )}
      {sections.notes.length > 0 && (
        <SingleEventDetailSection label="Notater" items={sections.notes} />
      )}
    </div>
  )
}

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
    removePendingFile,
    error,
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
    textInput,
    setTextInput,
    inputMode,
    setInputMode,
    analyzedImportTextSnapshot,
    promisedImportItemCount,
    importPersonContext,
    applyReviewBulkPersonTargets,
    clearReviewBulkPersonTargets,
    visibleSecondaryImportCandidates,
    promoteSecondaryImportCandidate,
    dismissSecondaryImportCandidate,
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

  const [showTextSection, setShowTextSection] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [chosenPersonIds, setChosenPersonIds] = useState<Set<string>>(() => new Set())
  const textAnalyzePendingRef = useRef(false)

  // Multi-select: gjenbruker dialogens bulk-personlogikk. Valgte personer settes på ALLE
  // kalenderhendelser (forelder + embedded cup-dager + enkelthendelser) og gjøremål. Flere
  // valgte lagres som deltakere (metadata.participants) på samme hendelse — ikke duplisering.
  const handleTogglePerson = (personId: string) => {
    const next = new Set(chosenPersonIds)
    if (next.has(personId)) next.delete(personId)
    else next.add(personId)
    setChosenPersonIds(next)
    if (next.size > 0) applyReviewBulkPersonTargets([...next], 'all_calendar')
    // Avvelg alle: nullstill person på hendelses-utkastene (ellers ville importen brukt
    // forrige valg selv om UI viser «ingen valgt»). Da blokkerer import-gaten på nytt.
    else clearReviewBulkPersonTargets('all_calendar')
  }

  const handleAnalyzeText = () => {
    if (!textInput.trim() || analyzeLoading || bundle) return
    if (inputMode === 'text') {
      // Tekst er nå standard inputmodus, så setInputMode('text') gir ingen tilstandsendring
      // (ingen re-render → effekten under trigges ikke). Start analysen direkte.
      logEvent('tankestrom_analyze_started', { mode: 'text', textLength: textInput.length })
      void runAnalyze()
      return
    }
    setInputMode('text')
    textAnalyzePendingRef.current = true
  }

  useEffect(() => {
    if (inputMode === 'text' && textAnalyzePendingRef.current && !analyzeLoading && !bundle) {
      textAnalyzePendingRef.current = false
      logEvent('tankestrom_analyze_started', { mode: 'text', textLength: textInput.length })
      void runAnalyze()
    }
  }, [inputMode, analyzeLoading, bundle, runAnalyze, textInput])

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
  // Hold gjøremål adskilt fra kalenderhendelser/dagsblokker (egen «Foreslåtte gjøremål»-seksjon).
  const eventDisplayItems = displayItems.filter((item) => item.kind === 'event')
  const taskDisplayItems = displayItems.filter((item) => item.kind === 'task')

  const selectedCount = displayItems.filter((item) => selectedIds.has(item.proposalId)).length

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (list && list.length > 0) addFilesFromList(list)
    e.target.value = ''
  }

  const handleApprove = async () => {
    if (saveLoading) return
    setImportError(null)
    const result = await approveSelected()
    if (result.ok && result.success) {
      onImportFinished?.({
        success: result.success,
        partial: result.partial,
        failureMessage: result.failureMessage,
      })
      onBack()
      return
    }
    // Ikke svelg feil/noop: vis tydelig melding på siden. Tidligere ga en mislykket
    // import (ok:false) verken bekreftelse eller feilmelding – den så bare ut til å «laste».
    setImportError(
      result.failureMessage ??
        'Importen kunne ikke fullføres, og ingenting ble lagret. Prøv igjen.'
    )
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
          <img src="/synka-mark.svg" className="w-8 h-8 opacity-90" alt="" aria-hidden />
          <div className="min-w-0">
            <p className="text-heading font-bold text-synkaNavy">Tankestrøm</p>
            <p className="text-caption text-synkaNavy/50">Lim inn eller last opp — vi finner hendelsene</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-6 [-webkit-overflow-scrolling:touch]">
        {/* Upload zone */}
        <div
          role="button"
          tabIndex={0}
          className="mx-4 mt-2 cursor-pointer p-8 text-center transition touch-manipulation active:opacity-80"
          style={{ border: '2px dashed rgba(22,107,79,0.25)', borderRadius: 12, background: 'rgba(22,107,79,0.03)' }}
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
              <IconUpload size={28} className="text-synkaPrimary/40 mb-2 mx-auto" aria-hidden />
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

        {/* Analyse-/filfeil (f.eks. ikke-støttet filtype) i input-fasen — rolig melding, ikke rå feil */}
        {error && !bundle && (
          <p role="alert" className="mx-4 mt-2 text-caption font-medium text-rose-600">
            {error}
          </p>
        )}

        {/* Valgte filer med navn + status */}
        {pendingFiles.length > 0 && (
          <ul className="mx-4 mt-2 space-y-1.5">
            {pendingFiles.map((pf) => (
              <li
                key={pf.id}
                className="flex items-center gap-2 rounded-md border border-synkaNavy/10 bg-white px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-body-sm text-synkaNavy">{pf.file.name}</span>
                <span className="shrink-0 text-caption text-synkaNavy/50">
                  {pf.status === 'analyzing'
                    ? 'Analyserer…'
                    : pf.status === 'done'
                      ? 'Ferdig'
                      : pf.status === 'error'
                        ? pf.statusDetail || 'Feil'
                        : 'Klar'}
                </span>
                {!analyzeLoading && (
                  <button
                    type="button"
                    onClick={() => removePendingFile(pf.id)}
                    aria-label={`Fjern ${pf.file.name}`}
                    className="shrink-0 rounded-md px-1.5 text-synkaNavy/40 transition hover:bg-synkaNavy/8 hover:text-synkaNavy/70"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Paste text section */}
        <div className="mx-4 mt-3">
          <button
            type="button"
            onClick={() => setShowTextSection((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-synkaNavy/10 bg-white px-4 py-2.5 text-left touch-manipulation hover:bg-synkaCream/60 transition"
          >
            <span className="text-body-sm font-medium text-synkaNavy/70">Eller lim inn tekst</span>
            <svg
              className={`h-4 w-4 shrink-0 text-synkaNavy/40 transition-transform ${showTextSection ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {showTextSection && (
            <div className="mt-1 space-y-2 rounded-b-lg border border-t-0 border-synkaNavy/10 bg-white px-3 pb-3 pt-2">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Lim inn ukeplan, e-post eller aktivitetsbeskrivelse…"
                rows={5}
                className="w-full resize-none rounded-md border border-synkaNavy/10 bg-zinc-50 px-3 py-2 text-body-sm text-synkaNavy placeholder:text-synkaNavy/30 outline-none focus:border-synkaTeal/50 focus:ring-1 focus:ring-synkaTeal/30"
              />
              {textInput.trim() && (
                <button
                  type="button"
                  onClick={handleAnalyzeText}
                  disabled={analyzeLoading}
                  className="w-full rounded-pill bg-synkaPrimary py-2.5 text-body-sm font-semibold text-white touch-manipulation disabled:opacity-40"
                >
                  {analyzeLoading ? 'Analyserer…' : 'Analyser tekst'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Personvelger (multi-select) — når familien har flere medlemmer og et valgt event mangler person */}
        {displayItems.length > 0 &&
          importPersonContext.candidatePersons.length > 1 &&
          (importPersonContext.selectedEventLacksPerson || chosenPersonIds.size > 0) && (
            <div className="mx-4 mt-4 rounded-md border border-synkaNavy/10 bg-white p-3">
              <p className="text-body-sm font-semibold text-synkaNavy">Hvem gjelder dette?</p>
              <p className="mt-0.5 text-caption text-synkaNavy/50">
                Velg én eller flere personer.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {importPersonContext.candidatePersons.map((p) => {
                  const on = chosenPersonIds.has(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => handleTogglePerson(p.id)}
                      className={`rounded-pill border px-2.5 py-1 text-caption font-semibold transition touch-manipulation ${
                        on
                          ? 'border-synkaPrimary/80 bg-synkaPrimary/15 text-synkaNavy shadow-sm'
                          : 'border-synkaNavy/15 bg-synkaCream/40 text-synkaNavy/70 hover:border-synkaNavy/25'
                      }`}
                    >
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        {/* Proposals section */}
        {eventDisplayItems.length > 0 && (
          <div className="mt-5">
            {/* Section header */}
            <div className="mb-3 flex items-center gap-2 px-4">
              <SectionDots size="sm" />
              <span className="text-caption font-semibold text-synkaNavy">Foreslåtte hendelser</span>
              <span className="rounded-pill bg-synkaTeal/15 px-2 text-caption text-synkaTeal">
                {eventDisplayItems.length}
              </span>
            </div>

            {/* Proposal cards */}
            {eventDisplayItems.map((item) => {
              const isSelected = selectedIds.has(item.proposalId)
              const draft = draftByProposalId[item.proposalId]

              const segments =
                item.kind === 'event' ? flattenEmbeddedScheduleOrdered(item.event.metadata) : []
              const isEmbeddedParent = segments.length > 0

              const eventDraft = draft?.importKind === 'event' ? draft.event : null
              let title = ''
              let dateKey = ''
              let timeLabel = ''
              let personColor = '#94a3b8'
              let location = ''
              let notes = ''

              if (item.kind === 'event') {
                // Draft-tittelen er allerede kalendertrygg. Uten draft (f.eks. enkelthendelse
                // uten sluttid) normaliserer vi rå-tittelen for enkelthendelser her, slik at
                // preview-tittelen er konsistent med import. Cup/embedded beholder rå-tittel
                // (ukedagen er en meningsbærende etikett der).
                title =
                  eventDraft?.title ??
                  (isEmbeddedParent
                    ? item.event.title
                    : normalizeSingleEventCalendarTitle(item.event.title, {
                        start: item.event.start,
                        end: item.event.end,
                      }))
                dateKey = eventDraft?.date ?? item.event.date
                const start = eventDraft?.start ?? item.event.start
                const end = eventDraft?.end ?? item.event.end
                if (start?.trim() && end?.trim()) timeLabel = `${start}–${end}`
                else if (start?.trim()) timeLabel = start
                const personId = eventDraft?.personId ?? item.event.personId
                personColor = people.find((p) => p.id === personId)?.colorAccent ?? '#94a3b8'
                location = eventDraft?.location ?? item.event.location ?? ''
                notes = eventDraft?.notes ?? item.event.notes ?? ''
              }

              const dateLabel = dateKey
                ? new Date(`${dateKey}T12:00:00`).toLocaleDateString('nb-NO', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                  })
                : ''
              const subLabel = isEmbeddedParent
                ? formatArrangementDateRange(dateKey, segments)
                : [dateLabel, timeLabel].filter(Boolean).join(' · ')

              return (
                <div key={item.proposalId} className="mx-4 mb-2">
                  <button
                    type="button"
                    onClick={() => toggleProposal(item.proposalId)}
                    className="flex w-full items-center gap-3 rounded-md border-l-4 bg-white p-3 text-left touch-manipulation active:bg-synkaCream/60"
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
                  {isEmbeddedParent ? (
                    <EmbeddedScheduleDayBlocks
                      parentItem={item as PortalEventProposal}
                      segments={segments}
                      originalImportText={analyzedImportTextSnapshot}
                    />
                  ) : (
                    <SingleEventDetails
                      metadata={item.event.metadata as EventMetadata | undefined}
                      title={title}
                      location={location}
                      notes={notes}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Tasks/frister — egen rolig seksjon, ikke blandet med kalenderdager */}
        {taskDisplayItems.length > 0 && (
          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2 px-4">
              <SectionDots size="sm" />
              <span className="text-caption font-semibold text-synkaNavy">Foreslåtte gjøremål</span>
              <span className="rounded-pill bg-synkaTeal/15 px-2 text-caption text-synkaTeal">
                {taskDisplayItems.length}
              </span>
            </div>
            {taskDisplayItems.map((item) => {
              if (item.kind !== 'task') return null
              const isSelected = selectedIds.has(item.proposalId)
              const draft = draftByProposalId[item.proposalId]
              const taskDraft = draft?.importKind === 'task' ? draft.task : null
              const title = taskDraft?.title ?? item.task.title
              const dateKey = taskDraft?.date ?? item.task.date
              const dueTime = taskDraft?.dueTime ?? item.task.dueTime
              // Skille må gjøre / valgfritt (can_help). Draften har alltid en intent;
              // fall tilbake til proposal-verdi, ev. «må gjøre» som trygg default.
              const taskIntent = taskDraft?.taskIntent ?? item.task.taskIntent ?? 'must_do'
              const personId = taskDraft?.childPersonId ?? item.task.childPersonId
              const personColor = people.find((p) => p.id === personId)?.colorAccent ?? '#94a3b8'
              const dateLabel = dateKey
                ? new Date(`${dateKey}T12:00:00`).toLocaleDateString('nb-NO', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                  })
                : ''
              const subLabel = [dateLabel, dueTime].filter(Boolean).join(' · ')
              return (
                <button
                  key={item.proposalId}
                  type="button"
                  onClick={() => toggleProposal(item.proposalId)}
                  className="mb-2 flex w-[calc(100%-2rem)] items-center gap-3 rounded-md border-l-4 bg-white p-3 text-left mx-4 touch-manipulation active:bg-synkaCream/60"
                  style={{ borderLeftColor: personColor }}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      isSelected ? 'border-synkaPrimary bg-synkaPrimary' : 'border-synkaNavy/20'
                    }`}
                  >
                    {isSelected && <IconCheck size={10} color="white" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-body-sm font-semibold text-synkaNavy">{title}</p>
                      <span
                        className={`shrink-0 inline-flex rounded-pill border px-1.5 py-px text-[10px] font-semibold ${taskIntentBadgeClassName(
                          taskIntent
                        )}`}
                      >
                        {taskIntentLabelNb(taskIntent)}
                      </span>
                    </div>
                    {subLabel && <p className="text-caption text-synkaNavy/50">{subLabel}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Sekundærsone: tasks/hendelser med lavere sikkerhet rutes hit av
            primaryCalendarProposalItems. Uten denne seksjonen var de usynlige i siden.
            Promote = eksplisitt brukerhandling → flyttes til hovedlisten (ingen auto-import). */}
        {visibleSecondaryImportCandidates.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2 px-4">
              <SectionDots size="sm" />
              <span className="text-caption font-semibold text-synkaNavy">Kanskje også relevant</span>
              <span className="rounded-pill bg-synkaNavy/10 px-2 text-caption text-synkaNavy/70">
                {visibleSecondaryImportCandidates.length}
              </span>
            </div>
            <p className="mb-3 px-4 text-caption text-synkaNavy/50">
              Mulige ekstra funn med lavere sikkerhet. Legg dem til som gjøremål eller hendelse hvis de er
              relevante.
            </p>
            {visibleSecondaryImportCandidates.map((c) => {
              const kindHint = c.suggestedKind === 'task' ? 'Gjøremål' : 'Hendelse'
              return (
                <div
                  key={c.candidateId}
                  className="mx-4 mb-2 rounded-md border border-dashed border-synkaNavy/20 bg-white px-3 py-2.5"
                >
                  <p className="text-body-sm font-semibold text-synkaNavy">{c.title}</p>
                  {c.summary && <p className="mt-0.5 text-caption text-synkaNavy/50">{c.summary}</p>}
                  <p className="mt-0.5 text-caption text-synkaNavy/40">Forslag: {kindHint}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => promoteSecondaryImportCandidate(c, 'task')}
                      className="rounded-md border border-synkaNavy/15 bg-synkaCream/40 px-2.5 py-1.5 text-caption font-semibold text-synkaNavy touch-manipulation active:bg-synkaCream"
                    >
                      Gjør til gjøremål
                    </button>
                    <button
                      type="button"
                      onClick={() => promoteSecondaryImportCandidate(c, 'event')}
                      className="rounded-md border border-synkaNavy/15 bg-synkaCream/40 px-2.5 py-1.5 text-caption font-semibold text-synkaNavy touch-manipulation active:bg-synkaCream"
                    >
                      Gjør til hendelse
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissSecondaryImportCandidate(c, 'ignore')}
                      className="rounded-md px-2.5 py-1.5 text-caption font-semibold text-synkaNavy/50 touch-manipulation active:bg-synkaCream/60"
                    >
                      Ignorer
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sticky footer — only shows when proposals exist */}
      {displayItems.length > 0 && (
        <div className="shrink-0 border-t border-synkaNavy/8 bg-synkaCream px-4 pb-4 pt-3">
          {importError && (
            <p
              role="alert"
              className="mb-2 whitespace-pre-line text-caption font-medium text-rose-600"
            >
              {importError}
            </p>
          )}
          <button
            type="button"
            disabled={selectedCount === 0 || saveLoading || !canApproveSelection}
            onClick={() => void handleApprove()}
            className={`${btnPrimaryPill} w-full h-12 gap-2 touch-manipulation disabled:opacity-40`}
          >
            {!saveLoading && <IconCheck size={16} aria-hidden />}
            {saveLoading
              ? 'Importerer…'
              : `Legg til ${promisedImportItemCount} hendelse${promisedImportItemCount === 1 ? '' : 'r'}`}
          </button>
        </div>
      )}
    </div>
  )
}
