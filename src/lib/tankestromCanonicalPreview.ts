/**
 * Kanonisk preview-modell for Tankestrøm delprogram (embedded schedule child).
 *
 * Én pipeline produserer alt UI, selection, validering og edit-seed trenger.
 * Les aldri `segment.start` / `segment.tankestromHighlights` direkte i UI uten
 * å gå via denne modellen.
 */

import type { EmbeddedScheduleSegment } from '../types'
import type { NormalizedTankestromScheduleDetails } from './tankestromScheduleDetails'
import {
  buildPerDaySourceTextForValidation,
  sourceConfirmsConcreteProgramTime,
  sourceMentionsTimeAsTentativeWindow,
} from './tankestromScheduleDetails'
import type { EmbeddedScheduleChildExportTimePolicy } from './tankestromEmbeddedChildNotesPresentation'
import {
  embeddedScheduleChildReviewListTimeClock,
  tryDeriveOppmoteStartFromSegmentNotes,
} from './tankestromEmbeddedChildNotesPresentation'
import {
  FRONTEND_CANONICAL_FALLBACK_END_SOURCE,
  readTankestromSegmentDurationFacts,
  resolveTankestromApiInferredEnd,
  segmentEndTimeSourceIsExplicit,
  segmentHasTrustedApiEnd,
  type SegmentEndTimeProvenance,
} from './tankestromSegmentDurationFacts'

const HM24 = /^([01]\d|2[0-3]):[0-5]\d$/
const SYNTHETIC_CLOCK = new Set(['00:00', '06:00', '23:59'])
/** Siste kamp + hall/opprydding — f.eks. 17:30 → 18:45, 14:40 → 15:55. */
const CANONICAL_KAMP_END_BUFFER_MINUTES = 75
/** Kun oppmøte/start uten kamp-highlight. */
const CANONICAL_START_ONLY_END_MINUTES = 90
const MAX_REASONABLE_CANONICAL_SPAN_MINUTES = 12 * 60

function hmStringToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10))
  return h * 60 + m
}

