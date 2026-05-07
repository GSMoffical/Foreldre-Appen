import type { EmbeddedScheduleSegment } from '../types'
import type { PortalEventProposal, PortalProposalItem, PortalTaskProposal } from '../features/tankestrom/types'
import { addCalendarDaysOslo } from './osloCalendar'
import { semanticTitleCore } from './tankestromImportDedupe'
import { normalizeCalendarEventTitle } from './tankestromTitleNormalization'

/**
 * Konservativ klient-side merge: mange helge-eventforslag fra cup/turnering → ett parent-event
 * med metadata.embeddedSchedule. Tasks røres ikke.
 */

/** Norske sammensetninger (f.eks. «Vårcupen») har ikke ordgrense før «cup» — unngå kun `\bcup\b`. */
const CUP_OR_TOURNAMENT_HINT =
  /(vårcup|høstcup|julecup|fotballcup|håndballcup|sponscup|minicup|\bcup\b|turnering|turnerings|tournament|stevne|seriespill|kampoppsett|spillprogram|mesterskap|fotballstevne|håndballstevne)/i

const CONDITIONAL_SEGMENT_HINT =
  /eventuell|ved avansement|avhengig|hvis vi|om vi\b|sluttspill|kvalif|usikker|kan bli|\bevt\.?\b/i

const MIN_EVENTS_IN_CLUSTER = 3
const MIN_DISTINCT_DATES = 2
const MAX_SEGMENTS = 15
const MAX_NOTES_LEN = 220

function debugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true'
}

const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g

/** Kun trim / whitespace / usynlige tegn — ingen parent, ukedag eller dato. */
export function cleanManualTitle(raw: string): string {
  return raw.replace(ZERO_WIDTH_CHARS, '').replace(/\s+/g, ' ').trim()
}

export type EmbeddedScheduleChildTitleDebugContext = {
  childId?: string
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ts-emb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function osloWeekendFridayKey(dateKey: string): string | null {
  const w = new Date(`${dateKey}T12:00:00`).getDay()
  if (w === 5) return dateKey
  if (w === 6) return addCalendarDaysOslo(dateKey, -1)
  if (w === 0) return addCalendarDaysOslo(dateKey, -2)
  return null
}

function clusterKey(ev: PortalEventProposal): string | null {
  const fri = osloWeekendFridayKey(ev.event.date)
  if (!fri) return null
  return `${ev.event.personId}|${fri}`
}

function proposalAlreadyHasEmbeddedSchedule(ev: PortalEventProposal): boolean {
  const raw = ev.event.metadata?.embeddedSchedule
  return Array.isArray(raw) && raw.length > 0
}

function isAllDayTimes(start: string, end: string): boolean {
  const s = start.length > 5 ? start.slice(0, 5) : start
  const e = end.length > 5 ? end.slice(0, 5) : end
  return s === '00:00' && (e === '23:59' || e === '24:00')
}

function commonLocation(group: PortalEventProposal[]): string | undefined {
  const locs = group.map((g) => g.event.location?.trim()).filter(Boolean) as string[]
  if (locs.length === 0) return undefined
  const first = locs[0]!
  return locs.every((l) => l === first) ? first : undefined
}

function escapeRegexChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Fjerner review-/oppsummeringsfraser som ikke hører hjemme i kalendertittel (overalt i strengen, iterativt).
 */
export function stripEmbeddedScheduleReviewSummaryPhrases(t: string): string {
  const REVIEW_SUMMARY_PHRASE_PATTERNS: RegExp[] = [
    /\s*[–—\-:]\s*samlet info for helgen\b/gi,
    /\s*[–—\-:]\s*samlet informasjon for helgen\b/gi,
    /\s*[–—\-:]\s*informasjon for helgen\b/gi,
    /\s*[–—\-:]\s*praktisk info(?:rmation)? for helgen\b/gi,
    /\s*[–—\-:]\s*oversikt for helgen\b/gi,
    /\s*[–—\-:]\s*helge(?:informasjon|info)\b/gi,
    /\s*[–—\-:]\s*oppsummering for helgen\b/gi,
  ]
  let out = t.trim()
  for (let pass = 0; pass < 6; pass++) {
    const before = out
    for (const p of REVIEW_SUMMARY_PHRASE_PATTERNS) {
      out = out.replace(p, ' ').replace(/\s+/g, ' ').trim()
    }
    out = out.replace(/\s*[–—]\s*[–—]\s*/g, ' – ').trim()
    if (out === before) break
  }
  return out
}

function osloCalendarInstant(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0))
}

