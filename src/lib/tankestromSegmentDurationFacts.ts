/**
 * Strukturerte varighets-/sluttid-felt fra Tankestrom på embedded program-segmenter.
 * Foreldre-Appen bruker disse før lokal conservative fallback.
 */

import type { EmbeddedScheduleSegment } from '../types'
import { tankestromTimeSourceIsComputedFromDuration } from './tankestromComputedTimePresentation'

const HM24 = /^([01]\d|2[0-3]):[0-5]\d$/
const SYNTHETIC_CLOCK = new Set(['00:00', '06:00', '23:59'])

const EXPLICIT_END_SOURCES = new Set([
  'explicit',
  'explicit_arrival_time',
  'explicit_end_time',
  'segment_pair_sanitized',
])

const COMPUTED_END_SOURCES = new Set([
  'computed_from_duration',
  'computed_from_duration_and_aftertime',
])

export type TankestromSegmentDurationFacts = {
  inferredEndTime?: boolean
  endTimeSource?: string
  activityDurationMinutes?: number
  afterBufferMinutes?: number
  timePrecision?: string
  timeComputation?: Record<string, unknown>
}

export type SegmentEndTimeProvenance =
  | 'source_confirmed_end'
  | 'api_inferred_end'
  | 'frontend_canonical_fallback'

export const FRONTEND_CANONICAL_FALLBACK_END_SOURCE = 'frontend_canonical_fallback'

const UNTRUSTED_API_END_SOURCES = new Set(['missing_or_unreadable', 'missing', 'layout_only'])

export function readTankestromSegmentDurationFacts(
  segment: EmbeddedScheduleSegment
): TankestromSegmentDurationFacts {
  const r = segment as EmbeddedScheduleSegment & TankestromSegmentDurationFacts
  const out: TankestromSegmentDurationFacts = {}
  if (typeof r.inferredEndTime === 'boolean') out.inferredEndTime = r.inferredEndTime
  if (typeof r.endTimeSource === 'string' && r.endTimeSource.trim()) {
    out.endTimeSource = r.endTimeSource.trim()
  }
  if (typeof r.activityDurationMinutes === 'number' && Number.isFinite(r.activityDurationMinutes)) {
    out.activityDurationMinutes = Math.max(0, Math.round(r.activityDurationMinutes))
  }
  if (typeof r.afterBufferMinutes === 'number' && Number.isFinite(r.afterBufferMinutes)) {
    out.afterBufferMinutes = Math.max(0, Math.round(r.afterBufferMinutes))
  }
  if (typeof r.timePrecision === 'string' && r.timePrecision.trim()) {
    out.timePrecision = r.timePrecision.trim()
  }
  const tc = r.timeComputation
  if (tc && typeof tc === 'object' && !Array.isArray(tc)) {
    out.timeComputation = tc as Record<string, unknown>
  }
  return out
}

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

function segmentEndHm(segment: EmbeddedScheduleSegment): string | null {
  const raw = segment.end?.trim().slice(0, 5) ?? ''
  if (!raw || !HM24.test(raw) || SYNTHETIC_CLOCK.has(raw)) return null
  return raw
}

function endTimeSourceNorm(facts: TankestromSegmentDurationFacts): string {
  return (facts.endTimeSource ?? '').trim().toLowerCase()
}

export function segmentEndTimeSourceIsExplicit(facts: TankestromSegmentDurationFacts): boolean {
  const src = endTimeSourceNorm(facts)
  return EXPLICIT_END_SOURCES.has(src)
}

export function segmentEndTimeSourceIsApiComputed(facts: TankestromSegmentDurationFacts): boolean {
  const src = endTimeSourceNorm(facts)
  if (COMPUTED_END_SOURCES.has(src)) return true
  return tankestromTimeSourceIsComputedFromDuration(src)
}