function addMinutesToHmClamp(hm: string, addMinutes: number): string {
  const startMin = hmStringToMinutes(hm)
  const endMin = Math.min(startMin + addMinutes, 23 * 60 + 59)
  const h = Math.floor(endMin / 60)
  const m = endMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function confirmedHighlights(
  highlights: NormalizedTankestromScheduleDetails['highlights'],
  sourceText?: string
): NormalizedTankestromScheduleDetails['highlights'] {
  return sourceText
    ? highlights.filter((h) => sourceConfirmsProgramTime(sourceText, h.time.slice(0, 5)))
    : highlights
}

function highlightIsKamp(h: { label: string; type?: string }): boolean {
  const t = (h.type ?? '').trim().toLowerCase()
  if (t === 'match') return true
  const s = h.label.toLocaleLowerCase('nb-NO')
  if (s.includes('oppmøte') || /\bmøte\b/.test(s)) return false
  return s.includes('kamp') || s.includes('match')
}

/** Siste bekreftede kamp-highlight (ignorerer oppmøte/notat). */
function lastConfirmedKampHighlightTime(
  highlights: NormalizedTankestromScheduleDetails['highlights'],
  sourceText?: string
): string | null {
  const times = confirmedHighlights(highlights, sourceText)
    .filter(highlightIsKamp)
    .map((h) => h.time.trim().slice(0, 5))
    .filter((t) => HM24.test(t))
    .sort()
  return times[times.length - 1] ?? null
}

function segmentEndIsCanonicalExportCandidate(
  segment: EmbeddedScheduleSegment,
  canonicalStart: string,
  lastKampHighlight: string | null,
  sourceText?: string
): string | null {
  const raw = segment.end?.trim().slice(0, 5) ?? ''
  if (!raw || !HM24.test(raw) || SYNTHETIC_CLOCK.has(raw)) return null
  const endMin = hmStringToMinutes(raw)
  const startMin = hmStringToMinutes(canonicalStart)
  if (endMin <= startMin || endMin - startMin > MAX_REASONABLE_CANONICAL_SPAN_MINUTES) return null
  if (lastKampHighlight && endMin < hmStringToMinutes(lastKampHighlight)) return null
  if (sourceText && sourceMentionsTimeAsTentativeWindow(raw, sourceText)) return null

  const durationFacts = readTankestromSegmentDurationFacts(segment)
  if (segmentHasTrustedApiEnd(durationFacts)) {
    const src = (durationFacts.endTimeSource ?? '').trim().toLowerCase()
    const isExplicitNonInferred =
      segmentEndTimeSourceIsExplicit(durationFacts) && durationFacts.inferredEndTime !== true
    if (isExplicitNonInferred) return raw
    if (durationFacts.inferredEndTime === true || src.includes('computed')) {
      return null
    }
    return raw
  }

  if (sourceText && sourceConfirmsConcreteProgramTime(sourceText, raw)) return raw
  return null
}

function buildFrontendCanonicalFallbackTimes(
  start: string,
  highlights: NormalizedTankestromScheduleDetails['highlights'],
  sourceText: string | undefined,
  derivedFromOppmote: boolean
): CanonicalEmbeddedChildExportTimes {
  const lastKamp = lastConfirmedKampHighlightTime(highlights, sourceText)
  const end =
    lastKamp && hmStringToMinutes(lastKamp) >= hmStringToMinutes(start)
      ? addMinutesToHmClamp(lastKamp, CANONICAL_KAMP_END_BUFFER_MINUTES)
      : addMinutesToHmClamp(start, CANONICAL_START_ONLY_END_MINUTES)

  return {
    start,
    end,
    inferredEndTime: true,
    usesSyntheticLayoutEnd: true,
    endTimeProvenance: 'frontend_canonical_fallback',
    endTimeSource: FRONTEND_CANONICAL_FALLBACK_END_SOURCE,
    embeddedScheduleChildExportTimePolicyUsed: 'segment_start_conservative_end',
    embeddedScheduleChildExportDerivedMeetingTimeApplied: derivedFromOppmote,
    embeddedScheduleChildExportDurationSuppressed: false,
    embeddedScheduleChildExportSyntheticTimeSkipped: false,
    embeddedScheduleChildExportTimeNormalized: true,
  }
}

export type CanonicalEmbeddedChildExportTimes = {
  start: string
  end: string
  inferredEndTime: boolean
  usesSyntheticLayoutEnd: boolean
  endTimeProvenance: SegmentEndTimeProvenance
  /** Videreføres til persist-metadata når satt (API eller mapped fallback). */
  endTimeSource?: string
  embeddedScheduleChildExportTimePolicyUsed: EmbeddedScheduleChildExportTimePolicy
  embeddedScheduleChildExportDerivedMeetingTimeApplied: boolean
  embeddedScheduleChildExportDurationSuppressed: boolean
  embeddedScheduleChildExportSyntheticTimeSkipped: boolean
  embeddedScheduleChildExportTimeNormalized: boolean
}

/**
 * Kalender-exporttider fra canonical preview — aldri rå `segment.start` når den strider mot displayTime.
 */
export function resolveCanonicalEmbeddedChildExportTimes(
  preview: TankestromEmbeddedChildCanonicalPreview,
  segment: EmbeddedScheduleSegment,
  _opts?: { childProposalId?: string }
): CanonicalEmbeddedChildExportTimes {
  const start = preview.displayTime?.slice(0, 5) ?? ''
  const empty: CanonicalEmbeddedChildExportTimes = {
    start: '',
    end: '',
    inferredEndTime: false,
    usesSyntheticLayoutEnd: false,
    endTimeProvenance: 'frontend_canonical_fallback',
    embeddedScheduleChildExportTimePolicyUsed: 'no_safe_segment_clock_default_slot',
    embeddedScheduleChildExportDerivedMeetingTimeApplied: false,
    embeddedScheduleChildExportDurationSuppressed: false,
    embeddedScheduleChildExportSyntheticTimeSkipped: true,
    embeddedScheduleChildExportTimeNormalized: true,
  }
  if (!HM24.test(start)) return empty

  const sourceText = preview.sourceTextForValidation
  const lastKampHighlight = lastConfirmedKampHighlightTime(preview.normalized.highlights, sourceText)
  const derivedFromOppmote = preview.displayTimeOrigin === 'derived_oppmote'
  const durationFacts = readTankestromSegmentDurationFacts(segment)

  const confirmedEnd = segmentEndIsCanonicalExportCandidate(segment, start, lastKampHighlight, sourceText)
  if (confirmedEnd) {
    return {
      start,
      end: confirmedEnd,
      inferredEndTime: false,
      usesSyntheticLayoutEnd: false,
      endTimeProvenance: 'source_confirmed_end',
      endTimeSource: durationFacts.endTimeSource ?? 'explicit',
      embeddedScheduleChildExportTimePolicyUsed: 'segment_pair_sanitized',
      embeddedScheduleChildExportDerivedMeetingTimeApplied: derivedFromOppmote,
      embeddedScheduleChildExportDurationSuppressed: false,
      embeddedScheduleChildExportSyntheticTimeSkipped: false,
      embeddedScheduleChildExportTimeNormalized: true,
    }
  }

  const apiInferred = resolveTankestromApiInferredEnd(segment, start, {
    latestConfirmedHighlightHm: lastKampHighlight,
  })
  if (apiInferred) {
    return {
      start,
      end: apiInferred.end,
      inferredEndTime: apiInferred.inferredEndTime,
      usesSyntheticLayoutEnd: apiInferred.usesSyntheticLayoutEnd,
      endTimeProvenance: 'api_inferred_end',
      endTimeSource: apiInferred.endTimeSource,
      embeddedScheduleChildExportTimePolicyUsed: 'segment_start_conservative_end',
      embeddedScheduleChildExportDerivedMeetingTimeApplied: derivedFromOppmote,
      embeddedScheduleChildExportDurationSuppressed: false,
      embeddedScheduleChildExportSyntheticTimeSkipped: false,
      embeddedScheduleChildExportTimeNormalized: true,
    }
  }

  return buildFrontendCanonicalFallbackTimes(
    start,
    preview.normalized.highlights,
    sourceText,
    derivedFromOppmote
  )
}

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

/** Bekreftet programtid — ikke bare tidsvindu eller foreløpig markør. */
function sourceConfirmsProgramTime(sourceText: string | undefined, hm: string | null | undefined): boolean {
  return sourceConfirmsConcreteProgramTime(sourceText, hm)
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

  const confirmedHighlights = sourceText
    ? normalized.highlights.filter((h) => sourceConfirmsProgramTime(sourceText, h.time.slice(0, 5)))
    : normalized.highlights

  const earliestHighlightTime = earliestNormalizedHighlightTime(confirmedHighlights)

  const derivedOppmoteRaw = tryDeriveOppmoteStartFromSegmentNotes(
    sourceText && (!segment.notes || String(segment.notes).trim().length < 12)
      ? { ...segment, notes: sourceText }
      : segment,
    {
      childProposalId: opts?.childProposalId,
    }
  )
  const derivedOppmote =
    derivedOppmoteRaw &&
    (!sourceText || sourceConfirmsProgramTime(sourceText, derivedOppmoteRaw.displayClock))
      ? derivedOppmoteRaw
      : null

  const reviewListClockRaw = embeddedScheduleChildReviewListTimeClock(segment)
  const startHm = segmentStartHm(segment)
  const reviewListClock =
    reviewListClockRaw.clock && (!sourceText || sourceConfirmsProgramTime(sourceText, startHm))
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
  const times = resolveCanonicalEmbeddedChildExportTimes(preview, segment, opts)
  return { start: times.start, end: times.end }
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
