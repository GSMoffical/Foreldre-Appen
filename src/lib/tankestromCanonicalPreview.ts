/**
 * Kanonisk preview-modell for Tankestrøm delprogram (embedded schedule child).
 *
 * Én pipeline produserer alt UI, selection, validering og edit-seed trenger.
 * Les aldri `segment.start` / `segment.tankestromHighlights` direkte i UI uten
 * å gå via denne modellen.
 */

import type { EmbeddedScheduleSegment } from '../types'
import type { NormalizedTankestromScheduleDetails } from './tankestromScheduleDetails'
import { buildPerDaySourceTextForValidation, sourceContainsTime } from './tankestromScheduleDetails'
import {
  embeddedScheduleChildReviewListTimeClock,
  resolveEmbeddedScheduleSegmentTimesForCalendarExport,
  tryDeriveOppmoteStartFromSegmentNotes,
} from './tankestromEmbeddedChildNotesPresentation'

const HM24 = /^([01]\d|2[0-3]):[0-5]\d$/

export type CanonicalDisplayTimeOrigin =
  | 'normalized_highlights'
  | 'derived_oppmote'
  | 'review_list_clock'
  | 'none'

export type TankestromEmbeddedChildCanonicalPreview = {
  normalized: NormalizedTankestromScheduleDetails
  sourceTextForValidation?: string
  /** Hovedtid i liste/detalj (samme som timeLabel for visning). */
  timeLabel: string
  /** null når foreløpig/uklar (– / Tid ikke avklart). */
  displayTime: string | null
  displayTimeOrigin: CanonicalDisplayTimeOrigin
  uncertainTime: boolean
  hasConcreteTimeDisplay: boolean
  /** Foreløpig/betinget uten bekreftet programtid. */
  isPreliminaryDay: boolean
  /** Skal forhåndsvelges og telles som importbar hendelse. */
  isImportSelectable: boolean
  /** Seed for rediger-skjema — aldri rå segment.start når den strider mot canonical. */
  editSeed: { start: string; end: string }
}

export type BuildEmbeddedChildCanonicalPreviewOpts = {
  originalImportText?: string
  normalizeDetails?: (
    segment: EmbeddedScheduleSegment,
    parentCardTitle: string,
    displayTitle: string,
    childProposalId: string,
    opts?: { originalImportText?: string }
  ) => NormalizedTankestromScheduleDetails
}

function earliestNormalizedHighlightTime(
  highlights: NormalizedTankestromScheduleDetails['highlights']
): string | null {
  const times = highlights
    .map((h) => h.time.trim().slice(0, 5))
    .filter((t) => HM24.test(t))
    .sort()
  return times[0] ?? null
}

function isNonDisplayTimeLabel(label: string): boolean {
  return label === '–' || label === 'Tid ikke avklart'
}

function segmentStartHm(seg: EmbeddedScheduleSegment): string | null {
  const raw = seg.start?.trim().slice(0, 5) ?? ''
  return HM24.test(raw) ? raw : null
}

/** Foreløpig/betinget dag: tid teller kun når dagsspesifikk kilde bekrefter klokkeslettet. */
function sourceConfirmsProgramTime(sourceText: string | undefined, hm: string | null | undefined): boolean {
  if (!hm || !HM24.test(hm)) return false
  const text = (sourceText ?? '').trim()
  if (!text) return false
  return sourceContainsTime(text, hm)
}

export function deriveEmbeddedChildDisplayTimeFromNormalized(
  normalized: NormalizedTankestromScheduleDetails,
  segment: EmbeddedScheduleSegment,
  opts?: { childProposalId?: string; sourceTextForValidation?: string }
): Pick<
  TankestromEmbeddedChildCanonicalPreview,
  'timeLabel' | 'displayTime' | 'displayTimeOrigin' | 'uncertainTime' | 'hasConcreteTimeDisplay'
