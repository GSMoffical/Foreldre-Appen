import type { EmbeddedScheduleSegment } from '../types'
import { normalizeNotesDedupeKey } from './tankestromReviewNotesDisplay'

export type EmbeddedParentReviewSummaryResult = {
  text: string | null
  derivedFromExistingNotes: boolean
  suppressedAsWeak: boolean
}

const WEEKDAYS_NB = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']

function weekdayLongNb(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T12:00:00`)
    return WEEKDAYS_NB[d.getDay()] ?? ''
  } catch {
    return ''
  }
}

function clampSentence(s: string, maxLen: number): string {
  const t = s.trim()
  if (t.length <= maxLen) return t
  let out = t.slice(0, maxLen)
  const lastPeriod = out.lastIndexOf('.')
  const lastBang = out.lastIndexOf('!')
  const lastQ = out.lastIndexOf('?')
  const last = Math.max(lastPeriod, lastBang, lastQ)
  if (last >= 40) return out.slice(0, last + 1)
  const lastComma = out.lastIndexOf(',')
  if (lastComma >= 55) return `${out.slice(0, lastComma).trimEnd()} …`
  return `${out.trimEnd()}…`
}

function firstParagraph(raw: string): string {
  const t = raw.replace(/\r\n/g, '\n').trim()
  if (!t) return ''
  return (t.split(/\n\s*\n/)[0] ?? t).trim()
}

function isSubstantiveVersusTitle(text: string, titleCompare: string): boolean {
  const tk = normalizeNotesDedupeKey(titleCompare)
  const nk = normalizeNotesDedupeKey(text)
  if (nk.length < 36) return false
  if (tk.length >= 8 && nk === tk) return false
  if (tk.length >= 12 && nk.length >= tk.length * 0.88 && nk.includes(tk) && nk.length < tk.length + 24) {
    return false
  }
  const words = nk.split(' ').filter((w) => w.length > 2)
  const tw = new Set(tk.split(' ').filter((w) => w.length > 2))
  if (words.length <= 3 && words.length > 0 && words.every((w) => tw.has(w))) return false
  return true
}

function excerptFromNotes(notes: string, titleCompare: string): string | null {
  const para = firstParagraph(notes)
  if (!para) return null
  const out = clampSentence(para, 195)
  if (out.length < 36) return null
  if (!isSubstantiveVersusTitle(out, titleCompare)) return null
  if (/^(husk|notater|frister)\s*:\s*$/i.test(out)) return null
  return out
}

function readMetadataBlurb(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null
  for (const key of ['sourceExcerpt', 'aiRationale'] as const) {
    const v = meta[key]
    if (typeof v === 'string' && v.trim().length >= 48) return v.trim()
  }
  return null
}

function distinctWeekdaysOrdered(segments: EmbeddedScheduleSegment[]): string[] {
  const sorted = [...segments].sort((a, b) => a.date.localeCompare(b.date))
  const seenDates = new Set<string>()
  const out: string[] = []
  for (const s of sorted) {
    if (seenDates.has(s.date)) continue
    seenDates.add(s.date)
    const w = weekdayLongNb(s.date)
    if (w && !out.includes(w)) out.push(w)
  }
  return out
}

function summaryFromProgram(segments: EmbeddedScheduleSegment[], titleCompare: string): string | null {
  if (segments.length < 2) return null
  const blob = segments.map((s) => `${s.title} ${s.notes ?? ''}`).join(' ').toLowerCase()
  const hasKamp = /\bkamp\b|kamper|match|serie|turnering|cup|stevne/i.test(blob)
  const hasTrening = /\btrening\b|øvelse|øving/i.test(blob)
  const hasOppmote = /\boppmøte\b|møtetid|innfinne|møt opp/i.test(blob)
  const hasSluttspill = /\bsluttspill|finale|semifinale|bronse|kvalif|avansement/i.test(blob)
  const conditional = segments.some((s) => s.isConditional)
  const days = distinctWeekdaysOrdered(segments)
  if (days.length === 0) return null

  const dayPart =
    days.length === 1
      ? `på ${days[0]}`
      : days.length === 2
        ? `på ${days[0]} og ${days[1]}`
        : `på ${days.slice(0, -1).join(', ')} og ${days[days.length - 1]}`

  const activity: string[] = []
  if (hasKamp) activity.push('kamper')
  if (hasTrening) activity.push('trening')
  if (hasOppmote) activity.push('oppmøte')

  if (activity.length === 0 && !conditional && !hasSluttspill) return null

  let sentence: string
  if (activity.length > 0) {
    const act = activity.slice(0, 2).join(' og ')
    sentence = `Aktiviteter ${dayPart} (${act}).`
  } else {
    sentence = `Program ${dayPart} som kan avhenge av tidligere resultater.`
  }

  if ((conditional || hasSluttspill) && activity.length > 0) {
    sentence += ' Noe kan avhenge av tidligere resultater.'
  }

  sentence += ' Detaljer og tider finner du i delprogrammet under.'

  if (!isSubstantiveVersusTitle(sentence, titleCompare)) return null
  return clampSentence(sentence, 220)
}

/**
 * Kort, menneskelig oppsummering for parent-kort med innebygd program (kun visning i review).
 * Ingen ny analysemotor — bygger på notater, ev. metadata-utdrag, eller enkel program-heuristikk.
 */
export function deriveEmbeddedParentReviewSummary(args: {
  notesForPreview: string
  parentTitleCompare: string
  metadata: Record<string, unknown> | undefined
  segments: EmbeddedScheduleSegment[] | undefined
}): EmbeddedParentReviewSummaryResult {
  const { notesForPreview, parentTitleCompare, metadata, segments } = args
  const hadNotesInput = notesForPreview.trim().length >= 12
  let suppressedAsWeak = false

  const fromNotes = excerptFromNotes(notesForPreview, parentTitleCompare)
  if (fromNotes) {
    return { text: fromNotes, derivedFromExistingNotes: true, suppressedAsWeak: false }
  }
  if (hadNotesInput) suppressedAsWeak = true

  const metaRaw = readMetadataBlurb(metadata)
  if (metaRaw) {
    const ex = clampSentence(firstParagraph(metaRaw), 195)
    if (ex.length >= 40 && isSubstantiveVersusTitle(ex, parentTitleCompare)) {
      return { text: ex, derivedFromExistingNotes: false, suppressedAsWeak }
    }
    suppressedAsWeak = true
  }

  const segs = segments?.length ? segments : []
  if (segs.length >= 2) {
    const fromProg = summaryFromProgram(segs, parentTitleCompare)
    if (fromProg) {
      return { text: fromProg, derivedFromExistingNotes: false, suppressedAsWeak }
    }
  }

  return { text: null, derivedFromExistingNotes: false, suppressedAsWeak }
}
