/**
 * Presentasjon av delprogram-barns notater i import-review (kun UI — ingen persistede endringer).
 * Høydepunkter: klokkeslett fra notat (prioritert) sortert og deduplisert; segment-vindu undertrykkes når konkrete tider finnes i tekst.
 */

import type { EmbeddedScheduleSegment } from '../types'
import { semanticTitleCore } from './tankestromImportDedupe'
import { normalizeNotesDedupeKey, stripRedundantHighlightsForReviewDisplay } from './tankestromReviewNotesDisplay'

/** Linje som starter med klokkeslett (valgfritt punktmerke / «kl.»). */
const HM_START =
  /^\s*(?:(?:[•\-\*]|\d+[\.)])\s*)?(?:kl\.?\s*)?([01]?\d|2[0-3]):([0-5]\d)(?:\s*[–—\-]\s*([01]?\d|2[0-3]):([0-5]\d))?\s*(.*)$/i

/** «Kamp kl. 09:20» / «Kampstart kl. 18:40. Mer tekst» — tid avsluttes med ordgrense. */
const KL_SUFFIX =
  /^(.+?)\s+kl\.?\s*([01]?\d|2[0-3]):([0-5]\d)\b\s*(.*)$/i

const SECTION_HEADER_ONLY =
  /^\s*(?:høydepunkt(?:er)?|notater|husk|frister|praktisk|detaljer|dagsprogram|program|informasjon)\s*:?\s*$/i

const SYNTHETIC_CLOCK = new Set(['00:00', '06:00', '23:59'])

const TIME_TOKEN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g

type HighlightSource = 'note' | 'segment'

type InternalHighlight = EmbeddedChildHighlight & { _source: HighlightSource }

function hmToSortMinutes(h: string, m: string): number {
  const hh = String(parseInt(h, 10)).padStart(2, '0')
  return parseInt(hh, 10) * 60 + parseInt(m, 10)
}

function padHm(h: string, m: string): string {
  const hh = String(parseInt(h, 10)).padStart(2, '0')
  const mm = m.length === 1 ? `0${m}` : m.slice(0, 2)
  return `${hh}:${mm}`
}

export type EmbeddedChildHighlight = {
  timeStart: string
  timeEnd?: string
  label: string
  displayTime: string
  sortMinutes: number
}

export type EmbeddedChildNotesPresentation =
  | {
      mode: 'structured'
      highlights: EmbeddedChildHighlight[]
      noteLines: string[]
    }
  | {
      mode: 'plain'
      notesText: string
    }

function segmentClockParts(seg: EmbeddedScheduleSegment): {
  start: string
  end?: string
  sortMinutes: number
  displayTime: string
} | null {
  const rawS = seg.start?.trim()
  if (!rawS || !/^([01]\d|2[0-3]):[0-5]\d/.test(rawS.slice(0, 5))) return null
  const s = rawS.slice(0, 5)
  if (SYNTHETIC_CLOCK.has(s)) return null
  const rawE = seg.end?.trim()
  let end: string | undefined
  if (rawE && /^([01]\d|2[0-3]):[0-5]\d/.test(rawE.slice(0, 5))) {
    const e = rawE.slice(0, 5)
    if (e !== s && e !== '23:59' && e !== '24:00') end = e
  }
  const displayTime = end ? `${s}–${end}` : s
  const [sh, sm] = [s.slice(0, 2), s.slice(3, 5)]
  return { start: s, end, sortMinutes: hmToSortMinutes(sh, sm), displayTime }
}

function toPublicHighlight(h: InternalHighlight): EmbeddedChildHighlight {
  return {
    timeStart: h.timeStart,
    timeEnd: h.timeEnd,
    label: h.label,
    displayTime: h.displayTime,
    sortMinutes: h.sortMinutes,
  }
}

function leadingLineHighlight(line: string): InternalHighlight | null {
  const m = HM_START.exec(line.trim())
  if (!m) return null
  const h1 = m[1]!
  const min1 = m[2]!
  const h2 = m[3]
  const min2 = m[4]
  const rest = (m[5] ?? '').trim()
  const start = padHm(h1, min1)
  if (SYNTHETIC_CLOCK.has(start)) return null
  let timeEnd: string | undefined
  if (h2 != null && min2 != null) {
    const e = padHm(h2, min2)
    if (!SYNTHETIC_CLOCK.has(e) && e !== start) timeEnd = e
  }
  const [sh, sm] = [start.slice(0, 2), start.slice(3, 5)]
  const sortMinutes = hmToSortMinutes(sh, sm)
  const label = rest.length > 0 ? rest : '—'
  const displayTime = timeEnd ? `${start}–${timeEnd}` : start
  return {
    timeStart: start,
    timeEnd,
    label,
    displayTime,
    sortMinutes,
    _source: 'note',
  }
}