function norwegianWeekdayLong(isoDate: string): string {
  try {
    const inst = osloCalendarInstant(isoDate)
    if (!inst) return ''
    return inst.toLocaleDateString('nb-NO', { weekday: 'long', timeZone: 'Europe/Oslo' }).trim()
  } catch {
    return ''
  }
}

function formatEmbeddedParentReviewDateRangeSuffix(dateMin: string, dateMax: string): string {
  if (!dateMin || !dateMax || dateMin === dateMax) return ''
  const a = osloCalendarInstant(dateMin)
  const b = osloCalendarInstant(dateMax)
  if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return ''
  const oslo: Intl.DateTimeFormatOptions = { timeZone: 'Europe/Oslo' }
  try {
    const partsA = new Intl.DateTimeFormat('en-CA', {
      ...oslo,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(a)
    const partsB = new Intl.DateTimeFormat('en-CA', {
      ...oslo,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(b)
    const ga = (t: Intl.DateTimeFormatPartTypes) => Number(partsA.find((x) => x.type === t)?.value)
    const gb = (t: Intl.DateTimeFormatPartTypes) => Number(partsB.find((x) => x.type === t)?.value)
    const y1 = ga('year')
    const y2 = gb('year')
    const m1 = ga('month')
    const m2 = gb('month')
    const d1 = ga('day')
    const d2 = gb('day')
    if (y1 === y2 && m1 === m2) {
      const month = a.toLocaleDateString('nb-NO', { month: 'long', ...oslo })
      return `${d1}.–${d2}. ${month} ${y1}`
    }
    const left = a.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', ...oslo }).replace(/\.$/, '')
    const right = b
      .toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', ...oslo })
      .replace(/\.$/, '')
    return `${left} – ${right}`
  } catch {
    return ''
  }
}

/**
 * Kort parent-tittel i review (arrangementsnavn + valgfri datoperiode når flere dager).
 * `calendarCoreTitle` skal være output fra `normalizeEmbeddedScheduleParentDisplayTitle`.
 */
export function embeddedScheduleParentReviewDisplayTitle(
  calendarCoreTitle: string,
  dateMin: string,
  dateMax: string
): string {
  const core = calendarCoreTitle.trim()
  const suffix = formatEmbeddedParentReviewDateRangeSuffix(dateMin, dateMax)
  return suffix ? `${core} · ${suffix}` : core
}

const CHILD_STATUS_WORDS = /\b(?:foreløpig|forelopig|usikker|betinget|mulig)\b/giu

/** Deling av programpunkttittel i «deler» (em-dash, bindestrek, prikk, pipe). */
const CHILD_TITLE_SEGMENT_SEP = /\s*[–—\-·|]\s*/

const NB_WEEKDAY_LONG = new Set([
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lørdag',
  'søndag',
])

const NB_MONTH_LONG = new Set([
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember',
])

function partIsPunctuationOrNoiseOnly(part: string): boolean {
  return /^[.\u2026…·|/\\,:;]+$/u.test(part.trim()) || part.trim() === '–' || part.trim() === '-'
}

function partIsNorwegianMonthNameOnly(part: string): boolean {
  return NB_MONTH_LONG.has(part.trim().toLocaleLowerCase('nb-NO'))
}

function childWeekday(isoDate: string): string {
  return norwegianWeekdayLong(isoDate).toLocaleLowerCase('nb-NO')
}

function parseIsoYmd(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

/** Dagnummer (og liknende) hentet fra forelders datoperiode — for å fjerne lekkasje i barn-titler. */
function collectParentArrangementDayTokens(parentTitle: string): Set<number> {
  const set = new Set<number>()
  const s = parentTitle
  const reRangeMonth =
    /\b(\d{1,2})\s*[.–—]\s*(\d{1,2})\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\b/giu
  let rm: RegExpExecArray | null
  while ((rm = reRangeMonth.exec(s)) !== null) {
    set.add(Number(rm[1]))
    set.add(Number(rm[2]))
  }
  const reRangeDots = /\b(\d{1,2})\.\s*[–—]\s*(\d{1,2})\.(?=\s|$|[a-zæøå])/giu
  while ((rm = reRangeDots.exec(s)) !== null) {
    set.add(Number(rm[1]))
    set.add(Number(rm[2]))
  }
  const reSingle =
    /\b(\d{1,2})\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+\d{4})?\b/giu
  while ((rm = reSingle.exec(s)) !== null) {
    set.add(Number(rm[1]))
  }
  const reLoose = /\b(\d{1,2})\s*[–—]\s*(\d{1,2})\b/gu
  while ((rm = reLoose.exec(s)) !== null) {
    set.add(Number(rm[1]))
    set.add(Number(rm[2]))
  }
  return set
}

/**
 * Når samme dagnummer står som egen «del» i flere søsken-titler (f.eks. alle dager «… – 12 – …»),
 * er det nesten alltid lekkasje fra periode — ikke ukedagens dato.
 */
function collectRepeatedIsolatedDayPartsInContext(contextBlob: string): Set<number> {
  const counts = new Map<number, number>()
  for (const line of contextBlob.split('\n')) {
    const parts = line
      .split(CHILD_TITLE_SEGMENT_SEP)
      .map((p) => p.trim())
      .filter(Boolean)
    for (const part of parts) {
      if (!/^\d{1,2}$/.test(part)) continue
      const n = Number(part)
      if (n < 1 || n > 31) continue
      counts.set(n, (counts.get(n) ?? 0) + 1)
    }
  }
  const drop = new Set<number>()
  for (const [n, c] of counts) {
    if (c >= 2) drop.add(n)
  }
  return drop
}

function collectYearsFromParent(parentTitle: string): Set<number> {
  const set = new Set<number>()
  for (const x of parentTitle.matchAll(/\b(20[2-3]\d)\b/g)) {
    set.add(Number(x[1]))
  }
  return set
}

function partLooksMeaningfulWithDigits(part: string): boolean {
  const p = part.trim()
  if (/[A-Za-zÆØÅæøå]\d|\d[A-Za-zÆØÅæøå]/u.test(p)) return true
  if (/\b(?:kamp|runde|omgang|spill|cup)\s+\d{1,2}\b/iu.test(p)) return true
  if (/\b(?:klasse|lag)\s+\d{1,2}\b/iu.test(p)) return true
  return false
}

function partIsDateRangeFragment(part: string): boolean {
  return /^\d{1,2}\s*[.–—]\s*\d{1,2}\.?$/.test(part.trim())
}

function partIsDayMonthFragment(part: string): boolean {
  return /^\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+\d{4})?$/iu.test(
    part.trim()
  )
}

function partIsOnlyArrangementYear(
  part: string,
  segmentYear: number,
  parentYears: Set<number>
): boolean {
  const p = part.trim()
  if (!/^\d{4}$/.test(p)) return false
  const y = Number(p)
  if (y < 2024 || y > 2035) return false
  if (segmentYear >= 2024 && y === segmentYear) return true
  return parentYears.has(y)
}

function partIsStandaloneCalendarDay(
  part: string,
  segmentDay: number,
  parentDayTokens: Set<number>
): boolean {
  const p = part.trim()
  if (!/^\d{1,2}$/.test(p)) return false
  const n = Number(p)
  if (n < 1 || n > 31) return false
  if (segmentDay >= 1 && segmentDay <= 31 && n === segmentDay) return true
  return parentDayTokens.has(n)
}

function normalizeNbWeekdayToken(part: string): string {
  return part.toLocaleLowerCase('nb-NO').replace(/\.$/, '').trim()
}

function partIsNorwegianWeekday(part: string): boolean {
  return NB_WEEKDAY_LONG.has(normalizeNbWeekdayToken(part))
}

function stripWeekdayDateTrail(part: string): string | null {
  const p = part.trim()
  const re =
    /^(.+?)\s+\d{1,2}\.?\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+\d{4})?$/iu
  const m = re.exec(p)
  if (!m) return null
  const head = m[1]!.trim()
  if (!partIsNorwegianWeekday(head)) return null
  return head.charAt(0).toLocaleUpperCase('nb-NO') + head.slice(1)
}

function filterChildTitleParts(
  parts: string[],
  segmentDay: number,
  segmentYear: number,
  parentDayTokens: Set<number>,
  parentYears: Set<number>
): string[] {
  const out: string[] = []
  for (const rawPart of parts) {
    const part = rawPart.trim()
    if (!part) continue
    if (partIsPunctuationOrNoiseOnly(part)) continue
    if (partIsNorwegianMonthNameOnly(part)) continue
    if (partIsNorwegianWeekday(part)) {
      out.push(part.charAt(0).toLocaleUpperCase('nb-NO') + part.slice(1))
      continue
    }
    const strippedWd = stripWeekdayDateTrail(part)
    if (strippedWd) {
      out.push(strippedWd)
      continue
    }
    if (partLooksMeaningfulWithDigits(part)) {
      out.push(part)
      continue
    }
    if (partIsDateRangeFragment(part)) continue
    if (partIsDayMonthFragment(part)) continue
    if (partIsOnlyArrangementYear(part, segmentYear, parentYears)) continue
    if (partIsStandaloneCalendarDay(part, segmentDay, parentDayTokens)) continue
    out.push(part)
  }
  return out
}

/** Fjerner dupliserte arrangementsnavn-deler og tomme «ledd» etter splitting. */
function collapseRedundantChildParts(parts: string[], parentCore: string): string[] {
  const coreKey = semanticTitleCore(parentCore).toLocaleLowerCase('nb-NO')
  const out: string[] = []
  for (const raw of parts) {
    const p = raw.trim()
    if (!p || partIsPunctuationOrNoiseOnly(p)) continue
    const pKey = semanticTitleCore(p).toLocaleLowerCase('nb-NO')
    if (pKey && pKey === coreKey) continue
    if (out.length > 0) {
      const prevKey = semanticTitleCore(out[out.length - 1]!).toLocaleLowerCase('nb-NO')
      if (pKey && prevKey === pKey) continue
    }
    out.push(p)
  }
  return out
}

export function getParentCoreTitle(parentTitle: string): string {
  const normalized = normalizeEmbeddedScheduleParentDisplayTitle(parentTitle).title
  let out = normalized
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\b\d{1,2}\.\s*[–—-]\s*\d{1,2}\.\s+[a-zæøå]+(?:\s+\d{4})?\b/giu, '')
    .replace(/\b\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+\d{4})?\b/giu, '')
    .replace(/\s*[–—-]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const core = semanticTitleCore(out)
  if (core.length >= 3) out = core.charAt(0).toLocaleUpperCase('nb-NO') + core.slice(1)
  return out || normalized
}

/** Ekstraher kjernenavn for arrangement (uten år/dato); `metadata` er reservert for senere felt. */
export function getArrangementCoreTitle(parentTitle: string, _metadata?: Record<string, unknown>): string {
  void _metadata
  return getParentCoreTitle(parentTitle)
}

export interface BuildArrangementChildDisplayTitleInput {
  /** Full foreldertittel (kalender/rå) — brukes til token-strip og dagnummer-kontekst */
  parentTitle: string
  /** Valgfri forhåndsutledet kjerne (samme som getArrangementCoreTitle) */
  parentCoreTitle?: string
  segmentTitle: string
  segmentDate: string
  segmentMetadata?: Record<string, unknown>
  siblingTitlesBlob?: string
}

/**
 * Én inngang for visning, review-redigering og persist av barn-tittel i flerdagersprogram.
 */
export function buildArrangementChildDisplayTitle(input: BuildArrangementChildDisplayTitleInput): string {
  void input.segmentMetadata
  const segment: EmbeddedScheduleSegment = {
    date: input.segmentDate,
    title: input.segmentTitle,
  }
  const out = normalizeArrangementChildTitle(
    input.segmentTitle,
    input.parentTitle.trim(),
    segment,
    input.siblingTitlesBlob
  )
  if (import.meta.env.DEV) {
    console.info('[Tankestrom child title normalize]', {
      parentTitle: input.parentTitle,
      segmentTitleRaw: input.segmentTitle,
      segmentDate: input.segmentDate,
      outputTitle: out,
    })
  }
  return out
}

/**
 * Kort barn-tittel for flerdagersarrangement: fjern dato-tall som lekker fra forelder/periode,
 * behold meningsbærende tall (G12, Cup 2, …). `parentTitleForStrip` bør være full forelder-tittel
 * (inkl. år og datointervall) slik at 12/14/juni-tokens kan knyttes til parent.
 */
export function normalizeArrangementChildTitle(
  title: string,
  parentTitleForStrip: string,
  segment: EmbeddedScheduleSegment,
  additionalDateContext?: string
): string {
  if (segment.userEditedTitle) {
    return cleanManualTitle(segment.titleOverride ?? title)
  }
  const parentCore = getParentCoreTitle(parentTitleForStrip)
  const wd = childWeekday(segment.date)
  const ymd = parseIsoYmd(segment.date)
  const segmentDay = ymd?.d ?? -1
  const segmentYear = ymd?.y ?? -1
  const parentDayTokens = collectParentArrangementDayTokens(parentTitleForStrip)
  const ctx = additionalDateContext?.trim()
  if (ctx) {
    for (const n of collectParentArrangementDayTokens(ctx)) parentDayTokens.add(n)
    for (const n of collectRepeatedIsolatedDayPartsInContext(ctx)) parentDayTokens.add(n)
  }
  const parentYears = collectYearsFromParent(parentTitleForStrip)
  if (ctx) {
    for (const y of collectYearsFromParent(ctx)) parentYears.add(y)
  }

  let out = stripEmbeddedScheduleReviewSummaryPhrases(title.trim())
  const stripVariants = new Set<string>()
  const pt = parentTitleForStrip.trim()
  if (pt) {
    stripVariants.add(pt)
    const npc = normalizeEmbeddedScheduleParentDisplayTitle(pt).title
    if (npc) stripVariants.add(npc)
  }
  const coreFromInput = getParentCoreTitle(pt)
  if (coreFromInput) stripVariants.add(coreFromInput)
  if (parentCore) stripVariants.add(parentCore)

  for (const variant of stripVariants) {
    const esc = escapeRegexChars(variant.trim())
    if (esc) out = out.replace(new RegExp(esc, 'giu'), ' ')
  }

  out = out
    .replace(CHILD_STATUS_WORDS, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(?:man|tir|ons|tor|fre|lør|lor|søn|son)\.?\s+\d{1,2}\.?\b/giu, ' ')
    .replace(/\b(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)\s+\d{1,2}\.?(?:\s+[a-zæøå]+)?(?:\s+\d{4})?\b/giu, ' ')
    .replace(/\b\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+\d{4})?\b/giu, ' ')
    .replace(/\(\s*[/.\s…-]*\)/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const splitParts = out
    .split(CHILD_TITLE_SEGMENT_SEP)
    .map((p) => p.trim())
    .filter(Boolean)
  const filteredRaw = filterChildTitleParts(
    splitParts,
    segmentDay > 0 ? segmentDay : 0,
    segmentYear > 0 ? segmentYear : 0,
    parentDayTokens,
    parentYears
  )
  const filtered = collapseRedundantChildParts(filteredRaw, parentCore)

  const extras = filtered.filter((p) => !partIsNorwegianWeekday(p))

  const base = `${parentCore} – ${wd}`
  if (extras.length === 0) return base

  const extraJoined = extras.join(' – ').trim()
  const extraCore = semanticTitleCore(extraJoined)
  if (
    !extraCore ||
    extraCore === semanticTitleCore(wd) ||
    extraCore === semanticTitleCore(parentCore)
  ) {
    return base
  }
  return `${parentCore} – ${extraJoined} – ${wd}`
}

/**
 * Kort, dagsspesifikk tittel for delprogram i review (og samme logikk for kalender-eksport).
 * @param parentEventTitleFull Full foreldertittel (før normalize) slik at datoperiode (12.–14. juni) kan brukes til å rydde barn-titler.
 */
export function embeddedScheduleChildReviewDisplayTitle(
  parentEventTitleFull: string,
  segmentTitle: string,
  segmentIsoDate: string,
  additionalDateContext?: string
): string {
  const parentTrim = parentEventTitleFull.trim()
  const core = getParentCoreTitle(parentTrim)
  const wd = norwegianWeekdayLong(segmentIsoDate)
  if (!core || core.length < 2) {
    return segmentTitleForDisplay(segmentTitle)
  }
  if (!wd) {
    return segmentTitleForDisplay(segmentTitle)
  }
  return buildArrangementChildDisplayTitle({
    parentTitle: parentTrim,
    parentCoreTitle: core,
    segmentTitle,
    segmentDate: segmentIsoDate,
    siblingTitlesBlob: additionalDateContext,
  })
}

/**
 * Én inngang for review/preview: manuell tittel (userEditedTitle) er autoritativ, ellers auto-normalisering.
 */
export function embeddedScheduleChildTitleForReview(
  parentEventTitleFull: string,
  segment: EmbeddedScheduleSegment,
  additionalDateContext?: string,
  debug?: EmbeddedScheduleChildTitleDebugContext
): string {
  if (segment.userEditedTitle) {
    const rendered = cleanManualTitle(segment.titleOverride ?? segment.title)
    if (import.meta.env.DEV && debug?.childId) {
      console.info('[Tankestrom child title render]', {
        childId: debug.childId,
        rawTitle: segment.title,
        titleOverride: segment.titleOverride,
        userEditedTitle: true,
        renderedTitle: rendered,
      })
    }
    return rendered || 'Uten tittel'
  }
  const rendered = embeddedScheduleChildReviewDisplayTitle(
    parentEventTitleFull,
    segment.title,
    segment.date,
    additionalDateContext
  )
  if (import.meta.env.DEV && debug?.childId) {
    console.info('[Tankestrom child title render]', {
      childId: debug.childId,
      rawTitle: segment.title,
      titleOverride: segment.titleOverride,
      userEditedTitle: false,
      renderedTitle: rendered,
    })
  }
  return rendered
}

/**
 * Kalendertittel for løsrevet / importert programpunkt (ikke «samlet info»-språk).
 */
export function embeddedScheduleChildCalendarExportTitle(
  segment: EmbeddedScheduleSegment,
  parentEventTitle: string,
  additionalDateContext?: string
): string {
  if (segment.userEditedTitle) {
    return cleanManualTitle(segment.titleOverride ?? segment.title)
  }
  return normalizeCalendarEventTitle(
    embeddedScheduleChildReviewDisplayTitle(
      parentEventTitle.trim(),
      segment.title,
      segment.date,
      additionalDateContext
    ),
    { start: segment.start, end: segment.end }
  )
}

function segmentTitleForDisplay(rawTitle: string): string {
  const cleaned = stripEmbeddedScheduleReviewSummaryPhrases(rawTitle.trim())
  const source = cleaned.length >= 2 ? cleaned : rawTitle.trim()
  const core = semanticTitleCore(source)
  if (core.length < 3) return source.length >= 2 ? source : rawTitle.trim()
  return core.charAt(0).toLocaleUpperCase('nb-NO') + core.slice(1)
}

/** Fjerner dag-/helg-påsydde traillere («… – fredag», «… – informasjon for helgen») fra parent-tittel. */
const PARENT_TITLE_TRAILERS: RegExp[] = [
  /\s*[–—\-:]\s*informasjon for helgen\b.*$/i,
  /\s*[–—\-:]\s*samlet info for helgen\b.*$/i,
  /\s*[–—\-:]\s*praktisk info(?:rmation)?\b.*$/i,
  /\s*[–—\-:]\s*(?:uke|helg)\s+\d+.*$/i,
  /\s*[–—\-:]\s*(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)\b(?:\s+\d{1,2}\.?(?:\s+[a-zæøå]+)?(?:\s+\d{4})?)?\s*$/i,
  /\s+[–—\-]\s*(?:fredag|lørdag|søndag)\s*$/i,
  /** Tankestrøm: «Cup – fredag 12. juni – søndag 14. juni» i én sveip (flere ledd etter første ukedag). */
  /\s*[–—\-]\s*(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)\b.*$/i,
  /** «… – 12.–14. juni 2026» / usikkerhets- eller datointervall-påsats på parent. */
  /\s*[–—\-]\s*\d{1,2}\.\s*[–—]\s*\d{1,2}\.\s+[a-zæøå]+(?:\s+\d{4})?\s*$/i,
]

/**
 * Gjør merged parent-tittel container-aktig (samme navn som arrangementet, ikke én dags overskrift).
 * Brukes som faktisk kalender-/lagringstittel (uten review-metafraser).
 */
export function normalizeEmbeddedScheduleParentDisplayTitle(raw: string): {
  title: string
  wasDayLikeTitle: boolean
} {
  const original = raw.trim()
  if (!original) return { title: raw, wasDayLikeTitle: false }

  /** Fjern review-/menneske-suffiks « · Fredag og lørdag» før dag-påsats, ellers blir hybrid «…– fredag · …». */
  const summaryStripped = stripEmbeddedScheduleReviewSummaryPhrases(
    original.replace(/\s*·\s*.+$/, '').trim()
  )
  let stripped = summaryStripped
  let prev = ''
  while (stripped !== prev) {
    prev = stripped
    for (const p of PARENT_TITLE_TRAILERS) {
      stripped = stripped.replace(p, '').trim()
    }
  }

  const core = semanticTitleCore(stripped)
  const titled =
    core.length >= 4
      ? core.charAt(0).toLocaleUpperCase('nb-NO') + core.slice(1)
      : stripped.length >= 2
        ? stripped
        : original

  const wasDayLikeTitle =
    original !== titled ||
    PARENT_TITLE_TRAILERS.some((p) => p.test(original)) ||
    /\s[–—\-]\s*(?:fredag|lørdag|søndag)\b/i.test(original) ||
    summaryStripped !== original

  return { title: titled.length >= 2 ? titled : original, wasDayLikeTitle }
}

function pickParentTitle(
  cluster: PortalEventProposal[],
  dateMin: string,
  dateMax: string
): { title: string; wasDayLikeTitle: boolean } {
  const withHint = cluster
    .filter((c) => CUP_OR_TOURNAMENT_HINT.test(c.event.title))
    .sort((a, b) => b.confidence - a.confidence)
  const rawCandidate = withHint[0]?.event.title?.trim()
  if (rawCandidate) {
    return normalizeEmbeddedScheduleParentDisplayTitle(rawCandidate)
  }
  return { title: `Sportshelg (${dateMin} – ${dateMax})`, wasDayLikeTitle: false }
}

function buildSegments(cluster: PortalEventProposal[]): EmbeddedScheduleSegment[] {
  const sorted = [...cluster].sort((a, b) => {
    const d = a.event.date.localeCompare(b.event.date)
    if (d !== 0) return d
    return a.event.start.localeCompare(b.event.start)
  })
  const out: EmbeddedScheduleSegment[] = []
  for (const ev of sorted) {
    const rawTitle = ev.event.title.trim()
    const title = segmentTitleForDisplay(rawTitle)
    if (title.length < 2) continue

    const meta = ev.event.metadata
    const allDay =
      meta?.isAllDay === true || isAllDayTimes(ev.event.start, ev.event.end)

    const seg: EmbeddedScheduleSegment = {
      date: ev.event.date,
      title,
    }

    const blob = `${rawTitle}\n${ev.event.notes ?? ''}`
    if (CONDITIONAL_SEGMENT_HINT.test(blob)) {
      seg.isConditional = true
    }

    if (!allDay) {
      const ss = ev.event.start.length > 5 ? ev.event.start.slice(0, 5) : ev.event.start
      const ee = ev.event.end.length > 5 ? ev.event.end.slice(0, 5) : ev.event.end
      const hm = /^([01]\d|2[0-3]):[0-5]\d$/
      if (hm.test(ss)) seg.start = ss
      if (hm.test(ee)) seg.end = ee
    }

    const notes = ev.event.notes?.trim()
    if (notes && notes.length <= MAX_NOTES_LEN) seg.notes = notes

    out.push(seg)
  }
  return out
}

/**
 * Etter dedupe: slå sammen flate helge-eventforslag til ett parent-event med `embeddedSchedule`
 * når signalene er tydelige (cup/turnering/stevne, minst tre hendelser, minst to datoer, kun fre–søn).
 */
export function applyCupWeekendEmbeddedScheduleMerge(
  items: PortalProposalItem[],
  options?: { sourceText?: string }
): PortalProposalItem[] {
  const sourceBlob = (options?.sourceText ?? '').toLocaleLowerCase('nb-NO')
  const schools = items.filter((i) => i.kind === 'school_profile')
  const tasks = items.filter((i): i is PortalTaskProposal => i.kind === 'task')
  const events = items.filter((i): i is PortalEventProposal => i.kind === 'event')

  const byCluster = new Map<string, PortalEventProposal[]>()
  for (const e of events) {
    if (proposalAlreadyHasEmbeddedSchedule(e)) continue
    const key = clusterKey(e)
    if (!key) continue
    if (!byCluster.has(key)) byCluster.set(key, [])
    byCluster.get(key)!.push(e)
  }

  const removeIds = new Set<string>()
  const newParents: PortalEventProposal[] = []

  for (const group of byCluster.values()) {
    if (group.length < MIN_EVENTS_IN_CLUSTER) continue

    const distinctDates = [...new Set(group.map((g) => g.event.date))].sort()
    if (distinctDates.length < MIN_DISTINCT_DATES) continue

    const clusterText = [
      ...group.map((g) => `${g.event.title}\n${g.event.notes ?? ''}`),
      sourceBlob,
    ]
      .join('\n')
      .toLocaleLowerCase('nb-NO')

    if (!CUP_OR_TOURNAMENT_HINT.test(clusterText)) continue

    const segmentsRaw = buildSegments(group)
    if (segmentsRaw.length < MIN_EVENTS_IN_CLUSTER) continue
    if (segmentsRaw.length > MAX_SEGMENTS) continue

    const dateMin = distinctDates[0]!
    const dateMax = distinctDates[distinctDates.length - 1]!
    const { title: parentTitle, wasDayLikeTitle: parentWasDayLikeTitle } = pickParentTitle(group, dateMin, dateMax)
    const arrangementDateContextBlob = group.map((g) => g.event.title.trim()).join('\n')
    const segments = segmentsRaw.map((seg) => ({
      ...seg,
      title: embeddedScheduleChildTitleForReview(parentTitle, seg, arrangementDateContextBlob),
    }))
    const confidence = Math.max(...group.map((g) => g.confidence))
    const template = group.sort((a, b) => b.confidence - a.confidence)[0]!
    const blockGroupId = newId()
    const proposalId = newId()

    const conditionalSegments = segments.filter((s) => s.isConditional).length

    const parent: PortalEventProposal = {
      proposalId,
      kind: 'event',
      sourceId: template.sourceId,
      originalSourceType: template.originalSourceType,
      confidence,
      externalRef: template.externalRef,
      calendarOwnerUserId: template.calendarOwnerUserId,
      event: {
        date: dateMin,
        personId: template.event.personId,
        title: parentTitle,
        start: '00:00',
        end: '23:59',
        notes: '',
        location: commonLocation(group) ?? '',
        reminderMinutes: null,
        metadata: {
          isAllDay: true,
          endDate: dateMax,
          embeddedSchedule: segments,
          blockGroupId,
        },
      },
    }

    for (const g of group) removeIds.add(g.proposalId)
    newParents.push(parent)

    if (debugEnabled()) {
      console.debug('[tankestrom embedded schedule merge]', {
        embeddedScheduleCandidateDetected: true,
        embeddedScheduleSegmentsBuilt: segments.length,
        embeddedScheduleParentEventBuilt: {
          proposalId,
          title: parentTitle,
          dateMin,
          dateMax,
          blockGroupId,
        },
        embeddedScheduleParentTitleNormalized: parentTitle,
        embeddedScheduleParentWasDayLikeTitle: parentWasDayLikeTitle,
        embeddedScheduleParentMetaNormalized: true,
        embeddedScheduleParentDisplayRange: `${dateMin}…${dateMax}`,
        embeddedScheduleConditionalSegments: conditionalSegments,
        embeddedScheduleTasksPreserved: tasks.length,
      })
    }
  }

  if (newParents.length === 0) return items

  const keptEvents = events.filter((e) => !removeIds.has(e.proposalId))
  return [...schools, ...newParents, ...keptEvents, ...tasks]
}