function durationMinutesFromTimeComputation(
  tc: Record<string, unknown> | undefined
): { activity?: number; afterBuffer?: number; end?: string } {
  if (!tc) return {}
  const activity =
    typeof tc.durationMinutes === 'number' && Number.isFinite(tc.durationMinutes)
      ? Math.max(0, Math.round(tc.durationMinutes))
      : typeof tc.activityDurationMinutes === 'number' && Number.isFinite(tc.activityDurationMinutes)
        ? Math.max(0, Math.round(tc.activityDurationMinutes))
        : undefined
  const afterBuffer =
    typeof tc.afterBufferMinutes === 'number' && Number.isFinite(tc.afterBufferMinutes)
      ? Math.max(0, Math.round(tc.afterBufferMinutes))
      : undefined
  const endRaw =
    (typeof tc.end === 'string' && tc.end.trim().slice(0, 5)) ||
    (typeof tc.endTime === 'string' && tc.endTime.trim().slice(0, 5)) ||
    ''
  const end = HM24.test(endRaw) && !SYNTHETIC_CLOCK.has(endRaw) ? endRaw : undefined
  return { activity, afterBuffer, end }
}

/** Trusted API end: eksplisitt slutt eller computed med buffer-evidence. */
export function segmentHasTrustedApiEnd(facts: TankestromSegmentDurationFacts): boolean {
  const src = endTimeSourceNorm(facts)
  if (UNTRUSTED_API_END_SOURCES.has(src)) return false
  if (segmentEndTimeSourceIsExplicit(facts) && facts.inferredEndTime !== true) return true
  if (segmentEndTimeSourceIsApiComputed(facts)) {
    const tc = durationMinutesFromTimeComputation(facts.timeComputation)
    const afterBuffer = facts.afterBufferMinutes ?? tc.afterBuffer ?? 0
    return afterBuffer > 0 || facts.activityDurationMinutes != null || tc.activity != null
  }
  if (facts.inferredEndTime === true && facts.activityDurationMinutes != null && facts.afterBufferMinutes != null) {
    return true
  }
  return false
}

function apiHasDurationEvidence(facts: TankestromSegmentDurationFacts): boolean {
  return segmentHasTrustedApiEnd(facts)
}

function computeEndFromDurationParts(
  anchorHm: string,
  activityMinutes: number,
  afterBufferMinutes: number
): string {
  return addMinutesToHmClamp(anchorHm, activityMinutes + afterBufferMinutes)
}

/**
 * Slutt fra Tankestrom (segment.end, timeComputation eller varighetsfelt).
 * Returnerer null når API ikke leverer brukbar inferred slutt.
 */
export function resolveTankestromApiInferredEnd(
  segment: EmbeddedScheduleSegment,
  canonicalStart: string,
  opts?: { latestConfirmedHighlightHm?: string | null }
): {
  end: string
  endTimeSource: string
  inferredEndTime: boolean
  usesSyntheticLayoutEnd: boolean
} | null {
  if (!HM24.test(canonicalStart)) return null
  const facts = readTankestromSegmentDurationFacts(segment)
  if (!apiHasDurationEvidence(facts)) return null

  const src = endTimeSourceNorm(facts) || 'computed_from_duration'
  const tcParts = durationMinutesFromTimeComputation(facts.timeComputation)
  const activity =
    facts.activityDurationMinutes ?? tcParts.activity
  const afterBuffer = facts.afterBufferMinutes ?? tcParts.afterBuffer ?? 0

  const segmentEnd = segmentEndHm(segment)
  const tcEnd = tcParts.end

  let candidateEnd: string | null = null
  if (segmentEnd && hmStringToMinutes(segmentEnd) > hmStringToMinutes(canonicalStart)) {
    candidateEnd = segmentEnd
  } else if (tcEnd && hmStringToMinutes(tcEnd) > hmStringToMinutes(canonicalStart)) {
    candidateEnd = tcEnd
  }

  if (!candidateEnd && activity != null) {
    const anchor =
      opts?.latestConfirmedHighlightHm && HM24.test(opts.latestConfirmedHighlightHm)
        ? opts.latestConfirmedHighlightHm
        : canonicalStart
    candidateEnd = computeEndFromDurationParts(anchor, activity, afterBuffer)
  }

  if (!candidateEnd) return null

  const usesSynthetic =
    facts.inferredEndTime === true ||
    segmentEndTimeSourceIsApiComputed(facts) ||
    activity != null

  return {
    end: candidateEnd,
    endTimeSource: src,
    inferredEndTime: facts.inferredEndTime === true || segmentEndTimeSourceIsApiComputed(facts),
    usesSyntheticLayoutEnd: usesSynthetic,
  }
}
