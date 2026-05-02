import type { PortalProposalItem, PortalTaskProposal } from '../features/tankestrom/types'

/** Enkel «fredag –» etter at lang dato er fjernet. */
const WEEKDAY_TITLE_PREFIX =
  /^(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)\s*[–—\-]\s*/i

/**
 * Lang dato i tittel fra Spond/cup (f.eks. «fredag 12. juni 2026 – …»), med eller uten år.
 */
const NORWEGIAN_TITLE_DATE_PREFIX =
  /^(?:(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)\s+)?\d{1,2}\.\s*[a-zæøå]+(?:\s+\d{4})?\s*[–—\-:]\s*/i

const LABEL_PREFIX = /^(?:notater|frister|frist|nb)\s*:\s*/i

/** Kjerne av tittel for semantisk dedupe (cup-/Spond-varianter med samme budskap). */
export function semanticTitleCore(raw: string): string {
  let t = raw.trim()
  t = t.replace(NORWEGIAN_TITLE_DATE_PREFIX, '')
  for (let i = 0; i < 4; i++) {
    const next = t.replace(LABEL_PREFIX, '').trim()
    if (next === t) break
    t = next
  }
  t = t.replace(WEEKDAY_TITLE_PREFIX, '')
  return t.toLocaleLowerCase('nb-NO').replace(/\s+/g, ' ').trim()
}

/** Fjerner første «Fra: …»-linje og etiketter som «Frister:» i notat. */
function normalizeNotesForDedupe(notes?: string): string {
  const raw = (notes ?? '').replace(/\r\n/g, '\n').trim()
  let body = raw
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length > 0 && /^fra:\s*/i.test(lines[0] ?? '')) {
    body = lines.slice(1).join('\n').trim()
  }
  body = body.replace(/^(?:frister|notater|frist|nb)\s*:\s*/i, '').trim()
  const t = body.toLocaleLowerCase('nb-NO').replace(/\s+/g, ' ')
  return t.length > 100 ? t.slice(0, 100) : t
}

function dedupeKeyForCalendarItem(item: PortalProposalItem): string | null {
  if (item.kind === 'school_profile') return null
  if (item.kind === 'event') {
    const e = item.event
    const start = e.start.length > 5 ? e.start.slice(0, 5) : e.start
    return [
      'e',
      e.date,
      start,
      e.personId,
      semanticTitleCore(e.title),
      normalizeNotesForDedupe(e.notes),
    ].join('|')
  }
  const t = item.task
  const due = (t.dueTime ?? '').trim().slice(0, 5)
  return [
    't',
    t.date,
    due,
    t.childPersonId ?? '',
    t.assignedToPersonId ?? '',
    semanticTitleCore(t.title),
    normalizeNotesForDedupe(t.notes),
  ].join('|')
}

function isFriSatOrSun(isoDate: string): boolean {
  const w = new Date(`${isoDate}T12:00:00`).getDay()
  return w === 0 || w === 5 || w === 6
}

function calendarDaySpan(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = [...new Set(dates)].sort()
  const first = new Date(`${sorted[0]!}T12:00:00`).getTime()
  const last = new Date(`${sorted[sorted.length - 1]!}T12:00:00`).getTime()
  return Math.round((last - first) / 86400000)
}

/** Nøkkel uten dato: samme foreldreoppgave på flere cup-dager. */
function weekendSharedTaskGroupKey(item: PortalTaskProposal): string {
  const t = item.task
  const due = (t.dueTime ?? '').trim().slice(0, 5)
  return [
    t.childPersonId ?? '',
    t.assignedToPersonId ?? '',
    due,
    semanticTitleCore(t.title),
    normalizeNotesForDedupe(t.notes),
  ].join('|')
}

function pickPreferredTaskProposal(group: PortalTaskProposal[]): PortalTaskProposal {
  const sorted = [...group].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return a.task.date.localeCompare(b.task.date)
  })
  return sorted[0]!
}

type HoistLogEntry = { keptProposalId: string; removedProposalIds: string[]; dates: string[]; reason: string }

/**
 * Slår sammen gjøremål som er identiske i innhold på inntil tre påfølgende cup-dager (fre–søn),
 * når alle forekomster er fre/lør/søn og spennet er maks 2 dager. Beholder beste confidence, deretter tidligste dato.
 */
function collapseWeekendSharedParentTasks(
  items: PortalProposalItem[],
  minTitleCoreLen: number
): { next: PortalProposalItem[]; hoisted: number; hoistLog: HoistLogEntry[] } {
  const tasks = items.filter((i): i is PortalTaskProposal => i.kind === 'task')
  const groups = new Map<string, PortalTaskProposal[]>()
  for (const t of tasks) {
    const core = semanticTitleCore(t.task.title)
    if (core.length < minTitleCoreLen) continue
    const k = weekendSharedTaskGroupKey(t)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(t)
  }

  const removeIds = new Set<string>()
  const hoistLog: HoistLogEntry[] = []

  for (const group of groups.values()) {
    if (group.length < 2) continue
    const dates = [...new Set(group.map((g) => g.task.date))]
    if (dates.length < 2) continue
    if (!dates.every(isFriSatOrSun)) continue
    if (calendarDaySpan(dates) > 2) continue

    const winner = pickPreferredTaskProposal(group)
    const removed: string[] = []
    for (const g of group) {
      if (g.proposalId !== winner.proposalId) {
        removeIds.add(g.proposalId)
        removed.push(g.proposalId)
      }
    }
    if (removed.length > 0) {
      hoistLog.push({
        keptProposalId: winner.proposalId,
        removedProposalIds: removed,
        dates: dates.sort(),
        reason: `Helge-cup: samme foreldreoppgave på ${dates.length} dager (spenn ${calendarDaySpan(dates)}), beholdt ${winner.task.date}`,
      })
    }
  }

  const next = items.filter((i) => !removeIds.has(i.proposalId))
  return { next, hoisted: removeIds.size, hoistLog }
}

/** Pass 1: eksakt nøkkel-match (nå med semantisk tittel). */
function dedupeSameCalendarDayAndSlot(items: PortalProposalItem[]): {
  out: PortalProposalItem[]
  removed: number
} {
  const seen = new Set<string>()
  const out: PortalProposalItem[] = []
  let removed = 0
  for (const item of items) {
    if (item.kind === 'school_profile') {
      out.push(item)
      continue
    }
    const key = dedupeKeyForCalendarItem(item)
    if (!key || seen.has(key)) {
      removed += 1
      continue
    }
    seen.add(key)
    out.push(item)
  }
  return { out, removed }
}

/**
 * Slår sammen åpenbare duplikater (semantisk lik tittel/notat) og løfter helgebrede foreldreoppgaver
 * til ett kort når det er trygt (kun fre/lør/søn, spenn ≤ 2 dager, samme innhold).
 */
export function dedupeNearDuplicateCalendarProposals(items: PortalProposalItem[]): PortalProposalItem[] {
  const before = items.length
  const { out: pass1, removed: pass1Removed } = dedupeSameCalendarDayAndSlot(items)
  const { next: pass2, hoisted, hoistLog } = collapseWeekendSharedParentTasks(pass1, 12)

  const dbg = import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true'
  if (dbg) {
    console.debug('[tankestrom review dedupe]', {
      tankestromReviewItemsBefore: before,
      tankestromReviewItemsAfterSemanticDedupe: pass2.length,
      tankestromReviewSemanticDuplicateRemoved: pass1Removed,
      tankestromReviewSharedParentTaskHoisted: hoisted,
      tankestromReviewSharedParentTaskHoistReason: hoistLog,
    })
  }

  return pass2
}
