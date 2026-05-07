import type {
  EventMetadata,
  TankestromScheduleHighlight,
  TankestromScheduleHighlightType,
  TankestromTimeWindowSummary,
} from '../types'

function normalizeTextKey(value: string): string {
  return value
    .toLocaleLowerCase('nb-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export type NormalizedTankestromScheduleDetails = {
  highlights: TankestromScheduleHighlight[]
  bringItems: string[]
  notes: string[]
  timeWindowSummaries: TankestromTimeWindowSummary[]
  removedFragments: string[]
  removedDuplicateHighlights: number
  removedHighlights: string[]
  liftedBringItems: string[]
}

function parseHighlightType(input: unknown): TankestromScheduleHighlightType {
  if (input === 'match' || input === 'meeting' || input === 'deadline' || input === 'note') return input
  return 'other'
}

function normalizeHighlightRow(input: unknown): TankestromScheduleHighlight | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const row = input as Record<string, unknown>
  const timeRaw = typeof row.time === 'string' ? row.time.trim() : ''
  const labelRaw = typeof row.label === 'string' ? row.label.trim() : ''
  if (!timeRaw || !labelRaw) return null
  return {
    time: timeRaw.slice(0, 5),
    label: labelRaw,
    type: parseHighlightType(row.type),
  }
}

function inferTypeFromLabel(label: string): TankestromScheduleHighlightType {
  const key = normalizeTextKey(label)
  if (key.includes('kamp') || key.includes('match')) return 'match'
  if (key.includes('oppmote') || key.includes('mote')) return 'meeting'
  if (key.includes('frist') || key.includes('deadline')) return 'deadline'
  if (key.includes('notat') || key.includes('husk')) return 'note'
  return 'other'
}

function normalizeNotes(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((line) => (typeof line === 'string' ? line.trim() : ''))
    .filter((line) => line.length > 0)
}

function normalizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((line) => (typeof line === 'string' ? line.trim() : ''))
    .filter((line) => line.length > 0)
}

function detailsDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true'
}