function klSuffixParse(line: string): { highlight: InternalHighlight | null; remainder: string | null } {
  const m = KL_SUFFIX.exec(line.trim())
  if (!m) return { highlight: null, remainder: null }
  const before = m[1]!.trim()
  const start = padHm(m[2]!, m[3]!)
  if (SYNTHETIC_CLOCK.has(start)) return { highlight: null, remainder: null }
  const rawAfter = (m[4] ?? '').trim().replace(/^[\s.:–—-]+/, '').trim()
  const label = (before || '—').trim() || '—'
  const [sh, sm] = [start.slice(0, 2), start.slice(3, 5)]
  const highlight: InternalHighlight = {
    timeStart: start,
    label,
    displayTime: start,
    sortMinutes: hmToSortMinutes(sh, sm),
    _source: 'note',
  }
  const remainder = rawAfter.length >= 6 ? rawAfter : null
  return { highlight, remainder }
}

/** Flere klokkeslett på én linje (komma / «og»); én highlight per treff. */
function inlineTimeHighlights(line: string): { list: InternalHighlight[]; remainder: string } {
  const trimmed = line.trim()
  const matches: { start: number; end: number; h: string; m: string }[] = []
  let m: RegExpExecArray | null
  TIME_TOKEN.lastIndex = 0
  while ((m = TIME_TOKEN.exec(trimmed)) !== null) {
    const t = padHm(m[1]!, m[2]!)
    if (SYNTHETIC_CLOCK.has(t)) continue
    matches.push({ start: m.index, end: m.index + m[0].length, h: m[1]!, m: m[2]! })
  }
  if (matches.length === 0) return { list: [], remainder: trimmed }

  const list: InternalHighlight[] = []
  for (const mat of matches) {
    const start = padHm(mat.h, mat.m)
    const before = trimmed.slice(0, mat.start).replace(/[;,]\s*$|^\s*[•\-\*]\s*/u, '').trim()
    const after = trimmed.slice(mat.end).replace(/^[;,]\s*|\s+og\s+/i, ' ').trim()
    let label = [before, after].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    if (!label) label = '—'
    const [sh, sm] = [start.slice(0, 2), start.slice(3, 5)]
    list.push({
      timeStart: start,
      label,
      displayTime: start,
      sortMinutes: hmToSortMinutes(sh, sm),
      _source: 'note',
    })
  }

  let remainder = trimmed
  for (const mat of [...matches].sort((a, b) => b.start - a.start)) {
    remainder = `${remainder.slice(0, mat.start)} ${remainder.slice(mat.end)}`
  }
  remainder = remainder
    .replace(/\bkl\.?\s*/gi, '')
    .replace(/[;,]\s*[;,]/g, ',')
    .replace(/\s+/g, ' ')
    .trim()

  return { list, remainder }
}

function countConcreteTimesInLine(line: string): number {
  let c = 0
  TIME_TOKEN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TIME_TOKEN.exec(line)) !== null) {
    const t = padHm(m[1]!, m[2]!)
    if (!SYNTHETIC_CLOCK.has(t)) c += 1
  }
  return c
}

function parseLineForNoteHighlights(line: string): { highlights: InternalHighlight[]; noteRemainder: string | null } {
  if (countConcreteTimesInLine(line) >= 2) {
    const { list, remainder } = inlineTimeHighlights(line)
    const rem = remainder.length >= 6 ? remainder : null
    return { highlights: list, noteRemainder: rem }
  }

  const lead = leadingLineHighlight(line)
  if (lead) {
    return { highlights: [lead], noteRemainder: null }
  }
  const kl = klSuffixParse(line)
  if (kl.highlight) {
    return { highlights: [kl.highlight], noteRemainder: kl.remainder }
  }
  const { list, remainder } = inlineTimeHighlights(line)
  if (list.length === 0) {
    return { highlights: [], noteRemainder: line }
  }
  const rem = remainder.length >= 6 ? remainder : null
  return { highlights: list, noteRemainder: rem }
}

