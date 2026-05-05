import type { PortalEventProposal, PortalProposalItem, PortalTaskProposal } from '../features/tankestrom/types'
import { normalizeImportTime } from './tankestromImportTime'

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

const DATE_KEY_FLIGHT = /^\d{4}-\d{2}-\d{2}$/

/** Kort månedsforkortelse / månedsnavn som ofte forveksles med flyrute (JUN–JUN osv.). */
const FLIGHT_ROUTE_MONTH_LIKE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\b/i

function normFlightStr(s: string): string {
  return s.trim().toLocaleLowerCase('nb-NO').replace(/\s+/g, ' ')
}

function normFlightNumber(s: string): string {
  return normFlightStr(s).replace(/\s+/g, '')
}

function sourceBucketKey(ev: PortalEventProposal): string {
  const sid = (ev.sourceId ?? '').trim()
  const ost = (ev.originalSourceType ?? '').trim()
  return sid || ost
}

function looksLikeDateToken(s: string): boolean {
  const t = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return true
  if (/^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(t)) return true
  if (/^\d{1,2}\s+[a-zæøå]{3,}/i.test(t)) return true
  return false
}

function routeSegmentLooksBogus(seg: string): boolean {
  if (!seg.trim()) return true
  if (FLIGHT_ROUTE_MONTH_LIKE.test(seg)) return true
  if (/^\d+$/.test(seg.trim())) return true
  if (looksLikeDateToken(seg)) return true
  return false
}

function isLikelyIataCode(s: string): boolean {
  return /^[A-ZÆØÅ]{3}$/i.test(s.trim())
}

/**
 * Velger trygg visnings-route fra travel-metadata når origin/destination er støy.
 */
export function defensiveFlightEndpoints(travel: Record<string, unknown>): { origin: string; destination: string } {
  const rawO = String(travel.origin ?? travel.from ?? travel.departureAirport ?? '').trim()
  const rawD = String(travel.destination ?? travel.to ?? travel.arrivalAirport ?? '').trim()
  const cityO = String(travel.originCity ?? travel.fromCity ?? '').trim()
  const cityD = String(travel.destinationCity ?? travel.toCity ?? '').trim()

  const sameRaw = rawO.length > 0 && normFlightStr(rawO) === normFlightStr(rawD)
  const bogus = routeSegmentLooksBogus(rawO) || routeSegmentLooksBogus(rawD) || sameRaw

  if (bogus) {
    if (cityO && cityD && normFlightStr(cityO) !== normFlightStr(cityD)) {
      return { origin: cityO, destination: cityD }
    }
    if (isLikelyIataCode(rawO) && isLikelyIataCode(rawD) && !sameRaw) {
      return { origin: rawO.toUpperCase(), destination: rawD.toUpperCase() }
    }
    if (cityD) {
      return { origin: '', destination: cityD }
    }
    if (isLikelyIataCode(rawD)) {
      return { origin: '', destination: rawD.toUpperCase() }
    }
    return { origin: '', destination: '' }
  }

  let o = rawO
  let d = rawD
  if (isLikelyIataCode(rawO)) o = rawO.toUpperCase()
  if (isLikelyIataCode(rawD)) d = rawD.toUpperCase()
  return { origin: o, destination: d }
}

/** Kalendertittel fra travel med defensiv route (by/IATA/«til by»). */
export function buildFlightTitleFromTravel(travel: Record<string, unknown>): string {
  const { origin, destination } = defensiveFlightEndpoints(travel)
  if (origin && destination) return `Flyreise ${origin}–${destination}`
  if (destination) return `Flyreise til ${destination}`
  if (origin) return `Flyreise fra ${origin}`
  return 'Flyreise'
}

