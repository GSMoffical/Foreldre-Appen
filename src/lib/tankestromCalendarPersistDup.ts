/**
 * Dedupe og idempotent matching for Tankestrøm-persist (samme programblokk / reimport).
 */

import type { Event, EventMetadata, PersonId } from '../types'
import { isForegroundEvent } from './eventLayer'
import { getEventParticipantIds } from './schedule'

export function tankestromNormalizeImportTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().toLowerCase()
}

function readIntegrationProposalId(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  const integration = (meta as Record<string, unknown>).integration
  if (!integration || typeof integration !== 'object' || Array.isArray(integration)) return undefined
  const pid = (integration as Record<string, unknown>).proposalId
  return typeof pid === 'string' ? pid : undefined
}

export type TankestromPersistDupQuery = {
  date: string
  start: string
  end: string
  title: string
  personId: PersonId | null
  metadata?: EventMetadata | Record<string, unknown> | null
}

export function tankestromPersistFingerprint(q: TankestromPersistDupQuery): string {
  const meta =
    q.metadata && typeof q.metadata === 'object' && !Array.isArray(q.metadata)
      ? (q.metadata as Record<string, unknown>)
      : {}
  const block = typeof meta.arrangementBlockGroupId === 'string' ? meta.arrangementBlockGroupId.trim() : ''
  const stable = typeof meta.parentArrangementStableKey === 'string' ? meta.parentArrangementStableKey.trim() : ''
  const childIdx =
    typeof meta.detachedEmbeddedOrigIndex === 'number' && Number.isFinite(meta.detachedEmbeddedOrigIndex)
      ? String(meta.detachedEmbeddedOrigIndex)
      : ''
  const tp = typeof meta.timePrecision === 'string' ? meta.timePrecision : 'timed'
  const pids = getEventParticipantIds({
    id: '__dup__',
    personId: q.personId,
    title: '',
    start: q.start,
    end: q.end,
    metadata: q.metadata as EventMetadata | undefined,
  } as Event)
    .slice()
    .sort()
    .join('|')
  const title = tankestromNormalizeImportTitle(q.title)
  const start = q.start.trim().slice(0, 5)
  const end = q.end.trim().slice(0, 5)

  if (stable && childIdx !== '') {
    return `S:${stable}|c:${childIdx}|d:${q.date}|t:${title}|p:${pids}`
  }
  if (block) {
    return `B:${block}|d:${q.date}|s:${start}|e:${end}|tp:${tp}|t:${title}|p:${pids}`
  }
  return `X:d:${q.date}|s:${start}|e:${end}|tp:${tp}|t:${title}|p:${pids}`
}

export function findTankestromPersistDuplicateInAnchors(
  anchors: ReadonlyArray<{ event: Event; anchorDate: string }>,
  q: TankestromPersistDupQuery,
  proposalIdForIntegrationMatch?: string
): { event: Event; anchorDate: string } | null {
  if (proposalIdForIntegrationMatch) {
    for (const a of anchors) {
      if (a.anchorDate !== q.date || !isForegroundEvent(a.event)) continue
      const pid = readIntegrationProposalId(a.event.metadata)
      if (pid && pid === proposalIdForIntegrationMatch) return a
    }
  }

  const want = tankestromPersistFingerprint(q)
  for (const a of anchors) {
    if (a.anchorDate !== q.date || !isForegroundEvent(a.event)) continue
    const cand = tankestromPersistFingerprint({
      date: q.date,
      start: a.event.start,
      end: a.event.end,
      title: a.event.title,
      personId: a.event.personId,
      metadata: a.event.metadata,
    })
    if (cand === want) return a
  }
  return null
}

export function mergeNotesPreferNonEmpty(a: string | undefined, b: string | undefined): string | undefined {
  const t1 = (a ?? '').trim()
  const t2 = (b ?? '').trim()
  if (!t1) return t2 || undefined
  if (!t2) return t1 || undefined
  if (t1.includes(t2)) return t1
  if (t2.includes(t1)) return t2
  return `${t1}\n\n${t2}`
}

export function buildTankestromIdempotentEventUpdate(existing: Event, input: Omit<Event, 'id'>): Partial<Event> {
  const exMeta =
    existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
      ? { ...(existing.metadata as Record<string, unknown>) }
      : {}
  const inMeta =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? { ...(input.metadata as Record<string, unknown>) }
      : {}
  const mergedMeta = { ...exMeta, ...inMeta }
  return {
    title: input.title,
    start: input.start,
    end: input.end,
    personId: input.personId,
    location: input.location,
    reminderMinutes: input.reminderMinutes,
    notes: mergeNotesPreferNonEmpty(existing.notes, input.notes),
    metadata: mergedMeta as EventMetadata,
  }
}