function highlightDedupeKey(h: EmbeddedChildHighlight): string {
  return normalizeNotesDedupeKey(`${h.timeStart}${h.timeEnd ?? ''}${h.label}`)
}

function fullLineDedupeKey(h: EmbeddedChildHighlight): string {
  return normalizeNotesDedupeKey(`${h.displayTime} ${h.label}`)
}

function suppressParentLikeNoteLine(line: string, parentTitle?: string): boolean {
  const p = parentTitle?.trim()
  if (!p || p.length < 4) return false
  const pc = normalizeNotesDedupeKey(p)
  const lc = normalizeNotesDedupeKey(line)
  if (lc === pc) return true
  if (lc.length >= pc.length && lc.startsWith(pc) && line.trim().length <= p.length + 10) return true
  const pCore = semanticTitleCore(p)
  const lCore = semanticTitleCore(line)
  if (pCore.length >= 8 && lCore === pCore && line.trim().length < 140) return true
  return false
}

function logChildNotesDebug(payload: Record<string, unknown>): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_DEBUG_SCHOOL_IMPORT !== 'true') return
  console.debug('[tankestrom embedded child notes presentation]', payload)
}

function noteDuplicatesHighlight(line: string, highlights: EmbeddedChildHighlight[]): boolean {
  const lk = normalizeNotesDedupeKey(line)
  for (const h of highlights) {
    if (lk === fullLineDedupeKey(h)) return true
    const lab = normalizeNotesDedupeKey(h.label)
    if (lab.length >= 4 && lk === lab) return true
    if (lk.includes(fullLineDedupeKey(h)) && fullLineDedupeKey(h).length >= 10) return true
  }
  return false
}

/** Fjern notatlinjer som bare gjentar tider som allerede er i highlights. */
function pruneNoteLinesAgainstHighlights(
  lines: string[],
  highlights: EmbeddedChildHighlight[]
): { kept: string[]; removed: number } {
  let removed = 0
  const kept: string[] = []
  const timeKeys = new Set(highlights.map((h) => normalizeNotesDedupeKey(h.timeStart)))
  for (const h of highlights) {
    if (h.timeEnd) timeKeys.add(normalizeNotesDedupeKey(h.timeEnd))
  }

  for (const line of lines) {
    if (noteDuplicatesHighlight(line, highlights)) {
      removed += 1
      continue
    }
    let stripped = line
    for (const h of highlights) {
      stripped = stripped.replace(new RegExp(`\\b${h.timeStart.replace(':', '\\:')}\\b`, 'g'), ' ')
      if (h.timeEnd) stripped = stripped.replace(new RegExp(`\\b${h.timeEnd.replace(':', '\\:')}\\b`, 'g'), ' ')
    }
    stripped = stripped.replace(/\bkl\.?\s*/gi, ' ').replace(/\s+/g, ' ').trim()
    const onlyTimesLeft =
      stripped.length < 4 ||
      !/[a-zæøåA-ZÆØÅ]/.test(stripped) ||
      [...timeKeys].some((k) => k.length >= 4 && normalizeNotesDedupeKey(stripped) === k)

    if (onlyTimesLeft && /\d{1,2}:\d{2}/.test(line)) {
      removed += 1
      continue
    }
    kept.push(line)
  }
  return { kept, removed }
}