function flightTitleOrRouteNeedsDefensiveRebuild(title: string, travel: Record<string, unknown>): boolean {
  const rawO = String(travel.origin ?? travel.from ?? travel.departureAirport ?? '').trim()
  const rawD = String(travel.destination ?? travel.to ?? travel.arrivalAirport ?? '').trim()
  if (routeSegmentLooksBogus(rawO) || routeSegmentLooksBogus(rawD)) return true
  if (rawO && rawD && normFlightStr(rawO) === normFlightStr(rawD)) return true

  const tl = title.trim()
  const m = tl.match(/^flyreise\s+(.+?)\s*[–—-]\s*(.+)$/i)
  if (m) {
    const left = m[1]!.trim()
    const right = m[2]!.trim()
    if (FLIGHT_ROUTE_MONTH_LIKE.test(left) && FLIGHT_ROUTE_MONTH_LIKE.test(right)) return true
    if (/^\d+$/.test(left) && /^\d+$/.test(right)) return true
    if (looksLikeDateToken(left) || looksLikeDateToken(right)) return true
    if (normFlightStr(left) === normFlightStr(right)) return true
  }
  return false
}

function readTravelRecord(ev: PortalEventProposal): Record<string, unknown> | null {
  const m = ev.event.metadata
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null
  const t = (m as Record<string, unknown>).travel
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null
  return t as Record<string, unknown>
}

function passengerMatchKey(ev: PortalEventProposal): string {
  const m = ev.event.metadata as Record<string, unknown> | undefined
  const t = readTravelRecord(ev)
  const fromTravel = t && typeof t.passengerName === 'string' ? t.passengerName : ''
  const fromMeta =
    m && typeof m.documentExtractedPersonName === 'string' ? m.documentExtractedPersonName : ''
  return normFlightStr(fromTravel || fromMeta)
}

function passengerCompatible(a: PortalEventProposal, b: PortalEventProposal): boolean {
  const pa = passengerMatchKey(a)
  const pb = passengerMatchKey(b)
  if (pa && pb && pa !== pb) return false
  return true
}

function applyDefensiveFlightProposalTitles(items: PortalProposalItem[]): PortalProposalItem[] {
  return items.map((item) => {
    if (item.kind !== 'event') return item
    const t = readTravelRecord(item)
    if (!t || String(t.type ?? '').toLowerCase() !== 'flight') return item
    if (!flightTitleOrRouteNeedsDefensiveRebuild(item.event.title, t)) return item
    const title = buildFlightTitleFromTravel(t)
    return {
      ...item,
      event: { ...item.event, title },
    }
  })
}

/** Kalendertittel: «Flyreise Oslo–Bergen» (tankestrek). */
export function buildFlightCalendarTitle(origin: string, destination: string): string {
  const o = origin.trim()
  const d = destination.trim()
  if (!o || !d) return 'Flyreise'
  return `Flyreise ${o}–${d}`
}

function flightPairMatchKey(ev: PortalEventProposal): string | null {
  const t = readTravelRecord(ev)
  if (!t) return null
  if (String(t.type ?? '').toLowerCase() !== 'flight') return null
  const fn = normFlightNumber(String(t.flightNumber ?? t.flight ?? ''))
  const origin = normFlightStr(String(t.origin ?? t.from ?? t.departureAirport ?? ''))
  const dest = normFlightStr(String(t.destination ?? t.to ?? t.arrivalAirport ?? ''))
  const date = ev.event.date.trim()
  if (!fn || !origin || !dest || !DATE_KEY_FLIGHT.test(date)) return null
  const pax = passengerMatchKey(ev)
  return ['fl', fn, origin, dest, date, pax].join('|')
}

type FlightLegKind = 'dep' | 'arr' | 'unknown'

