import type { Event, EventMetadata } from '../types'
import type { PortalEventProposal } from '../features/tankestrom/types'
import { getEventEndDate, isAllDayEvent } from './eventLayer'
import { getEventParticipantIds } from './schedule'
import { semanticTitleCore } from './tankestromImportDedupe'
import { isEmbeddedScheduleParentProposalItem } from './embeddedSchedule'

export type AnchoredExistingEvent = { event: Event; anchorDate: string }

function normLoc(s: string | undefined): string {
  return (s ?? '').toLocaleLowerCase('nb-NO').replace(/\s+/g, ' ').trim()
}

function dateRangesOverlap(a0: string, a1: string, b0: string, b1: string): boolean {
  return a1 >= b0 && a0 <= b1
}

/** Importert forslag oppfører seg som container / flerdagers (smal MVP-fokus). */
export function importEventIsContainerLikeForMatching(item: PortalEventProposal): boolean {
  if (item.kind !== 'event') return false
  if (isEmbeddedScheduleParentProposalItem(item)) return true
  const end = item.event.metadata && typeof item.event.metadata === 'object' ? item.event.metadata.endDate : undefined
  return typeof end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(end) && end !== item.event.date.trim()
}

export function existingEventLooksLikeContainer(anchor: AnchoredExistingEvent): boolean {
  const { event, anchorDate } = anchor
  const meta = event.metadata
  const sched =
    meta && typeof meta === 'object' && Array.isArray((meta as EventMetadata).embeddedSchedule)
      ? (meta as EventMetadata).embeddedSchedule!
      : []
  if (sched.length > 0) return true
  return getEventEndDate(event, anchorDate) > anchorDate
}

function titleScore(importTitle: string, existingTitle: string): { score: number; detail: string } {
  const a = semanticTitleCore(importTitle)
  const b = semanticTitleCore(existingTitle)
  if (!a || !b) return { score: 0, detail: 'weak_title' }
  if (a === b) return { score: 48, detail: 'title_exact_core' }
  if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) {
    return { score: 40, detail: 'title_substring_core' }
  }
  const wa = new Set(a.split(' ').filter((w) => w.length > 2))
  const wb = new Set(b.split(' ').filter((w) => w.length > 2))
  if (wa.size === 0 || wb.size === 0) return { score: 0, detail: 'title_no_tokens' }
  let inter = 0
  for (const w of wa) if (wb.has(w)) inter += 1
  const j = inter / Math.min(wa.size, wb.size)
  if (j >= 0.55) return { score: Math.round(22 + j * 18), detail: 'title_token_overlap' }
  return { score: 0, detail: 'title_mismatch' }
}

export type ExistingEventMatchResult = {
  candidate: AnchoredExistingEvent | null
  score: number
  rejected: boolean
  rejectReason?: string
}

const SUGGEST_MIN_SCORE = 78

/**
 * Finn én konservativ kandidat: overlapp i dato, delt person, sterk nok tittel + container-lik import og eksisterende.
 */
export function findConservativeExistingEventMatch(
  proposal: PortalEventProposal,
  importTitle: string,
  importStartDate: string,
  importEndDate: string,
  importPersonId: string,
  anchoredExisting: readonly AnchoredExistingEvent[]
): ExistingEventMatchResult {
  const dbg = import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true'

  if (proposal.kind !== 'event') {
    if (dbg)
      console.debug('[tankestrom existing event match]', {
        existingEventCandidateRejected: true,
        existingEventCandidateScore: 0,
        reason: 'not_event_proposal',
      })
    return { candidate: null, score: 0, rejected: true, rejectReason: 'not_event' }
  }

  if (!importEventIsContainerLikeForMatching(proposal)) {
    if (dbg)
      console.debug('[tankestrom existing event match]', {
        existingEventCandidateRejected: true,
        existingEventCandidateScore: 0,
        reason: 'import_not_container_like',
      })
    return { candidate: null, score: 0, rejected: true, rejectReason: 'import_not_container' }
  }

  let best: { anchor: AnchoredExistingEvent; score: number; titleDetail: string } | null = null

  for (const anchor of anchoredExisting) {
    const { event, anchorDate } = anchor
    if (!existingEventLooksLikeContainer(anchor)) continue

    const exEnd = getEventEndDate(event, anchorDate)
    if (!dateRangesOverlap(importStartDate, importEndDate, anchorDate, exEnd)) continue

    const participants = getEventParticipantIds(event)
    if (!participants.includes(importPersonId)) continue

    const { score: ts, detail: titleDetail } = titleScore(importTitle, event.title)
    if (ts < 32) continue

    let score = ts + 30
    const li = normLoc(proposal.event.location)
    const le = normLoc(event.location)
    if (li.length > 2 && le.length > 2 && li === le) score += 12

    if (
      isEmbeddedScheduleParentProposalItem(proposal) &&
      Array.isArray(event.metadata?.embeddedSchedule) &&
      event.metadata.embeddedSchedule.length > 0
    ) {
      score += 14
    }

    if (isAllDayEvent(event) && (proposal.event.metadata?.isAllDay || proposal.event.metadata?.multiDayAllDay)) {
      score += 6
    }

    if (!best || score > best.score) {
      best = { anchor, score, titleDetail }
    }
  }

  if (!best) {
    if (dbg)
      console.debug('[tankestrom existing event match]', {
        existingEventCandidateRejected: true,
        existingEventCandidateScore: 0,
        reason: 'no_candidate_passed_filters',
      })
    return { candidate: null, score: 0, rejected: true, rejectReason: 'no_candidate' }
  }

  if (best.score < SUGGEST_MIN_SCORE) {
    if (dbg)
      console.debug('[tankestrom existing event match]', {
        existingEventCandidateRejected: true,
        existingEventCandidateScore: best.score,
        reason: 'below_threshold',
        titleDetail: best.titleDetail,
      })
    return { candidate: null, score: best.score, rejected: true, rejectReason: 'below_threshold' }
  }

  if (dbg) {
    console.debug('[tankestrom existing event match]', {
      existingEventCandidateMatched: true,
      existingEventCandidateScore: best.score,
      existingEventLinkSuggested: true,
      titleDetail: best.titleDetail,
      anchorDate: best.anchor.anchorDate,
      eventId: best.anchor.event.id,
    })
  }

  return { candidate: best.anchor, score: best.score, rejected: false }
}