function normalizeBringItem(item: string): string {
  return item
    .replace(/^[•\-\*\u2022]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normaliser til semantisk nøkkel for dedupe (gjerne/husk/ta med, t-skjorte-varianter). */
export function semanticBringKey(raw: string): string {
  let s = normalizeBringItem(raw)
  s = s.replace(/^(gjerne|vennligst|husk|ta med|ta)\s+/gi, '')
  s = s.replace(/\s+/g, ' ').trim()
  let k = normalizeTextKey(s)
  k = k.replace(/\bt\s*skjorte\b/g, 't skjorte')
  k = k.replace(/\bekstra\s*t\s*skjorte\b/g, 'ekstra t skjorte')
  k = k.replace(/\bekstra\s*t\s*skjorte\b/g, 'ekstra t skjorte')
  return k
}

function canonicalBringDisplayForKey(key: string, raw: string): string {
  if (key.includes('ekstra') && key.includes('skjorte')) return 'ekstra t-skjorte'
  const t = normalizeBringItem(raw)
  if (key === 'handkle' || key === 'hndkle') return 'håndkle'
  return t || raw
}

function dedupeBringItemsList(items: string[]): string[] {
  const map = new Map<string, string>()
  for (const raw of items) {
    const trimmed = normalizeBringItem(raw)
    if (!trimmed) continue
    const key = semanticBringKey(trimmed)
    if (!key || key === 'husk ta med') continue
    const display = canonicalBringDisplayForKey(key, trimmed)
    const prev = map.get(key)
    if (!prev || display.length < prev.length) map.set(key, display)
  }
  return [...map.values()]
}

function looksLikeStructuredFallbackBlob(text: string): boolean {
  const hasHp = /høydepunkter\s*:/i.test(text)
  const hasHusk = /\bhusk\s*:/i.test(text) || /husk\s*\/\s*ta med/i.test(text)
  const hasNot = /\bnotater\s*:/i.test(text)
  const hasDagens = /dagens innhold/i.test(text)
  const markerCount = [hasHp, hasHusk, hasNot, hasDagens].filter(Boolean).length
  return markerCount >= 2 || (hasHp && text.length > 100)
}

function hasStructureMarkersLine(line: string): boolean {
  return (
    /høydepunkter\s*:/i.test(line) ||
    /\bhusk\s*:/i.test(line) ||
    /husk\s*\/\s*ta med/i.test(line) ||
    /\bnotater\s*:/i.test(line) ||
    /dagens innhold/i.test(line)
  )
}

function expandNoteLines(notes: string[]): string[] {
  const out: string[] = []
  for (const n of notes) {
    const parts = n.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    if (parts.length > 1) out.push(...parts)
    else out.push(n)
  }
  return out
}

function isEquipmentListLine(line: string): boolean {
  const t = line.trim()
  if (t.length < 8) return false
  if (!/[,:;]/.test(t) && !/\s+og\s+/i.test(t)) return false
  const k = normalizeTextKey(t)
  if (/\b(spist|prat|kommentar|notat|mellom kamp|barna)\b/.test(k)) return false
  const chunks = t.split(/[,;]|(?:\s+og\s+)/i).map((c) => normalizeBringItem(c)).filter(Boolean)
  if (chunks.length < 2) return false
  return chunks.every((c) => {
    const ck = normalizeTextKey(c)
    return ck.length <= 40 && !/\b(søndag|fredag|kamp|klokken)\b/.test(ck)
  })
}

function splitEquipmentListLine(line: string): string[] {
  return line
    .split(/[,;]|(?:\s+og\s+)/i)
    .map((c) => normalizeBringItem(c))
    .filter(Boolean)
}

function isLikelyBringToken(chunk: string): boolean {
  const k = normalizeTextKey(chunk)
  if (!k || k.length <= 1) return false
  if (k === 'husk ta med') return false
  if (k.includes('overtrekk')) return true
  if (/^(matpakke|drikkeflaske|innesko|handkle|hndkle|sokker|skjorte|ekstra t skjorte|ekstra t)$/.test(k))
    return true
  if (k.startsWith('gjerne ekstra t')) return true
  if (k.startsWith('ta med ') || k.startsWith('husk ')) return true
  if (k.length <= 18 && !/\b(skolen|kampen|møte|prat|spist)\b/.test(k)) return true
  return false
}

function isLikelyBringItem(line: string): boolean {
  const k = normalizeTextKey(line)
  if (!k) return false
  if (k.length <= 2) return false
  if (k === 'husk ta med') return false
  if (k.includes('overtrekk')) return true
  if (/^(matpakke|drikkeflaske|innesko|handkle|hndkle|sokker|skjorte|ekstra t skjorte|ekstra t)$/.test(k))
    return true
  if (k.startsWith('gjerne ekstra t')) return true
  if (k.startsWith('ta med ') || k.startsWith('husk ')) return true
  return false
}

function isJunkNoteFragment(line: string): boolean {
  const trimmed = line.trim()
  const k = normalizeTextKey(trimmed)
  if (!k) return true
  if (k === 'dagens innhold' || k === 'husk ta med' || k === 'husk' || k === 'og') return true
  if (/^-\s*spist litt\.?$/i.test(trimmed)) return true
  if (/^-\s*kort prat\b/i.test(trimmed)) return true
  if (/^-\s*noe lett å spise/i.test(trimmed)) return true
  if (/skriv det i kommentarfeltet/i.test(trimmed)) return true
  if (/^i\s+[a-z0-9æøå ]+$/i.test(trimmed)) return true
  if (/^i\s+(bekkestua skolehall|nadderud arena)$/i.test(trimmed)) return true
  if (k.length <= 2) return true
  if (/^-\s*[a-zæøå]{1,4}\.?$/i.test(trimmed) && k.length <= 5) return true
  return false
}

function looksLikeTitleOnlyHighlight(label: string, titleContext: string[]): boolean {
  const lk = normalizeTextKey(label)
  if (!lk) return true
  return titleContext.some((t) => {
    const tk = normalizeTextKey(t)
    return tk.length > 0 && (lk === tk || lk.includes(tk))
  })
}

function classifyHighlightLabel(label: string): string {
  const key = normalizeTextKey(label)
  if (key.includes('kamp')) return 'kamp'
  if (key.includes('oppmote') || key.includes('mote')) return 'oppmote'
  return key
}

function cleanHighlightLabel(label: string): { label: string; location?: string } {
  const trimmed = label.trim()
  const withLocation = /^i\s+([^;]+);\s*(.+)$/i.exec(trimmed)
  if (withLocation) {
    return { location: withLocation[1]!.trim(), label: withLocation[2]!.trim() }
  }
  return { label: trimmed }
}

const PRACTICAL_HIGHLIGHT_RE =
  /ta gjerne med|gjerne med (ekstra|stor)|skriv det|kommentarfelt|kommentarfeltet|ta med (ekstra stor)? bag|kjølebag/i

function isInstructionalOrPracticalHighlight(label: string): boolean {
  if (PRACTICAL_HIGHLIGHT_RE.test(label)) return true
  const k = normalizeTextKey(label)
  if (k.length <= 1) return true
  if (/\bhusk\s*:/.test(label) || /\bhusk å ta med\b/i.test(label)) return true
  if (/\bhusk\b/.test(k) && (k.includes('med') || k.includes('ta'))) return true
  if (/^ved\s+[a-z]-/.test(k.replace(/\s+/g, ' '))) return false
  return false
}

function isTimeOnlyOrConnectorHighlight(label: string): boolean {
  const t = label.trim()
  const k = normalizeTextKey(t)
  if (k === 'og') return false
  if (/^mellom\.?$/i.test(t)) return true
  if (/^\d{1,2}:\d{2}(\s*[-–]\s*\d{1,2}:\d{2})?$/i.test(t)) return true
  return false
}

function filterHighlightForDisplay(
  h: TankestromScheduleHighlight,
  titleContext: string[],
  removedHighlights: string[]
): TankestromScheduleHighlight | null {
  const cleaned = cleanHighlightLabel(h.label)
  const label = cleaned.label
  if (!label) return null
  const nk = normalizeTextKey(label)
  if (nk === 'og') {
    return { ...h, label, type: h.type ?? 'other' }
  }
  if (isTimeOnlyOrConnectorHighlight(label)) return null
  if (looksLikeTitleOnlyHighlight(label, titleContext)) {
    removedHighlights.push(`${h.time} ${label}`)
    return null
  }
  if (isInstructionalOrPracticalHighlight(label)) {
    removedHighlights.push(`${h.time} ${label}`)
    return null
  }
  return {
    ...h,
    label,
    type: h.type ?? inferTypeFromLabel(label),
  }
}

type IndexedH = { h: TankestromScheduleHighlight; idx: number }

function mergeTimeWindowHighlights(
  highlights: TankestromScheduleHighlight[]
): { rest: TankestromScheduleHighlight[]; summaries: TankestromTimeWindowSummary[] } {
  if (highlights.length < 2) return { rest: highlights, summaries: [] }

  const indexed: IndexedH[] = highlights.map((h, idx) => ({ h, idx }))
  indexed.sort((a, b) => {
    const t = a.h.time.localeCompare(b.h.time)
    if (t !== 0) return t
    return a.idx - b.idx
  })

  const consumedIdx = new Set<number>()
  const summaries: TankestromTimeWindowSummary[] = []

  let i = 0
  while (i < indexed.length) {
    const start = indexed[i]!
    const startLab = start.h.label.trim()
    const startKey = normalizeTextKey(startLab)

    const isWindowSeed =
      startKey !== 'og' &&
      (/\bmellom\b/i.test(startLab) ||
        (/\bsluttspill\b/i.test(startLab) && startLab.length > 12))

    if (!isWindowSeed) {
      i += 1
      continue
    }

    const block: IndexedH[] = [start]
    let j = i + 1
    while (j < indexed.length) {
      const cur = indexed[j]!
      const ck = normalizeTextKey(cur.h.label.trim())
      if (ck === 'og' || cur.h.label.trim() === '') {
        block.push(cur)
        j += 1
        continue
      }
      block.push(cur)
      j += 1
      while (j < indexed.length) {
        const nx = indexed[j]!
        if (normalizeTextKey(nx.h.label.trim()) === 'og') {
          block.push(nx)
          j += 1
          continue
        }
        break
      }
      break
    }

    const nonOg = block.filter((b) => normalizeTextKey(b.h.label.trim()) !== 'og' && b.h.label.trim() !== '')
    const ogCount = block.filter((b) => normalizeTextKey(b.h.label.trim()) === 'og').length
    if (nonOg.length >= 1 && (ogCount >= 1 || nonOg.length >= 2)) {
      const tMin = block[0]!.h.time
      const tMax = block[block.length - 1]!.h.time
      const firstLab = nonOg[0]!.h.label.replace(/\s*mellom\.?\s*$/i, '').trim()
      const lastLab = nonOg.length > 1 ? nonOg[nonOg.length - 1]!.h.label.trim() : ''
      let combined = firstLab
      if (lastLab && normalizeTextKey(lastLab) !== normalizeTextKey(firstLab)) {
        combined = `${firstLab} – ${lastLab}`
      }
      summaries.push({ timeRange: `${tMin}–${tMax}`, label: combined, tentative: false })
      for (const b of block) consumedIdx.add(b.idx)
      i = j
      continue
    }

    i += 1
  }

  const rest = highlights.filter((_, idx) => !consumedIdx.has(idx))
  return { rest, summaries }
}

export function emptyNormalizedTankestromDetails(): NormalizedTankestromScheduleDetails {
  return {
    highlights: [],
    bringItems: [],
    notes: [],
    timeWindowSummaries: [],
    removedFragments: [],
    removedDuplicateHighlights: 0,
    removedHighlights: [],
    liftedBringItems: [],
  }
}

function logCleanupResult(
  rawHighlights: TankestromScheduleHighlight[],
  renderedHighlights: TankestromScheduleHighlight[],
  rawBringItems: string[],
  renderedBringItems: string[],
  rawNotes: string[],
  renderedNotes: string[],
  removedFragments: string[],
  removedHighlights: string[],
  liftedBringItems: string[],
  timeWindowSummaries: TankestromTimeWindowSummary[]
): void {
  if (!detailsDebugEnabled()) return
  console.info('[Tankestrom schedule cleanup result]', {
    rawHighlights,
    renderedHighlights,
    rawBringItems,
    renderedBringItems,
    rawNotes,
    renderedNotes,
    removedFragments,
    removedHighlights,
    liftedBringItems,
    timeWindowSummaries,
  })
}

export function normalizeTankestromScheduleDetails(input: {
  highlights: TankestromScheduleHighlight[]
  notes: string[]
  bringItems?: string[]
  titleContext?: string[]
  timeWindowCandidates?: Array<{ start?: string; end?: string; label?: string; tentative?: boolean }>
  /** Når true, marker vindu som foreløpig (f.eks. betinget sluttspill). */
  tentativeTimeWindow?: boolean
  /** Allerede lagret etter forrige normalisering — ikke kjør vindu-merge på nytt. */
  precomputedTimeWindowSummaries?: TankestromTimeWindowSummary[]
}): NormalizedTankestromScheduleDetails {
  const titleContext = (input.titleContext ?? []).filter(Boolean)
  const removedFragments: string[] = []
  const removedHighlights: string[] = []
  const liftedBringItems: string[] = []

  const rawHighlightsIn = [...input.highlights]
  const rawNotesIn = expandNoteLines([...input.notes])
  const rawBringIn = [...(input.bringItems ?? [])].map(normalizeBringItem).filter(Boolean)

  const hasStructuredSeed =
    input.highlights.length > 0 || (input.bringItems?.length ?? 0) > 0

  const initialBring = dedupeBringItemsList(rawBringIn)
  const fromNotes: string[] = []
  const liftedFromLists: string[] = []
  const remainingNotesRaw: string[] = []

  for (let idx = 0; idx < rawNotesIn.length; idx += 1) {
    const n = rawNotesIn[idx]!
    if (hasStructuredSeed && looksLikeStructuredFallbackBlob(n)) {
      removedFragments.push(n)
      continue
    }
    if (hasStructuredSeed && hasStructureMarkersLine(n) && looksLikeStructuredFallbackBlob(n)) {
      removedFragments.push(n)
      continue
    }
    if (hasStructuredSeed && hasStructureMarkersLine(n) && n.length > 80) {
      removedFragments.push(n)
      continue
    }

    const norm = normalizeBringItem(n)
    const next = idx + 1 < rawNotesIn.length ? normalizeBringItem(rawNotesIn[idx + 1]!) : ''
    if (normalizeTextKey(norm) === 'gjerne ekstra t' && normalizeTextKey(next) === 'skjorte') {
      const lifted = 'ekstra t-skjorte'
      fromNotes.push(lifted)
      liftedBringItems.push(lifted)
      removedFragments.push(n)
      removedFragments.push(rawNotesIn[idx + 1]!)
      idx += 1
      continue
    }

    if (isEquipmentListLine(n)) {
      const parts = splitEquipmentListLine(n)
      const allBring = parts.every((p) => isLikelyBringToken(p))
      if (allBring && parts.length >= 2) {
        for (const p of parts) {
          liftedFromLists.push(p)
          liftedBringItems.push(p)
        }
        removedFragments.push(n)
        continue
      }
    }

    const bullet = norm.replace(/^[•\-\*\u2022]\s*/u, '').trim()
    if (/^-\s*/.test(n) && isLikelyBringToken(bullet)) {
      fromNotes.push(bullet)
      liftedBringItems.push(bullet)
      removedFragments.push(n)
      continue
    }

    if (isLikelyBringItem(norm)) {
      fromNotes.push(norm)
      removedFragments.push(n)
      continue
    }
    remainingNotesRaw.push(n)
  }

  const bringItems = dedupeBringItemsList([...initialBring, ...fromNotes, ...liftedFromLists])

  let notes = remainingNotesRaw
    .filter((n) => {
      if (isJunkNoteFragment(n)) {
        removedFragments.push(n)
        return false
      }
      return true
    })
    .filter((n) => {
      const k = normalizeTextKey(n)
      if (k.length < 8 && !/[.!?]/.test(n) && !/\s/.test(n)) {
        removedFragments.push(n)
        return false
      }
      return true
    })

  const bringKeys = new Set(bringItems.map(semanticBringKey).filter(Boolean))
  notes = notes.filter((n) => {
    const k = semanticBringKey(n)
    if (k && bringKeys.has(k)) {
      removedFragments.push(n)
      return false
    }
    return true
  })

  const preFilteredHighlights: TankestromScheduleHighlight[] = []
  for (const h of rawHighlightsIn) {
    const fh = filterHighlightForDisplay(h, titleContext, removedHighlights)
    if (fh) preFilteredHighlights.push(fh)
  }

  const usePrecomputed = Boolean(input.precomputedTimeWindowSummaries?.length)
  const { rest: afterMerge, summaries: mergedSummaries } = usePrecomputed
    ? { rest: preFilteredHighlights, summaries: [] as TankestromTimeWindowSummary[] }
    : mergeTimeWindowHighlights(preFilteredHighlights)

  const afterWindow = afterMerge.filter((h) => normalizeTextKey(h.label) !== 'og')

  const dedup = new Map<string, TankestromScheduleHighlight>()
  let removedDuplicateHighlights = 0
  for (const h of afterWindow) {
    const key = `${h.time}__${classifyHighlightLabel(h.label)}`
    const candidate = { ...h }
    const prev = dedup.get(key)
    if (!prev) {
      dedup.set(key, candidate)
      continue
    }
    if (candidate.label.length < prev.label.length) dedup.set(key, candidate)
    removedDuplicateHighlights += 1
  }

  let timeWindowSummaries = usePrecomputed
    ? [...(input.precomputedTimeWindowSummaries ?? [])]
    : [...mergedSummaries]
  if (
    !usePrecomputed &&
    timeWindowSummaries.length === 0 &&
    Array.isArray(input.timeWindowCandidates) &&
    input.timeWindowCandidates.length > 0
  ) {
    const c = input.timeWindowCandidates[0]!
    const start = typeof c.start === 'string' ? c.start.trim().slice(0, 5) : ''
    const end = typeof c.end === 'string' ? c.end.trim().slice(0, 5) : ''
    if (start && end) {
      timeWindowSummaries.push({
        timeRange: `${start}–${end}`,
        label: typeof c.label === 'string' ? c.label.trim() : '',
        tentative: Boolean(c.tentative ?? input.tentativeTimeWindow),
      })
    }
  } else if (timeWindowSummaries.length > 0 && input.tentativeTimeWindow) {
    timeWindowSummaries = timeWindowSummaries.map((s) => ({ ...s, tentative: true }))
  }

  const highlights = [...dedup.values()]
    .filter((h) => normalizeTextKey(h.label) !== 'og')
    .sort((a, b) => a.time.localeCompare(b.time))

  const out: NormalizedTankestromScheduleDetails = {
    highlights,
    bringItems,
    notes,
    timeWindowSummaries,
    removedFragments,
    removedDuplicateHighlights,
    removedHighlights,
    liftedBringItems,
  }

  logCleanupResult(
    rawHighlightsIn,
    highlights,
    rawBringIn,
    bringItems,
    rawNotesIn,
    notes,
    removedFragments,
    removedHighlights,
    liftedBringItems,
    timeWindowSummaries
  )

  return out
}

function buildHighlightsFromEmbeddedSchedule(input: unknown): TankestromScheduleHighlight[] {
  if (!Array.isArray(input)) return []
  const out: TankestromScheduleHighlight[] = []
  for (const row of input) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const seg = row as Record<string, unknown>
    const start = typeof seg.start === 'string' ? seg.start.trim() : ''
    const title = typeof seg.title === 'string' ? seg.title.trim() : ''
    if (!start || !title) continue
    out.push({ time: start.slice(0, 5), label: title, type: inferTypeFromLabel(title) })
  }
  return out
}

export function dedupeNotesAgainstHighlights(
  notes: string[],
  highlights: TankestromScheduleHighlight[]
): string[] {
  if (notes.length === 0 || highlights.length === 0) return notes
  const highlightKeys = new Set(
    highlights.map((h) => normalizeTextKey(`${h.label} ${h.time}`)).filter((k) => k.length > 0)
  )
  return notes.filter((line) => {
    const lineKey = normalizeTextKey(line)
    if (!lineKey) return false
    const lineRawLower = line.toLocaleLowerCase('nb-NO')
    for (const key of highlightKeys) {
      if (!key) continue
      if (lineKey === key || lineKey.includes(key) || key.includes(lineKey)) return false
    }
    for (const h of highlights) {
      const labelKey = normalizeTextKey(h.label)
      if (!labelKey) continue
      if (lineKey.includes(labelKey) && lineRawLower.includes(h.time)) return false
    }
    return true
  })
}

function readTimeWindowCandidates(
  metadata: EventMetadata | undefined
): Array<{ start?: string; end?: string; label?: string; tentative?: boolean }> | undefined {
  if (!metadata?.timeWindowCandidates?.length) return undefined
  return metadata.timeWindowCandidates
}

export function readTankestromScheduleDetailsFromMetadata(
  metadata: EventMetadata | undefined,
  titleContext?: string[]
): NormalizedTankestromScheduleDetails {
  if (!metadata) {
    return emptyNormalizedTankestromDetails()
  }
  const directHighlights = Array.isArray(metadata.tankestromHighlights) ? metadata.tankestromHighlights : []
  const fallbackHighlights =
    Array.isArray(metadata.scheduleHighlights) && metadata.scheduleHighlights.length > 0
      ? metadata.scheduleHighlights
      : Array.isArray(metadata.highlights)
        ? metadata.highlights
        : []
  const parsedDirect = directHighlights.map(normalizeHighlightRow).filter((r): r is TankestromScheduleHighlight => !!r)
  const parsedFallback = fallbackHighlights
    .map(normalizeHighlightRow)
    .filter((r): r is TankestromScheduleHighlight => !!r)
  const parsedEmbedded = buildHighlightsFromEmbeddedSchedule(metadata.embeddedSchedule)
  const beforeDedupeHighlightsCount = parsedDirect.length + parsedFallback.length + parsedEmbedded.length
  const highlightsByKey = new Map<string, TankestromScheduleHighlight>()
  for (const row of [...parsedDirect, ...parsedFallback, ...parsedEmbedded]) {
    const key = `${row.time}__${normalizeTextKey(row.label)}`
    if (!key.trim()) continue
    if (!highlightsByKey.has(key)) {
      highlightsByKey.set(key, {
        ...row,
        type: row.type ?? inferTypeFromLabel(row.label),
      })
    }
  }
  const highlights = [...highlightsByKey.values()].sort((a, b) => a.time.localeCompare(b.time))
  const notesRaw = [...normalizeNotes(metadata.tankestromNotes), ...normalizeNotes(metadata.notesList)]
  const notesDeduped = dedupeNotesAgainstHighlights(notesRaw, highlights)
  const bringItemsRaw = [
    ...normalizeList((metadata as Record<string, unknown>).bringItems),
    ...normalizeList((metadata as Record<string, unknown>).packingItems),
  ]
  const ctxFromMeta = [
    ...(titleContext ?? []),
    typeof metadata.arrangementCoreTitle === 'string' ? metadata.arrangementCoreTitle : '',
  ].filter(Boolean)

  const precomputed =
    Array.isArray(metadata.tankestromTimeWindowSummaries) && metadata.tankestromTimeWindowSummaries.length > 0
      ? metadata.tankestromTimeWindowSummaries
      : undefined

  const normalized = normalizeTankestromScheduleDetails({
    highlights,
    notes: notesDeduped,
    bringItems: bringItemsRaw,
    timeWindowCandidates: readTimeWindowCandidates(metadata),
    tentativeTimeWindow: metadata.updateIntent?.likelyFollowup === true,
    precomputedTimeWindowSummaries: precomputed,
    titleContext: ctxFromMeta,
  })
  if (detailsDebugEnabled()) {
    const rawHighlightsForLog = metadata.tankestromHighlights ?? metadata.highlights ?? metadata.scheduleHighlights
    if (/høstcup/i.test(JSON.stringify({ rawHighlightsForLog, notesRaw }))) {
      console.info('[Tankestrom schedule Høstcupen raw vs normalized]', {
        rawHighlights: rawHighlightsForLog,
        rawBringItems: bringItemsRaw,
        rawNotes: notesRaw,
        normalizedHighlights: normalized.highlights,
        normalizedBringItems: normalized.bringItems,
        normalizedNotes: normalized.notes,
        timeWindowSummaries: normalized.timeWindowSummaries,
        removedFragments: normalized.removedFragments,
        removedHighlights: normalized.removedHighlights,
      })
    }
    console.info('[Tankestrom schedule details debug]', {
      rawMetadataDetails: {
        highlights: metadata.highlights,
        scheduleHighlights: metadata.scheduleHighlights,
        notesList: metadata.notesList,
        bringItems: (metadata as Record<string, unknown>).bringItems,
        packingItems: (metadata as Record<string, unknown>).packingItems,
        tankestromHighlights: metadata.tankestromHighlights,
        tankestromNotes: metadata.tankestromNotes,
        tankestromDescriptionFallback: metadata.tankestromDescriptionFallback,
        timeWindowCandidates: (metadata as Record<string, unknown>).timeWindowCandidates,
      },
      normalizedDetails: normalized,
      renderedHighlights: normalized.highlights,
      renderedBringItems: normalized.bringItems,
      renderedNotes: normalized.notes,
      removedFragments: normalized.removedFragments,
      removedDuplicateHighlights:
        Math.max(0, beforeDedupeHighlightsCount - normalized.highlights.length) +
        normalized.removedDuplicateHighlights,
    })
  }
  return normalized
}

export function buildTankestromScheduleDescriptionFallback(
  highlights: TankestromScheduleHighlight[],
  notes: string[]
): string {
  const rows: string[] = []
  if (highlights.length > 0) {
    rows.push('Høydepunkter:')
    for (const h of highlights) rows.push(`- ${h.time} ${h.label}`)
  }
  if (notes.length > 0) {
    if (rows.length > 0) rows.push('')
    rows.push('Notater:')
    for (const n of notes) rows.push(`- ${n}`)
  }
  return rows.join('\n').trim()
}