> {
  const isConditional = segment.isConditional === true
  const sourceText = opts?.sourceTextForValidation

  const confirmedHighlights =
    isConditional && sourceText
      ? normalized.highlights.filter((h) => sourceConfirmsProgramTime(sourceText, h.time.slice(0, 5)))
      : normalized.highlights

  const earliestHighlightTime = earliestNormalizedHighlightTime(confirmedHighlights)

  const derivedOppmoteRaw = tryDeriveOppmoteStartFromSegmentNotes(segment, {
    childProposalId: opts?.childProposalId,
  })
  const derivedOppmote =
    derivedOppmoteRaw &&
    (!isConditional || sourceConfirmsProgramTime(sourceText, derivedOppmoteRaw.displayClock))
      ? derivedOppmoteRaw
      : null

  const reviewListClockRaw = embeddedScheduleChildReviewListTimeClock(segment)
  const startHm = segmentStartHm(segment)
  const reviewListClock =
    reviewListClockRaw.clock &&
    (!isConditional || sourceConfirmsProgramTime(sourceText, startHm))
      ? reviewListClockRaw
      : { clock: null, omittedSynthetic: true, durationSuppressedAsUnknown: false }

  let displayTimeOrigin: CanonicalDisplayTimeOrigin = 'none'
  let timeLabel: string

  if (earliestHighlightTime) {
    timeLabel = earliestHighlightTime
    displayTimeOrigin = 'normalized_highlights'
  } else if (derivedOppmote?.displayClock) {
    timeLabel = derivedOppmote.displayClock
    displayTimeOrigin = 'derived_oppmote'
  } else if (reviewListClock.clock) {
    timeLabel = reviewListClock.clock
    displayTimeOrigin = 'review_list_clock'
  } else if (isConditional) {
    timeLabel = '–'
    displayTimeOrigin = 'none'
  } else {
    timeLabel = 'Tid ikke avklart'
    displayTimeOrigin = 'none'
  }

  const uncertainTime =
    !earliestHighlightTime && !derivedOppmote && !reviewListClock.clock && !isConditional

  const hasConcreteTimeDisplay = Boolean(
    earliestHighlightTime ?? derivedOppmote?.displayClock ?? reviewListClock.clock
  )

  const displayTime = isNonDisplayTimeLabel(timeLabel) ? null : timeLabel

  return { timeLabel, displayTime, displayTimeOrigin, uncertainTime, hasConcreteTimeDisplay }
}

export function canonicalSegmentIsPreliminaryDay(
  segment: EmbeddedScheduleSegment,
  preview: Pick<TankestromEmbeddedChildCanonicalPreview, 'hasConcreteTimeDisplay'>
): boolean {
  if (segment.isConditional === true) {
    return !preview.hasConcreteTimeDisplay
  }
  return false
}

/** Kan importeres/forhåndsvelges som tidsbestemt kalenderhendelse. */
export function canonicalSegmentIsImportSelectable(
  _segment: EmbeddedScheduleSegment,
  preview: Pick<TankestromEmbeddedChildCanonicalPreview, 'hasConcreteTimeDisplay' | 'isPreliminaryDay'>
): boolean {
  if (preview.isPreliminaryDay) return false
  if (!preview.hasConcreteTimeDisplay) return false
  return true
}

/**
 * Edit-seed fra canonical — ignorerer rå segment.start/end når de strider mot displayTime.
 */
export function canonicalEditSeedFromPreview(
  preview: TankestromEmbeddedChildCanonicalPreview,
  segment: EmbeddedScheduleSegment,
  opts?: { childProposalId?: string }
): { start: string; end: string } {
  if (!preview.hasConcreteTimeDisplay || !preview.displayTime) {
    return { start: '', end: '' }
  }
  const start = preview.displayTime.slice(0, 5)
  const exportTimes = resolveEmbeddedScheduleSegmentTimesForCalendarExport(segment, {
    childProposalId: opts?.childProposalId,
  })
  const exportStart = exportTimes.start.slice(0, 5)
  const exportEnd = exportTimes.end.slice(0, 5)
  let end = ''
  if (HM24.test(exportEnd) && exportEnd !== start) {
    if (!HM24.test(exportStart) || exportStart === start) {
      end = exportEnd
    }
  }
  return { start, end }
}

export function buildEmbeddedChildCanonicalPreview(
  segment: EmbeddedScheduleSegment,
  parentCardTitle: string,
  displayTitle: string,
  childProposalId: string,
  opts?: BuildEmbeddedChildCanonicalPreviewOpts
): TankestromEmbeddedChildCanonicalPreview {
  const sourceTextForValidation = buildPerDaySourceTextForValidation({
    segmentSourceText: typeof segment.notes === 'string' ? segment.notes : undefined,
    globalSourceText: opts?.originalImportText,
    date: segment.date,
  })

  const normalizeDetails = opts?.normalizeDetails
  if (!normalizeDetails) {
    throw new Error(
      'buildEmbeddedChildCanonicalPreview: normalizeDetails er påkrevd (injiser fra useTankestromImport).'
    )
  }

  const normalized = normalizeDetails(segment, parentCardTitle, displayTitle, childProposalId, {
    originalImportText: opts?.originalImportText,
  })

  const display = deriveEmbeddedChildDisplayTimeFromNormalized(normalized, segment, {
    childProposalId,
    sourceTextForValidation,
  })

  const isPreliminaryDay = canonicalSegmentIsPreliminaryDay(segment, display)
  const isImportSelectable = canonicalSegmentIsImportSelectable(segment, {
    ...display,
    isPreliminaryDay,
  })

  const editSeed = canonicalEditSeedFromPreview(
    {
      normalized,
      sourceTextForValidation,
      ...display,
      isPreliminaryDay,
      isImportSelectable,
      editSeed: { start: '', end: '' },
    },
    segment,
    { childProposalId }
  )

  return {
    normalized,
    sourceTextForValidation,
    ...display,
    isPreliminaryDay,
    isImportSelectable,
    editSeed,
  }
}
