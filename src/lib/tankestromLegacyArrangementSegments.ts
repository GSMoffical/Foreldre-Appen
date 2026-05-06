import type { EmbeddedScheduleSegment } from '../types'
import type { PortalEventProposal, PortalProposalItem } from '../features/tankestrom/types'
import { normalizeImportTime } from './tankestromImportTime'
import { parseEmbeddedScheduleFromMetadata } from './embeddedSchedule'
import { semanticTitleCore } from './tankestromImportDedupe'

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null
}

function readStr(meta: Record<string, unknown> | null, key: string): string {
  if (!meta) return ''
  const v = meta[key]
  return typeof v === 'string' ? v.trim() : ''
}

function normalizeChildSegmentFromEvent(child: PortalEventProposal): EmbeddedScheduleSegment {
  const meta = asRecord(child.event.metadata)
  const rawTitle = child.event.title.trim()
  const title = rawTitle || readStr(meta, 'segmentTitle') || 'Program'
  const start = normalizeImportTime(child.event.start)
  const end = normalizeImportTime(child.event.end)
  const seg: EmbeddedScheduleSegment = {
    date: child.event.date,
    title,
  }
  if (start) seg.start = start
  if (end) seg.end = end
  const notes = child.event.notes?.trim()
  if (notes) seg.notes = notes
  if (meta?.isConditional === true) seg.isConditional = true
  return seg
}

function normalizeSegmentTitle(s: EmbeddedScheduleSegment): string {
  const title = s.title?.trim() || s.notes?.trim() || ''
  const core = semanticTitleCore(title)
  return core || title.toLocaleLowerCase('nb-NO')
}

function normalizeSegTime(input: string | undefined): string {
  if (!input) return ''
  return normalizeImportTime(input) || ''
}

function embeddedSegmentKey(
  segment: EmbeddedScheduleSegment,
  parentArrangementStableKey: string,
  arrangementBlockGroupId: string
): string {
  return [
    parentArrangementStableKey || arrangementBlockGroupId || '',
    segment.date ?? '',
    normalizeSegTime(segment.start),
    normalizeSegmentTitle(segment),
  ].join('|')
}

function mergeUniqueLines(a?: string, b?: string): string | undefined {
  const lines = `${a ?? ''}\n${b ?? ''}`
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
  if (lines.length === 0) return undefined
  const out: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const k = line.toLocaleLowerCase('nb-NO')
    if (seen.has(k)) continue
    seen.add(k)
    out.push(line)
  }
  return out.join('\n')
}

function mergeSegmentDetails(a: EmbeddedScheduleSegment, b: EmbeddedScheduleSegment): EmbeddedScheduleSegment {
  const merged: EmbeddedScheduleSegment = {
    date: a.date || b.date,
    title: a.title?.trim() || b.title?.trim() || 'Program',
  }
  const start = normalizeSegTime(a.start) || normalizeSegTime(b.start)
  const end = normalizeSegTime(a.end) || normalizeSegTime(b.end)
  if (start) merged.start = start
  if (end) merged.end = end
  const notes = mergeUniqueLines(a.notes, b.notes)
  if (notes) merged.notes = notes
  if (a.kind || b.kind) merged.kind = a.kind || b.kind
  if (a.isConditional || b.isConditional) merged.isConditional = true
  return merged
}

export function dedupeEmbeddedScheduleSegments(
  segments: EmbeddedScheduleSegment[],
  keys?: { parentArrangementStableKey?: string; arrangementBlockGroupId?: string }
): EmbeddedScheduleSegment[] {
  const stable = (keys?.parentArrangementStableKey ?? '').trim()
  const group = (keys?.arrangementBlockGroupId ?? '').trim()
  const byKey = new Map<string, EmbeddedScheduleSegment>()
  for (const segment of segments) {
    const k = embeddedSegmentKey(segment, stable, group)
    const prev = byKey.get(k)
    if (!prev) {
      const looseMatchKey = [...byKey.keys()].find((existingKey) => {
        const ex = byKey.get(existingKey)
        if (!ex) return false
        if (ex.date !== segment.date) return false
        if (normalizeSegmentTitle(ex) !== normalizeSegmentTitle(segment)) return false
        const a = normalizeSegTime(ex.start)
        const b = normalizeSegTime(segment.start)
        return a === b || !a || !b
      })
      if (looseMatchKey) {
        byKey.set(looseMatchKey, mergeSegmentDetails(byKey.get(looseMatchKey)!, segment))
      } else {
        byKey.set(k, segment)
      }
      continue
    }
    byKey.set(k, mergeSegmentDetails(prev, segment))
  }
  return [...byKey.values()].sort((a, b) =>
    a.date === b.date
      ? `${normalizeSegTime(a.start)}|${normalizeSegTime(a.end)}|${a.title}`.localeCompare(
          `${normalizeSegTime(b.start)}|${normalizeSegTime(b.end)}|${b.title}`,
          'nb-NO'
        )
      : a.date.localeCompare(b.date)
  )
}

