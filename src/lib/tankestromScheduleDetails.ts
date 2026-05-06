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
): { highlights: TankestromScheduleHighlight[]; notes: string[] } {
  if (!metadata) return { highlights: [], notes: [] }
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
  return { highlights, notes: dedupeNotesAgainstHighlights(notesRaw, highlights) }
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