function classifyFlightLeg(ev: PortalEventProposal, travel: Record<string, unknown>): FlightLegKind {
  const depRaw = travel.departureTime ?? travel.departure
  const arrRaw = travel.arrivalTime ?? travel.arrival
  const depT = depRaw !== undefined && depRaw !== null ? normalizeImportTime(String(depRaw)) : null
  const arrT = arrRaw !== undefined && arrRaw !== null ? normalizeImportTime(String(arrRaw)) : null
  const start = ev.event.start?.trim() ? normalizeImportTime(ev.event.start) : null
  if (depT && start === depT) return 'dep'
  if (arrT && start === arrT) return 'arr'
  const title = ev.event.title.toLocaleLowerCase('nb-NO')
  if (/\b(ankomst|landing)\b/.test(title)) return 'arr'
  if (/\b(avreise|avgang|departure)\b/.test(title)) return 'dep'
  return 'unknown'
}

/** Avreise/ankomst ut fra tittel, event.start og travel-tider (tolerer rare API-titler). */
function inferFlightLegKind(ev: PortalEventProposal, travel: Record<string, unknown>): FlightLegKind {
  const k = classifyFlightLeg(ev, travel)
  if (k !== 'unknown') return k
  const depRaw = travel.departureTime ?? travel.departure
  const arrRaw = travel.arrivalTime ?? travel.arrival
  const depT = depRaw !== undefined && depRaw !== null ? normalizeImportTime(String(depRaw)) : null
  const arrT = arrRaw !== undefined && arrRaw !== null ? normalizeImportTime(String(arrRaw)) : null
  const start = ev.event.start?.trim() ? normalizeImportTime(ev.event.start) : null
  if (!start) return 'unknown'
  if (depT && arrT) {
    if (start === depT && start !== arrT) return 'dep'
    if (start === arrT && start !== depT) return 'arr'
    return 'unknown'
  }
  if (depT && start === depT) return 'dep'
  if (arrT && start === arrT) return 'arr'
  return 'unknown'
}

function looseFlightDocumentBucketKey(ev: PortalEventProposal): string | null {
  const t = readTravelRecord(ev)
  if (!t || String(t.type ?? '').toLowerCase() !== 'flight') return null
  const date = ev.event.date.trim()
  if (!DATE_KEY_FLIGHT.test(date)) return null
  const src = sourceBucketKey(ev)
  if (!src) return null
  return `${src}|${date}`
}

function timesAllowDepArrMerge(dep: PortalEventProposal, arr: PortalEventProposal): boolean {
  const depStart = dep.event.start?.trim() ? normalizeImportTime(dep.event.start) : null
  const arrStart = arr.event.start?.trim() ? normalizeImportTime(arr.event.start) : null
  if (!depStart || !arrStart) return false
  if (depStart >= arrStart) return false
  const depEndNorm = dep.event.end?.trim() ? normalizeImportTime(dep.event.end) : null
  if (depEndNorm != null && depEndNorm !== arrStart) return false
  return true
}

function tryPairFlightDepArr(a: PortalEventProposal, b: PortalEventProposal): { dep: PortalEventProposal; arr: PortalEventProposal } | null {
  const ta = readTravelRecord(a)
  const tb = readTravelRecord(b)
  if (!ta || !tb) return null
  if (String(ta.type ?? '').toLowerCase() !== 'flight' || String(tb.type ?? '').toLowerCase() !== 'flight') return null
  const la = inferFlightLegKind(a, ta)
  const lb = inferFlightLegKind(b, tb)
  if (la === 'unknown' || lb === 'unknown' || la === lb) return null
  const dep = la === 'dep' ? a : b
  const arr = la === 'dep' ? b : a
  if (dep.event.date !== arr.event.date) return null
  if (!passengerCompatible(dep, arr)) return null
  if (!timesAllowDepArrMerge(dep, arr)) return null
  return { dep, arr }
}

