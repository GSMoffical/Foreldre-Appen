import type { EmbeddedScheduleSegment } from '../types'
import type { PortalEventProposal, PortalProposalItem } from '../features/tankestrom/types'
import { normalizeImportTime } from './tankestromImportTime'
import { parseEmbeddedScheduleFromMetadata } from './embeddedSchedule'

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

function segKey(s: EmbeddedScheduleSegment): string {
  return [s.date, s.start ?? '', s.end ?? '', s.title.trim().toLocaleLowerCase('nb-NO')].join('|')
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
    const merged = [...fromParent, ...fromChild]
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date))
      .reduce<EmbeddedScheduleSegment[]>((acc, seg) => {
        if (acc.some((x) => segKey(x) === segKey(seg))) return acc
        acc.push(seg)
        return acc
      }, [])
      .sort((a, b) => (a.date === b.date ? (a.start ?? '').localeCompare(b.start ?? '') : a.date.localeCompare(b.date)))
    if (merged.length === 0) continue
    const withMeta: Record<string, unknown> = {
      ...pMeta,
      isArrangementParent: true,
      embeddedSchedule: merged,
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
