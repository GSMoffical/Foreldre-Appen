import type { Event } from '../types'
import { getEventEndDate, isForegroundEvent } from './eventLayer'
import { getEventParticipantIds } from './schedule'
import { arrangementTitleCoreForMatch } from './tankestromExistingEventMatch'

export type AnchoredForegroundEvent = { event: Event; anchorDate: string }

/** Én kalender-rad uten flerdagers-span og uten eget embeddedSchedule (typisk tidligere cup-dag fra barn-eksport). */
export function isClusterCleanupSingleDayRow(anchor: AnchoredForegroundEvent): boolean {
  const { event, anchorDate } = anchor
  const exEnd = getEventEndDate(event, anchorDate)
  if (exEnd !== anchorDate) return false
  const sched = event.metadata?.embeddedSchedule
  if (Array.isArray(sched) && sched.length > 0) return false
  return true
}

/** Trolig tidligere Tankestrøm barn-rad — unngår å slette manuelle hendelser uten spor. */
export function isLikelyPriorTankestromEmbeddedDayRow(event: Event): boolean {
  const m = event.metadata
  if (!m || typeof m !== 'object' || Array.isArray(m)) return false
  const r = m as Record<string, unknown>
  if (r.detachedFromEmbeddedParentId != null) return true
  if (r.integration != null && typeof r.integration === 'object') return true
  return false
}

export type ClusterCleanupResult = {
  deletedIds: string[]
  deletedAnchors: { date: string; eventId: string }[]
}

/**
 * Etter at en programforelder er lagret på anker-rad: slett andre dag-rader som tydelig er samme arrangementsklynge
 * og som faller på dager som nå dekkes av nytt embeddedSchedule (konservativ policy).
 */
export async function cleanupParallelClusterDayRowsAfterEmbeddedParentUpdate(opts: {
  deleteEvent: (date: string, eventId: string) => Promise<void>
  getAnchoredForegroundEventsForMatching: () => readonly AnchoredForegroundEvent[]
  anchorEventId: string
  importParentTitleRaw: string
  importPersonId: string
  programDates: readonly string[]
}): Promise<ClusterCleanupResult> {
  const dbg = import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true'
  const deletedIds: string[] = []
  const deletedAnchors: { date: string; eventId: string }[] = []

  const importCore = arrangementTitleCoreForMatch(opts.importParentTitleRaw)
  if (!importCore || opts.programDates.length === 0) {
    if (dbg) {
      console.debug('[tankestrom existing event cluster cleanup]', {
        existingEventClusterCleanupSkipped: true,
        existingEventClusterCleanupReason: !importCore ? 'weak_import_title_core' : 'no_program_dates',
      })
    }
    return { deletedIds, deletedAnchors }
  }

  const programSet = new Set(opts.programDates)
  const anchors = opts.getAnchoredForegroundEventsForMatching()
  const toDelete: AnchoredForegroundEvent[] = []

  if (dbg) {
    console.debug('[tankestrom existing event cluster cleanup]', {
      existingEventClusterCleanupStarted: true,
      anchorEventId: opts.anchorEventId,
      programDates: [...opts.programDates],
      importTitleCore: importCore,
    })
  }

  for (const a of anchors) {
    const { event, anchorDate } = a
    if (event.id === opts.anchorEventId) continue
    if (!isForegroundEvent(event)) continue
    if (event.recurrenceGroupId) continue
    if (!getEventParticipantIds(event).includes(opts.importPersonId)) continue
    if (!isClusterCleanupSingleDayRow(a)) continue
    if (!isLikelyPriorTankestromEmbeddedDayRow(event)) continue
    if (arrangementTitleCoreForMatch(event.title) !== importCore) continue
    if (!programSet.has(anchorDate)) continue

    if (dbg) {
      console.debug('[tankestrom existing event cluster cleanup]', {
        existingEventClusterCleanupCandidateFound: true,
        existingEventClusterDuplicateDayRowDetected: true,
        eventId: event.id,
        anchorDate,
        title: event.title,
      })
    }
    toDelete.push(a)
  }

  toDelete.sort((x, y) => x.anchorDate.localeCompare(y.anchorDate))

  for (const a of toDelete) {
    try {
      await opts.deleteEvent(a.anchorDate, a.event.id)
      deletedIds.push(a.event.id)
      deletedAnchors.push({ date: a.anchorDate, eventId: a.event.id })
      if (dbg) {
        console.debug('[tankestrom existing event cluster cleanup]', {
          existingEventClusterCleanupApplied: true,
          eventId: a.event.id,
          anchorDate: a.anchorDate,
        })
      }
    } catch (e) {
      if (dbg) {
        console.debug('[tankestrom existing event cluster cleanup]', {
          existingEventClusterCleanupSkipped: true,
          existingEventClusterCleanupReason: 'delete_failed',
          eventId: a.event.id,
          anchorDate: a.anchorDate,
          error: String(e),
        })
      }
    }
  }

  if (dbg && toDelete.length === 0) {
    console.debug('[tankestrom existing event cluster cleanup]', {
      existingEventClusterCleanupSkipped: true,
      existingEventClusterCleanupReason: 'no_eligible_parallel_rows',
    })
  }

  return { deletedIds, deletedAnchors }
}