export function presentEmbeddedChildNotesForReview(args: {
  seg: EmbeddedScheduleSegment
  parentCardTitle?: string
  displayTitle: string
  childProposalId: string
}): EmbeddedChildNotesPresentation | null {
  const { seg, parentCardTitle, displayTitle, childProposalId } = args
  const raw = typeof seg.notes === 'string' ? seg.notes.trim() : ''
  if (!raw) return null

  const stripped = stripRedundantHighlightsForReviewDisplay(raw, {
    compareAgainst: displayTitle.trim() || undefined,
  })
  const text = (stripped.text ?? '').trim()
  if (!text) return null

  const lines = text.split(/\n/).map((l) => l.trim())
  const highlightsDraft: InternalHighlight[] = []
  const noteCandidates: string[] = []

  for (const line of lines) {
    if (!line) continue
    if (SECTION_HEADER_ONLY.test(line)) continue

    const { highlights: fromLine, noteRemainder } = parseLineForNoteHighlights(line)
    if (fromLine.length > 0) {
      highlightsDraft.push(...fromLine)
      if (noteRemainder && noteRemainder.length >= 6) {
        noteCandidates.push(noteRemainder)
      }
    } else {
      noteCandidates.push(line)
    }
  }

  const segClock = segmentClockParts(seg)
  let genericSegmentTimeSuppressed = false
  let concreteTimesPromoted = false

  if (segClock) {
    const hasNoteTimes = highlightsDraft.some((h) => h._source === 'note')
    if (hasNoteTimes) {
      genericSegmentTimeSuppressed = true
      concreteTimesPromoted = true
    } else {
      const label = (displayTitle.trim() || seg.title.trim() || '—').trim()
      highlightsDraft.push({
        timeStart: segClock.start,
        timeEnd: segClock.end,
        label,
        displayTime: segClock.displayTime,
        sortMinutes: segClock.sortMinutes,
        _source: 'segment',
      })
    }
  }

  const beforeDedupe = highlightsDraft.length
  const byKey = new Map<string, InternalHighlight>()
  for (const h of highlightsDraft) {
    const k = highlightDedupeKey(h)
    const prev = byKey.get(k)
    if (!prev || h.label.length > prev.label.length) byKey.set(k, h)
  }
  let highlights = [...byKey.values()].sort((a, b) => a.sortMinutes - b.sortMinutes)

  if (highlights.length === 1 && highlights[0]!.label === '—') {
    highlights = []
  }

  let parentSuppressed = 0
  const filterParent = (ls: string[]): string[] => {
    const o: string[] = []
    for (const line of ls) {
      if (!line.trim()) continue
      if (SECTION_HEADER_ONLY.test(line)) continue
      if (suppressParentLikeNoteLine(line, parentCardTitle)) {
        parentSuppressed += 1
        continue
      }
      o.push(line.trim())
    }
    return o
  }

  const publicHighlights = highlights.map(toPublicHighlight)
  const useStructured = publicHighlights.length > 0

  if (useStructured) {
    let noteLines = filterParent(noteCandidates).filter((line) => !noteDuplicatesHighlight(line, publicHighlights))
    const pruned = pruneNoteLinesAgainstHighlights(noteLines, publicHighlights)
    noteLines = pruned.kept

    logChildNotesDebug({
      embeddedScheduleChildGenericSegmentTimeSuppressed: genericSegmentTimeSuppressed,
      embeddedScheduleChildConcreteTimesPromoted: concreteTimesPromoted,
      embeddedScheduleChildHighlightsRenderedAsList: publicHighlights.length > 0,
      embeddedScheduleChildHighlightsRemovedFromNotes: pruned.removed > 0 || beforeDedupe > publicHighlights.length,
      embeddedScheduleChildTimeAccentApplied: publicHighlights.length > 0,
      embeddedScheduleChildHighlightsStructured: true,
      embeddedScheduleChildHighlightsDeduped: beforeDedupe > publicHighlights.length,
      embeddedScheduleChildHighlightsSorted: publicHighlights.length > 1,
      embeddedScheduleChildNotesSectionRendered: noteLines.length > 0,
      embeddedScheduleChildParentLikeTextSuppressed: parentSuppressed,
      childProposalId,
      highlightCount: publicHighlights.length,
    })
    return { mode: 'structured', highlights: publicHighlights, noteLines }
  }

  const plainLines = filterParent(lines.filter(Boolean))
  const finalPlain = plainLines.join('\n').trim()
  if (!finalPlain) return null

  logChildNotesDebug({
    embeddedScheduleChildGenericSegmentTimeSuppressed: false,
    embeddedScheduleChildConcreteTimesPromoted: false,
    embeddedScheduleChildHighlightsRenderedAsList: false,
    embeddedScheduleChildHighlightsRemovedFromNotes: false,
    embeddedScheduleChildTimeAccentApplied: false,
    embeddedScheduleChildHighlightsStructured: false,
    embeddedScheduleChildNotesSectionRendered: true,
    embeddedScheduleChildParentLikeTextSuppressed: parentSuppressed,
    childProposalId,
  })
  return { mode: 'plain', notesText: finalPlain }
}

export function presentationHasRenderableContent(p: EmbeddedChildNotesPresentation | null): boolean {
  if (!p) return false
  if (p.mode === 'plain') return p.notesText.trim().length > 0
  return p.highlights.length > 0 || p.noteLines.length > 0
}