function parentLikeEvent(ev: PortalEventProposal): boolean {
  const meta = asRecord(ev.event.metadata)
  if (meta?.isArrangementParent === true) return true
  const flat = parseEmbeddedScheduleFromMetadata(meta as Record<string, unknown> | undefined)
  const days = new Set(flat.map((s) => s.date))
  return days.size >= 2
}

function childLikeEvent(ev: PortalEventProposal): boolean {
  const meta = asRecord(ev.event.metadata)
  if (!meta) return false
  if (meta.isArrangementChild === true) return true
  return readStr(meta, 'parentArrangementStableKey').length > 0
}

function parentKeyStable(ev: PortalEventProposal): string {
  const meta = asRecord(ev.event.metadata)
  return readStr(meta, 'arrangementStableKey')
}

function parentKeyGroup(ev: PortalEventProposal): string {
  const meta = asRecord(ev.event.metadata)
  return readStr(meta, 'arrangementBlockGroupId') || readStr(meta, 'blockGroupId')
}

export function foldLegacyArrangementChildSegments(items: PortalProposalItem[]): PortalProposalItem[] {
  const events = items.filter((i): i is PortalEventProposal => i.kind === 'event')
  const parents = events.filter(parentLikeEvent)
  const children = events.filter(childLikeEvent)
  if (parents.length === 0 || children.length === 0) return items

  const byStable = new Map<string, PortalEventProposal>()
  const byGroup = new Map<string, PortalEventProposal>()
  for (const p of parents) {
    const s = parentKeyStable(p)
    const g = parentKeyGroup(p)
    if (s) byStable.set(s, p)
    if (g) byGroup.set(g, p)
  }

  const childByParentId = new Map<string, PortalEventProposal[]>()
  const childRemove = new Set<string>()
  for (const c of children) {
    const meta = asRecord(c.event.metadata)
    const stable = readStr(meta, 'parentArrangementStableKey')
    const group = readStr(meta, 'arrangementBlockGroupId') || readStr(meta, 'blockGroupId')
    const parent = (stable && byStable.get(stable)) || (group && byGroup.get(group))
    if (!parent) continue
    if (!childByParentId.has(parent.proposalId)) childByParentId.set(parent.proposalId, [])
    childByParentId.get(parent.proposalId)!.push(c)
    childRemove.add(c.proposalId)
  }

  if (childByParentId.size === 0) return items

  const parentPatched = new Map<string, PortalEventProposal>()
  for (const p of parents) {
    const kids = childByParentId.get(p.proposalId)
    if (!kids || kids.length === 0) continue
    const pMeta = asRecord(p.event.metadata) ?? {}
    const fromParent = parseEmbeddedScheduleFromMetadata(pMeta)
    const fromChild = kids.map(normalizeChildSegmentFromEvent)
    const mergedRaw = [...fromParent, ...fromChild].filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date))
    const merged = dedupeEmbeddedScheduleSegments(mergedRaw, {
      parentArrangementStableKey: parentKeyStable(p),
      arrangementBlockGroupId: parentKeyGroup(p),
    })
    if (merged.length === 0) continue
    const withMeta: Record<string, unknown> = {
      ...pMeta,
      isArrangementParent: true,
      embeddedSchedule: merged,
      embeddedScheduleRawCount: mergedRaw.length,
      embeddedScheduleDedupedCount: merged.length,
      childSegmentsFoldedCount: kids.length,
      childSource: 'legacy',
    }
    const parentGroup = parentKeyGroup(p)
    if (!readStr(withMeta, 'arrangementBlockGroupId') && parentGroup) {
      withMeta.arrangementBlockGroupId = parentGroup
    }
    parentPatched.set(p.proposalId, {
      ...p,
      event: {
        ...p.event,
        metadata: withMeta,
      },
    })
  }

  if (parentPatched.size === 0) return items

  const out: PortalProposalItem[] = []
  for (const it of items) {
    if (childRemove.has(it.proposalId)) continue
    if (it.kind === 'event' && parentPatched.has(it.proposalId)) {
      out.push(parentPatched.get(it.proposalId)!)
      continue
    }
    out.push(it)
  }
  return out
}
