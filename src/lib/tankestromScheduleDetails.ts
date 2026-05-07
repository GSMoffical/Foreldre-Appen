import type { EventMetadata, TankestromScheduleHighlight, TankestromScheduleHighlightType } from '../types'

function normalizeTextKey(value: string): string {
  return value
    .toLocaleLowerCase('nb-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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

function isLikelyBringItem(line: string): boolean {
  const k = normalizeTextKey(line)
  if (!k) return false
  if (k.length <= 2) return false
  if (k === 'husk ta med') return false
  if (/^(matpakke|drikkeflaske|innesko|handkle|sokker|skjorte|ekstra t skjorte|ekstra t)$/.test(k)) return true
  if (k.startsWith('gjerne ekstra t')) return true
  if (k.startsWith('ta med ') || k.startsWith('husk ')) return true
  return false
}

function isJunkNoteFragment(line: string): boolean {
  const trimmed = line.trim()
  const k = normalizeTextKey(trimmed)
  if (!k) return true
  if (k === 'dagens innhold' || k === 'husk ta med' || k === 'husk' || k === 'og') return true
  if (/^i\s+[a-z0-9æøå ]+$/i.test(trimmed)) return true
  if (/^i\s+(bekkestua skolehall|nadderud arena)$/i.test(trimmed)) return true
  if (k.length <= 2) return true
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

export function normalizeTankestromScheduleDetails(input: {
  highlights: TankestromScheduleHighlight[]
  notes: string[]
  bringItems?: string[]
  titleContext?: string[]
}): {
  highlights: TankestromScheduleHighlight[]
  bringItems: string[]
  notes: string[]
  removedFragments: string[]
  removedDuplicateHighlights: number
} {
  const titleContext = (input.titleContext ?? []).filter(Boolean)
  const removedFragments: string[] = []

  // Extract/normalize bring items first.
  const initialBring = [...(input.bringItems ?? [])].map(normalizeBringItem).filter(Boolean)
  const fromNotes: string[] = []
  const remainingNotesRaw: string[] = []
  for (let idx = 0; idx < input.notes.length; idx += 1) {
    const n = input.notes[idx]!
    const norm = normalizeBringItem(n)
    const next = idx + 1 < input.notes.length ? normalizeBringItem(input.notes[idx + 1]!) : ''
    if (normalizeTextKey(norm) === 'gjerne ekstra t' && normalizeTextKey(next) === 'skjorte') {
      fromNotes.push('ekstra t-skjorte')
      removedFragments.push(n)
      removedFragments.push(input.notes[idx + 1]!)
      idx += 1
      continue
    }
    if (isLikelyBringItem(norm)) {
      fromNotes.push(norm)
      removedFragments.push(n)
      continue
    }
    remainingNotesRaw.push(n)
  }
  const bringItems = [...new Map([...initialBring, ...fromNotes].map((x) => [normalizeTextKey(x), x])).values()]

  // Clean notes.
  const notes = remainingNotesRaw
    .filter((n) => {
      if (isJunkNoteFragment(n)) {
        removedFragments.push(n)
        return false
      }
      return true
    })
    .filter((n) => {
      // "Gjerne ekstra t" style fragments -> drop unless it has punctuation / sentence shape.
      const k = normalizeTextKey(n)
      if (k.length < 8 && !/[.!?]/.test(n)) {
        removedFragments.push(n)
        return false
      }
      return true
    })

  // Clean + dedupe highlights while preserving input order.
  const dedup = new Map<string, TankestromScheduleHighlight>()
  let removedDuplicateHighlights = 0
  for (const h of input.highlights) {
    const cleaned = cleanHighlightLabel(h.label)
    const label = cleaned.label
    if (!label) {
      removedDuplicateHighlights += 1
      continue
    }
    if (looksLikeTitleOnlyHighlight(label, titleContext)) {
      removedDuplicateHighlights += 1
      continue
    }
    const key = `${h.time}__${classifyHighlightLabel(label)}`
    const candidate: TankestromScheduleHighlight = {
      ...h,
      label,
      type: h.type ?? inferTypeFromLabel(label),
    }
    const prev = dedup.get(key)
    if (!prev) {
      dedup.set(key, candidate)
      continue
    }
    // Keep the cleaner/shorter label when duplicate semantic highlight occurs.
    if (candidate.label.length < prev.label.length) dedup.set(key, candidate)
    removedDuplicateHighlights += 1
  }

  return {
    highlights: [...dedup.values()],
    bringItems,
    notes,
    removedFragments,
    removedDuplicateHighlights,
  }
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

export function readTankestromScheduleDetailsFromMetadata(
  metadata: EventMetadata | undefined
): { highlights: TankestromScheduleHighlight[]; notes: string[]; bringItems: string[] } {
  if (!metadata) return { highlights: [], notes: [], bringItems: [] }
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
  const normalized = normalizeTankestromScheduleDetails({
    highlights,
    notes: notesDeduped,
    bringItems: bringItemsRaw,
  })
  if (detailsDebugEnabled()) {
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
      },
      normalizedDetails: {
        highlights: normalized.highlights,
        bringItems: normalized.bringItems,
        notes: normalized.notes,
      },
      renderedHighlights: [],
      renderedBringItems: normalized.bringItems,
      renderedNotes: normalized.notes,
      removedFragments: normalized.removedFragments,
      removedDuplicateHighlights:
        Math.max(0, beforeDedupeHighlightsCount - normalized.highlights.length) +
        normalized.removedDuplicateHighlights,
    })
  }
  return {
    highlights: normalized.highlights,
    notes: normalized.notes,
    bringItems: normalized.bringItems,
  }
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