function performFlightDepArrMerge(dep: PortalEventProposal, arr: PortalEventProposal): PortalEventProposal {
  const depEndNorm = dep.event.end?.trim() ? normalizeImportTime(dep.event.end) : null
  const arrStartNorm = arr.event.start?.trim() ? normalizeImportTime(arr.event.start) : null

  const travelIn = readTravelRecord(dep)!
  const title = buildFlightTitleFromTravel(travelIn)

  let newEnd = dep.event.end?.trim() ?? ''
  if (!depEndNorm && arrStartNorm) {
    newEnd = arrStartNorm
  }

  const meta = cloneEventMetadata(dep.event.metadata)
  const travelOut: Record<string, unknown> = {
    ...travelIn,
    departureArrivalMerged: true,
  }
  meta.travel = travelOut

  const startOk = dep.event.start?.trim() ? normalizeImportTime(dep.event.start) : null
  const endOk = newEnd.trim() ? normalizeImportTime(newEnd) : null
  if (startOk && endOk) {
    delete meta.requiresManualTimeReview
    delete meta.startTimeSource
    delete meta.endTimeSource
    delete meta.inferredEndTime
  }

  return {
    ...dep,
    confidence: Math.max(dep.confidence, arr.confidence),
    event: {
      ...dep.event,
      title,
      end: newEnd,
      metadata: Object.keys(meta).length > 0 ? meta : undefined,
    },
  }
}

function applyStrictFlightPairMerge(items: PortalProposalItem[]): PortalProposalItem[] {
  const events = items.filter((i): i is PortalEventProposal => i.kind === 'event')
  const groups = new Map<string, PortalEventProposal[]>()
  for (const ev of events) {
    const k = flightPairMatchKey(ev)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(ev)
  }

  const removeIds = new Set<string>()
  const mergedByDepId = new Map<string, PortalEventProposal>()

  for (const group of groups.values()) {
    if (group.length !== 2) continue
    const a = group[0]!
    const b = group[1]!
    const ta = readTravelRecord(a)
    const tb = readTravelRecord(b)
    if (!ta || !tb) continue
    const la = inferFlightLegKind(a, ta)
    const lb = inferFlightLegKind(b, tb)
    if (la === 'unknown' || lb === 'unknown') continue
    if (la === lb) continue
    const dep = la === 'dep' ? a : b
    const arr = la === 'dep' ? b : a
    if (!timesAllowDepArrMerge(dep, arr)) continue

    const merged = performFlightDepArrMerge(dep, arr)
    mergedByDepId.set(dep.proposalId, merged)
    removeIds.add(arr.proposalId)
  }

  if (removeIds.size === 0) return items

  const out: PortalProposalItem[] = []
  for (const item of items) {
    if (removeIds.has(item.proposalId)) continue
    if (item.kind === 'event' && mergedByDepId.has(item.proposalId)) {
      out.push(mergedByDepId.get(item.proposalId)!)
      continue
    }
    out.push(item)
  }
  return out
}

function applyLooseFlightPairMerge(items: PortalProposalItem[]): PortalProposalItem[] {
  let current = items
  let guard = 0
  while (guard < 32) {
    guard += 1
    const flightEvents = current.filter((i): i is PortalEventProposal => i.kind === 'event').filter((ev) => {
      const t = readTravelRecord(ev)
      return Boolean(t && String(t.type ?? '').toLowerCase() === 'flight' && looseFlightDocumentBucketKey(ev))
    })

    const byBucket = new Map<string, PortalEventProposal[]>()
    for (const ev of flightEvents) {
      const bk = looseFlightDocumentBucketKey(ev)!
      if (!byBucket.has(bk)) byBucket.set(bk, [])
      byBucket.get(bk)!.push(ev)
    }

    let pair: { dep: PortalEventProposal; arr: PortalEventProposal } | null = null
    outer: for (const group of byBucket.values()) {
      if (group.length < 2) continue
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const p = tryPairFlightDepArr(group[i]!, group[j]!)
          if (p) {
            pair = p
            break outer
          }
        }
      }
    }

    if (!pair) break

    const merged = performFlightDepArrMerge(pair.dep, pair.arr)
    const removeIds = new Set<string>([pair.arr.proposalId])
    const next: PortalProposalItem[] = []
    for (const item of current) {
      if (removeIds.has(item.proposalId)) continue
      if (item.kind === 'event' && item.proposalId === pair.dep.proposalId) {
        next.push(merged)
        continue
      }
      next.push(item)
    }
    current = next
  }
  return current
}

/** Fjerner ankomst-kort som kun gjenspeiler slutttidspunktet til en avreise som allerede finnes. */
function suppressRedundantArrivalFlights(items: PortalProposalItem[]): PortalProposalItem[] {
  const events = items.filter((i): i is PortalEventProposal => i.kind === 'event')
  const remove = new Set<string>()

  for (const cand of events) {
    const tc = readTravelRecord(cand)
    if (!tc || String(tc.type ?? '').toLowerCase() !== 'flight') continue
    if (inferFlightLegKind(cand, tc) !== 'arr') continue
    const arrStart = cand.event.start?.trim() ? normalizeImportTime(cand.event.start) : null
    if (!arrStart) continue
    const candSrc = sourceBucketKey(cand)
    if (!candSrc) continue

    for (const other of events) {
      if (other.proposalId === cand.proposalId) continue
      const to = readTravelRecord(other)
      if (!to || String(to.type ?? '').toLowerCase() !== 'flight') continue
      if (other.event.date !== cand.event.date) continue
      if (sourceBucketKey(other) !== candSrc) continue
      if (!passengerCompatible(cand, other)) continue
      if (inferFlightLegKind(other, to) !== 'dep') continue

      const depEnd = other.event.end?.trim() ? normalizeImportTime(other.event.end) : null
      if (depEnd === arrStart) {
        remove.add(cand.proposalId)
        break
      }

      const arrFromTravel = to.arrivalTime ?? to.arrival
      const arrTn = arrFromTravel != null ? normalizeImportTime(String(arrFromTravel)) : null
      const depStart = other.event.start?.trim() ? normalizeImportTime(other.event.start) : null
      if (depEnd == null && arrTn === arrStart && depStart && depStart < arrStart) {
        remove.add(cand.proposalId)
        break
      }
    }
  }

  if (remove.size === 0) return items
  return items.filter((i) => !remove.has(i.proposalId))
}

function cloneEventMetadata(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {}
  return { ...(meta as Record<string, unknown>) }
}

/**
 * Slår sammen avreise + ankomst for samme flyvning (boarding pass) til én kalenderhendelse.
 * Først nøkkel på flightNumber+rute (streng), deretter samme dokument (sourceId/type + dato) uten flightNumber,
 * deretter fjern overflødige ankomst-kort. Til slutt defensiv flytittel når API sender støy (JUN–JUN osv.).
 */
function mergeFlightDepartureArrivalProposals(items: PortalProposalItem[]): PortalProposalItem[] {
  const afterStrict = applyStrictFlightPairMerge(items)
  const afterLoose = applyLooseFlightPairMerge(afterStrict)
  const afterSuppress = suppressRedundantArrivalFlights(afterLoose)
  return applyDefensiveFlightProposalTitles(afterSuppress)
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
  const afterFlight = mergeFlightDepartureArrivalProposals(items)
  const flightRemoved = before - afterFlight.length
  const { out: pass1, removed: pass1Removed } = dedupeSameCalendarDayAndSlot(afterFlight)
  const { next: pass2, hoisted, hoistLog } = collapseWeekendSharedParentTasks(pass1, 12)

  const dbg = import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true'
  if (dbg) {
    console.debug('[tankestrom review dedupe]', {
      tankestromReviewItemsBefore: before,
      tankestromReviewFlightLegMergedAway: flightRemoved,
      tankestromReviewItemsAfterSemanticDedupe: pass2.length,
      tankestromReviewSemanticDuplicateRemoved: pass1Removed,
      tankestromReviewSharedParentTaskHoisted: hoisted,
      tankestromReviewSharedParentTaskHoistReason: hoistLog,
    })
  }

  return pass2
}
