import type {
  EventMetadata,
  TankestromScheduleHighlight,
  TankestromScheduleHighlightType,
  TankestromTimeWindowSummary,
} from '../types'
import { isTankestromConsoleDebugEnabled } from './tankestromConsoleDebug'

function normalizeTextKey(value: string): string {
  return value
    .toLocaleLowerCase('nb-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Nordic-letter-aware label-nøkkel. NFD bryter ned `å` til `a` + diakritisk og lar
 * `normalizeTextKey` håndtere det, men `ø` og `æ` er udelelige base-tegn — de strippes
 * derfor til mellomrom av `normalizeTextKey`. Resultatet er at klassifikasjonen av
 * vanlige norske kamp/oppmøte-labels (`Oppmøte`, `Første kamp`) feilet når
 * live-API-en returnerte `type: 'other'`: «Oppmøte» normaliserte til «oppm te» som
 * verken inneholdt «oppmote» eller «mote».
 *
 * Vi bruker dette spesifikt for label-klassifisering i corrector + type-inference,
 * og lar `normalizeTextKey` (35+ call sites for dedup, sammenligninger m.m.) være
 * uendret.
 */
function normalizeLabelForKeyMatch(value: string): string {
  return value
    .toLocaleLowerCase('nb-NO')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
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
  const key = normalizeLabelForKeyMatch(label)
  // «Oppmøte før første kamp» — ikke klassifiser som kamp pga. «første kamp»-delstreng.
  if (key.includes('oppmote') || key.includes('mote')) return 'meeting'
  if (key.includes('kamp') || key.includes('match')) return 'match'
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

/** Tommelfingerregler for Husk/ta med i import-preview (ikke stedsspesifikke cup-navn). */
const TANKESTROM_GENERIC_BRING_TOKENS = new Set([
  'utstyr',
  'ting',
  'diverse',
  'saker',
  'equipment',
  'stuff',
  'greier',
  'masse',
  'litt',
  'noe',
  'allting',
  'annet',
])

const TANKESTROM_CONCRETE_BRING_RE = new RegExp(
  [
    String.raw`\b(matpakke|mat\s*og\s*drikke|drikkeflaske|drikke(?=\s|$)|flaske|vann|juice|energi|frokost|lunch|lunsj)\b`,
    String.raw`\b(regnjakke|jakke|bukse|bukser|shorts|genser|skjorte|trøye|t[\s-]?skjorte|drakt|klubbgenser|uniform|klær)\b`,
    String.raw`\b(sko|skoene|støvler|fotballsko|joggesko|innesko|sandaler)\b`,
    String.raw`\b(sokker|strømper|sokk|undertøy|overtrekk|overtrekksbukse|overtrekksklær|leggskyttere?|leggskinn)\b`,
    String.raw`\b(hansker|hanske|arbeidshansker|votter|lue|hette|hjelm|ball)\b`,
    String.raw`\b(håndkle|handkle)\b`,
    String.raw`\b(billett|billetter|dokument|dokumenter|legitimasjon|pass)\b`,
    String.raw`\b(bag|sekk|ryggsekk|sekken)\b`,
    String.raw`\b(begge|ekstra|spare|reserve)\b`,
    String.raw`\b(røde?|sort|svart|hvit|blå|graa|grå|gul|grønn|oransje|lilla)\b`,
  ].join('|'),
  'i'
)

function isTankestromParentLogisticsBringLine(raw: string): boolean {
  const k = normalizeTextKey(raw.trim())
  if (!k) return false
  if (/\bforeldre\b/.test(k) && /\b(bidra|still|frivillig|samlingspunkt|servert|kaffe|kake)\b/.test(k)) return true
  if (/\bforeldre\s+kan\b/.test(k)) return true
  if (/\bsamlingspunkt\b/.test(k) && /\b(bidra|foreldre|felles)\b/.test(k)) return true
  if (/\bvi\s+trenger\s+(hjelp|foreldre)\b/.test(k)) return true
  return false
}

function isGenericOnlyBringPhraseNormalized(k: string): boolean {
  const parts = k
    .split(' ')
    .map((x) => x.trim())
    .filter((w) => w && w !== 'og' && w !== 'eller' && w !== 'ogsa')
  if (parts.length === 0) return true
  return parts.every((w) => TANKESTROM_GENERIC_BRING_TOKENS.has(w))
}

function hasTankestromConcreteBringSignal(raw: string): boolean {
  const t = raw.trim()
  if (/[0-9]/.test(t)) return true
  return TANKESTROM_CONCRETE_BRING_RE.test(t)
}

function hasSubstantialNonGenericBringPhrase(raw: string, genericOnly: boolean): boolean {
  if (genericOnly) return false
  const words = raw.trim().split(/\s+/).filter(Boolean)
  return words.length >= 5
}

function qualifiesUtstyrWithSpecifier(raw: string): boolean {
  if (!/\butstyr\b/i.test(raw)) return false
  return raw.trim().split(/\s+/).filter(Boolean).length >= 3
}

/**
 * Delprogram / import: konkrete «ta med»-punkter i Husk/ta med; foreldrelogistikk til notater;
 * generiske enkeltord (f.eks. «utstyr») fjernes.
 */
export function partitionTankestromBringItemsForPreview(items: readonly string[]): {
  concreteBring: string[]
  divertToNotes: string[]
} {
  const concreteBring: string[] = []
  const divertToNotes: string[] = []
  for (const raw of items) {
    const t = normalizeBringItem(raw)
    if (!t) continue
    if (isTankestromParentLogisticsBringLine(t)) {
      divertToNotes.push(t)
      continue
    }
    const k = normalizeTextKey(t)
    const genericOnly = isGenericOnlyBringPhraseNormalized(k)
    const concreteSig = hasTankestromConcreteBringSignal(t)
    const utstyrOk = qualifiesUtstyrWithSpecifier(t)
    const substantial = hasSubstantialNonGenericBringPhrase(t, genericOnly)
    if (!concreteSig && !utstyrOk && !substantial) continue
    concreteBring.push(t)
  }
  return { concreteBring, divertToNotes }
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
  const key = normalizeLabelForKeyMatch(label)
  if (key.includes('oppmote') || key.includes('mote')) return 'oppmote'
  if (key.includes('kamp')) return 'kamp'
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

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/

function isHm(v: string | undefined): v is string {
  return typeof v === 'string' && HM.test(v.trim().slice(0, 5))
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10))
  return h * 60 + m
}

function minutesToHm(total: number): string | null {
  if (!Number.isFinite(total) || total < 0 || total > 23 * 60 + 59) return null
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function firstHmInText(text: string): string | null {
  const m = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text)
  if (!m) return null
  return `${String(parseInt(m[1]!, 10)).padStart(2, '0')}:${m[2]!}`
}

/**
 * Aktivitetsetikett for segment-start fallback. Aldri "Oppmøte" fra `fallbackStartTime` alene:
 * det krever trygg avledning (`inferOppmoteFallbackFromNotes` med anker+offset). Ellers risikerer
 * vi å merke kampstart (f.eks. 18:40) som "Oppmøte" når notater bare nevner ordet generelt.
 */
function inferFallbackActivityLabel(notes: string[], titleContext: string[]): { label: string; type: TankestromScheduleHighlightType } | null {
  const joined = [...notes, ...titleContext].join('\n')
  const k = normalizeTextKey(joined)
  if (!k) return null
  if (/\b(kampstart|forste kamp|kamp)\b/.test(k)) {
    return { label: /\bforste kamp\b/.test(k) ? 'Første kamp' : 'Kamp', type: 'match' }
  }
  if (/\b(trening|ovelse)\b/.test(k)) return { label: 'Trening', type: 'other' }
  if (/\b(forestilling|konsert|show)\b/.test(k)) return { label: 'Forestilling', type: 'other' }
  if (/\b(avreise|drar|reise)\b/.test(k)) return { label: 'Avreise', type: 'other' }
  if (/\b(henting|levering)\b/.test(k)) return { label: /\bhenting\b/.test(k) ? 'Henting' : 'Levering', type: 'other' }
  return null
}

export type HighlightTimeIntent = 'kamp' | 'oppmote' | 'both' | 'unknown'

function findAllOccurrences(text: string, pattern: RegExp): number[] {
  const out: number[] = []
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push(m.index)
    if (m.index === re.lastIndex) re.lastIndex += 1
  }
  return out
}

const PROXIMITY_WINDOW_CHARS = 50
const OPPMOTE_PROXIMITY_RE = /\b(?:oppm[øo]te|m[øo]t\s+opp|m[øo]tes?|ankomst|innfinn(?:ing|er)?)\b/gi
const KAMP_PROXIMITY_RE = /\b(?:f[øo]rste\s+kamp|andre\s+kamp|tredje\s+kamp|kampstart|kamp(?:en|er|ene)?)\b/gi
const NORWEGIAN_ABBREVS_AT_END_RE =
  /\b(?:kl|ca|f\.eks|fr|jr|nr|mvh|kr|mrk|kg|m|cm|km|mil|m\.fl|bl\.a|osv|hr|ev|evt|f|n)\.$/i

/** Setningsdeler som ikke splittes etter "kl.", "ca." og lignende norske forkortelser. */
function splitSentencesNorwegian(text: string): string[] {
  const out: string[] = []
  let buf = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    buf += ch
    const next = text[i + 1]
    if ((ch === '.' || ch === '!' || ch === '?') && (next === ' ' || next === '\n' || next === undefined)) {
      const candidate = buf.trim()
      if (NORWEGIAN_ABBREVS_AT_END_RE.test(candidate)) {
        i += 1
        continue
      }
      out.push(candidate)
      buf = ''
      i += 1
      while (i < text.length && (text[i] === ' ' || text[i] === '\n')) i += 1
      continue
    }
    if (ch === '\n') {
      const candidate = buf.trim()
      if (candidate) out.push(candidate)
      buf = ''
      i += 1
      continue
    }
    i += 1
  }
  const tail = buf.trim()
  if (tail) out.push(tail)
  return out
}

function stripLeadingBullet(s: string): string {
  return s.trim().replace(/^[•\-\*\u2022]\s*/u, '').trim()
}

function sentenceLeadingIntent(sentence: string): HighlightTimeIntent | null {
  const s = stripLeadingBullet(sentence)
  if (!s) return null
  if (/^(?:oppm[øo]te|m[øo]t\s+opp|m[øo]tes?|ankomst|innfinn(?:ing|er)?)\b/i.test(s)) return 'oppmote'
  if (/^(?:f[øo]rste\s+kamp|andre\s+kamp|tredje\s+kamp|kamp(?:start)?\b)/i.test(s)) return 'kamp'
  return null
}

function proximityIntentForTimeInText(timePos: number, oppmotePos: number[], kampPos: number[]): HighlightTimeIntent {
  let bestOppmote = Infinity
  let bestKamp = Infinity
  for (const op of oppmotePos) {
    const dist = Math.abs(op - timePos)
    if (dist <= PROXIMITY_WINDOW_CHARS && dist < bestOppmote) bestOppmote = dist
  }
  for (const kp of kampPos) {
    const dist = Math.abs(kp - timePos)
    if (dist <= PROXIMITY_WINDOW_CHARS && dist < bestKamp) bestKamp = dist
  }
  if (bestOppmote === Infinity && bestKamp === Infinity) return 'unknown'
  if (bestOppmote < bestKamp) return 'oppmote'
  if (bestKamp < bestOppmote) return 'kamp'
  return 'both'
}

/**
 * Klassifiser intensjonen til ett klokkeslett: setnings-basert (forrang) + nærhet (fallback).
 * Setning som starter med "Oppmøte ..." gir alltid `oppmote` for tider i setningen, selv om
 * "kamp" er nærmere klokkeslett ("Oppmøte før første kamp kl. 08:35.").
 */
export function classifyTimeIntentInSourceText(time: string, sourceText: string): HighlightTimeIntent {
  if (!time || !sourceText) return 'unknown'
  const text = sourceText.replace(/\r\n/g, '\n')
  const sentences = splitSentencesNorwegian(text)
  const timeEscaped = time.replace(/[:]/g, '\\:')
  const timeRe = new RegExp(`\\b${timeEscaped}\\b`)
  const seen: HighlightTimeIntent[] = []
  const oppmotePosAll = findAllOccurrences(text, OPPMOTE_PROXIMITY_RE)
  const kampPosAll = findAllOccurrences(text, KAMP_PROXIMITY_RE)
  for (const sentence of sentences) {
    if (!timeRe.test(sentence)) continue
    const leading = sentenceLeadingIntent(sentence)
    if (leading) {
      seen.push(leading)
      continue
    }
    const stripped = stripLeadingBullet(sentence)
    const tPosInSentence = stripped.search(timeRe)
    if (tPosInSentence < 0) {
      seen.push('unknown')
      continue
    }
    const oppmotePosInSentence = findAllOccurrences(stripped, OPPMOTE_PROXIMITY_RE)
    const kampPosInSentence = findAllOccurrences(stripped, KAMP_PROXIMITY_RE)
    seen.push(proximityIntentForTimeInText(tPosInSentence, oppmotePosInSentence, kampPosInSentence))
  }
  if (seen.length === 0) {
    const positions = findAllOccurrences(text, timeRe)
    if (positions.length === 0) return 'unknown'
    for (const tp of positions) seen.push(proximityIntentForTimeInText(tp, oppmotePosAll, kampPosAll))
  }
  if (seen.length === 0) return 'unknown'
  if (seen.includes('kamp') && seen.includes('oppmote')) return 'both'
  if (seen.includes('kamp')) return 'kamp'
  if (seen.includes('oppmote')) return 'oppmote'
  if (seen.includes('both')) return 'both'
  return 'unknown'
}

type KampCandidatePattern = { test: RegExp; label: string; specificity: number }

const KAMP_CANDIDATES: KampCandidatePattern[] = [
  { test: /\bandre\s+kamp\b/i, label: 'Andre kamp', specificity: 3 },
  { test: /\btredje\s+kamp\b/i, label: 'Tredje kamp', specificity: 3 },
  { test: /\bf[øo]rste\s+kamp\b/i, label: 'Første kamp', specificity: 2 },
  { test: /\bkampstart\b/i, label: 'Kamp', specificity: 1 },
  { test: /\bkamp(?:en|er|ene)?\b/i, label: 'Kamp', specificity: 1 },
]

function pickKampLabelFromSource(time: string, sourceText: string): string | null {
  const text = sourceText.replace(/\r\n/g, '\n')
  const sentences = splitSentencesNorwegian(text)
  const timeRe = new RegExp(`\\b${time.replace(/[:]/g, '\\:')}\\b`)
  let best: { label: string; specificity: number } | null = null
  for (const sentence of sentences) {
    if (!timeRe.test(sentence)) continue
    for (const cand of KAMP_CANDIDATES) {
      if (cand.test.test(sentence)) {
        if (!best || cand.specificity > best.specificity) {
          best = { label: cand.label, specificity: cand.specificity }
        }
        break
      }
    }
  }
  return best?.label ?? null
}

export type HighlightSourceTextValidation = {
  highlights: TankestromScheduleHighlight[]
  relabeled: Array<{ time: string; from: string; to: string }>
  dropped: Array<{
    time: string
    label: string
    reason:
      | 'kamp_signal_at_time'
      | 'no_oppmote_evidence'
      | 'tentative_segment_without_explicit_time'
      | 'time_not_in_day_section_with_explicit_times'
  }>
}

function sourceContainsTime(text: string, time: string): boolean {
  const escaped = time.replace(/[:]/g, '\\:')
  return new RegExp(`\\b${escaped}\\b`).test(text)
}

/**
 * Telles antall distinkte HH:MM-klokkeslett i en dagsspesifikk kildetekst.
 * Brukes som heuristikk for «dagseksjonen er meningsfull» — hvis vi har flere
 * konkrete tider å støtte oss på, er en høydepunkt-tid som ikke finnes der
 * nesten alltid en lekkasje fra en annen dag (typisk live-LLM-feil).
 */
function countDistinctTimesInSourceText(text: string): number {
  const re = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const hh = String(parseInt(m[1]!, 10)).padStart(2, '0')
    seen.add(`${hh}:${m[2]!}`)
  }
  return seen.size
}

const DAY_SECTION_EVIDENCE_MIN_DISTINCT_TIMES = 2

/**
 * Sterke «hele dagen er foreløpig»-markører i en dagsspesifikk kildetekst.
 * Brukes for å gjenkjenne tentative segmenter når LLM «glemte» å sette
 * `isConditional: true` på segmentet (sett i live Vårcup-payloads).
 *
 * KRITISK: Kalleren må allerede ha scopa sourceText til _denne_ dagens
 * seksjon (se `extractDaySectionForScheduleValidation`). Ellers kan fredagsfraser
 * («avhenger av resultatene fredag og lørdag») i et global blob gjøre
 * fredag foreløpig — som ville være feil.
 *
 * Mønstrene er bevisst konservative: de matcher fraser som beskriver at
 * _selve programmet/dagen_ er foreløpig, ikke ordet «foreløpig» løsrevet.
 */
export function classifyConditionalIntentFromSourceText(sourceText: string | undefined): boolean {
  if (!sourceText) return false
  const text = sourceText.toLowerCase()
  const markers: RegExp[] = [
    /\bspilleplan(?:en)?\s+(?:er\s+)?forel[øo]pig\b/,
    /\bforel[øo]pig\s+(?:program|opplegg|tid|plan|spilleplan)\b/,
    /\bendelig\s+tid\s+(?:kommer|meldes|gis|publiseres|annonseres)\b/,
    /\b(?:vi\s+)?melder\s+endelig\s+tid\b/,
    /\bendelig\s+tid\s+n[åa]r\s+(?:vi\s+vet|mer\s+er)\s+(?:mer|kjent)/,
    /\bavhenger\s+av\s+(?:resultat|hvordan|plassering|sluttspill)/,
    /\bikke\s+endelig\s+(?:avklart|bestemt|fastsatt|tid)/,
    /\bsluttspill(?:et)?\s+avhenger\b/,
    /\bbetinget\s+opplegg\b/,
    /\beventuell\s+kamp\b/,
    /\btidspunkt\s+(?:er|for)?\s*(?:ikke\s+)?(?:endelig\s+)?avklart\b/,
  ]
  return markers.some((re) => re.test(text))
}

function kampLabelOrdinalKey(label: string): string {
  const lc = label.toLocaleLowerCase('nb-NO')
  if (/\bf[øo]rste\b/.test(lc)) return 'forste'
  if (/\bandre\b/.test(lc)) return 'andre'
  if (/\btredje\b/.test(lc)) return 'tredje'
  return ''
}

/**
 * Korriger åpenbar feil-merking mot kildetekst (samme dag):
 * - Oppmøte ved en tid som kilden tydelig sier er kamp/første kamp blir omdøpt (positiv evidens MOT).
 * - Kamp-label kan presiseres når kilden gir tydelig ordinal (f.eks. "Andre kamp 15:10").
 * - For foreløpige segmenter (`isConditionalSegment=true`): dropp Oppmøte hvis tiden ikke er
 *   eksplisitt i kilden — unngår syntetisk «Oppmøte 17:00» når søndag er uavklart.
 *
 * Konservativ default: når vi ikke har positiv evidens MOT en Oppmøte-label (f.eks. fordi
 * `sourceText`-proxyen vår bare er praktiske notater uten dagsspesifikke klokkeslett), behold
 * highlighten som-er. Det er bedre å la en evt. LLM-feil stå enn å falske-positivt droppe
 * legitime oppmøtetider (Høstcupen-regresjon).
 */
export function correctMislabeledHighlightsAgainstSourceText(
  highlights: TankestromScheduleHighlight[],
  sourceText: string | undefined,
  opts?: { isConditionalSegment?: boolean }
): HighlightSourceTextValidation {
  const text = (sourceText ?? '').trim()
  const relabeled: HighlightSourceTextValidation['relabeled'] = []
  const dropped: HighlightSourceTextValidation['dropped'] = []
  if (!text) return { highlights, relabeled, dropped }
  // En segment er «foreløpig» enten fordi struktur-flagget sier det, eller fordi
  // dagsspesifikk sourceText eksplisitt sier det (LLM «glemmer» av og til flagget).
  // Vi bruker kun dagsspesifikk sourceText her (kalleren har scopa den per dato),
  // så fredag/lørdag-formuleringer kan ikke gjøre fredag eller lørdag foreløpig.
  const isConditional =
    opts?.isConditionalSegment === true || classifyConditionalIntentFromSourceText(text)
  // Hvis dagsseksjonen har flere konkrete tider (>=2), er den meningsfull, og en
  // highlight med en tid som _ikke_ er nevnt der er nesten alltid lekkasje fra
  // en annen dag (typisk live-LLM-feil hvor fredagstid havner på lørdag).
  const dayHasExplicitTimeEvidence =
    countDistinctTimesInSourceText(text) >= DAY_SECTION_EVIDENCE_MIN_DISTINCT_TIMES
  const out: TankestromScheduleHighlight[] = []
  for (const h of highlights) {
    const type = h.type ?? inferTypeFromLabel(h.label)
    const labelKind = classifyHighlightLabel(h.label)
    const treatAsOppmote = type === 'meeting' || labelKind === 'oppmote'
    const treatAsKamp = type === 'match' || labelKind === 'kamp'
    if (treatAsKamp) {
      // Tentative-/conditional segment uten eksplisitt klokkeslett i kildeteksten:
      // dropp kamp-highlighten for å unngå at fredagstider lekker til søndag etc.
      if (isConditional && !sourceContainsTime(text, h.time)) {
        dropped.push({ time: h.time, label: h.label, reason: 'tentative_segment_without_explicit_time' })
        continue
      }
      // Dagseksjonen er meningsfull men nevner ikke denne tida → lekkasje fra
      // en annen dag (f.eks. fredagstid 18:15 dukker opp på lørdag).
      if (dayHasExplicitTimeEvidence && !sourceContainsTime(text, h.time)) {
        dropped.push({
          time: h.time,
          label: h.label,
          reason: 'time_not_in_day_section_with_explicit_times',
        })
        continue
      }
      // Setningsstart «Oppmøte ...» på samme tid → degrader fra kamp til oppmøte.
      // (Live-LLM merket «08:35 Første kamp» selv om kildelinjen sier
      // «Oppmøte før første kamp kl. 08:35».)
      const kampIntent = classifyTimeIntentInSourceText(h.time, text)
      if (kampIntent === 'oppmote') {
        out.push({ time: h.time, label: 'Oppmøte', type: 'meeting' })
        relabeled.push({ time: h.time, from: h.label, to: 'Oppmøte' })
        continue
      }
      const sourceLabel = pickKampLabelFromSource(h.time, text)
      if (sourceLabel) {
        const sourceOrd = kampLabelOrdinalKey(sourceLabel)
        const labelOrd = kampLabelOrdinalKey(h.label)
        if (sourceOrd && labelOrd && sourceOrd !== labelOrd) {
          out.push({ time: h.time, label: sourceLabel, type: 'match' })
          relabeled.push({ time: h.time, from: h.label, to: sourceLabel })
          continue
        }
      }
      out.push(h)
      continue
    }
    if (!treatAsOppmote) {
      out.push(h)
      continue
    }
    const intent = classifyTimeIntentInSourceText(h.time, text)
    if (intent === 'kamp') {
      const replacement = pickKampLabelFromSource(h.time, text) ?? 'Kamp'
      out.push({ time: h.time, label: replacement, type: 'match' })
      relabeled.push({ time: h.time, from: h.label, to: replacement })
      continue
    }
    if (intent === 'oppmote' || intent === 'both') {
      out.push(h)
      continue
    }
    if (isConditional && !sourceContainsTime(text, h.time)) {
      dropped.push({ time: h.time, label: h.label, reason: 'tentative_segment_without_explicit_time' })
      continue
    }
    // Samme lekkasje-regel for oppmøte-highlights: dagseksjonen har flere
    // konkrete tider, men denne er ikke nevnt der → drop.
    if (dayHasExplicitTimeEvidence && !sourceContainsTime(text, h.time)) {
      dropped.push({
        time: h.time,
        label: h.label,
        reason: 'time_not_in_day_section_with_explicit_times',
      })
      continue
    }
    out.push(h)
  }
  return { highlights: out, relabeled, dropped }
}

function inferOppmoteFallbackFromNotes(notes: string[]): { time: string; label: string; type: TankestromScheduleHighlightType } | null {
  const text = notes.join('\n')
  const offsetMatch = /(\d{1,3})\s*min(?:utter|utt)?\s+f[øo]r\s+(?:kampstart|f[øo]rste\s+kamp|kamp)/i.exec(text)
  if (!offsetMatch) return null
  const offset = parseInt(offsetMatch[1]!, 10)
  if (!Number.isFinite(offset) || offset < 5 || offset > 180) return null
  const anchor = firstHmInText(text)
  if (!anchor || !isHm(anchor)) return null
  const t = minutesToHm(hmToMinutes(anchor) - offset)
  if (!t) return null
  return { time: t, label: 'Oppmøte', type: 'meeting' }
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

function buildSourceTextForValidation(
  explicit: string | undefined,
  rawNotes: string[],
  filteredNotes: string[]
): string {
  const parts = [explicit ?? '', ...rawNotes, ...filteredNotes]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  return parts.join('\n')
}

const NB_WEEKDAY_LONG = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'] as const
const NB_WEEKDAY_SHORT = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'] as const
const NB_MONTHS_LONG = [
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
] as const
const NB_MONTHS_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'mai',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'des',
] as const

function dayOfWeekFromIsoDate(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const [y, m, d] = isoDate.split('-').map((v) => parseInt(v, 10))
  if (!Number.isFinite(y!) || !Number.isFinite(m!) || !Number.isFinite(d!)) return null
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  if (Number.isNaN(dt.getTime())) return null
  return dt.getUTCDay()
}

type DayHeaderMatch = {
  start: number
  end: number
  weekdayIndex: number | null
  dayOfMonth: number
  monthIndex: number | null
}

const HEADER_WEEKDAY_ALT = [...NB_WEEKDAY_LONG, ...NB_WEEKDAY_SHORT].join('|')
const HEADER_MONTH_ALT = [...NB_MONTHS_LONG, ...NB_MONTHS_SHORT].join('|')

const STRICT_DAY_HEADER_RE = new RegExp(
  String.raw`(^|\n)[ \t]*` +
    String.raw`(?:(${HEADER_WEEKDAY_ALT})\.?\s*,?\s*)` +
    String.raw`(\d{1,2})\.?` +
    String.raw`(?:\s*(${HEADER_MONTH_ALT})\.?|\s*\.?\s*(\d{1,2})\.?)` +
    String.raw`(?:\s*\d{4})?\b`,
  'gi'
)

const DATE_ONLY_HEADER_RE = new RegExp(
  String.raw`(^|\n)[ \t]*` +
    String.raw`(\d{1,2})\.?` +
    String.raw`\s*(${HEADER_MONTH_ALT})\.?` +
    String.raw`(?:\s*\d{4})?\b`,
  'gi'
)

function weekdayIndexFromToken(token: string | undefined): number | null {
  if (!token) return null
  const t = token.toLowerCase().replace(/\.$/, '')
  for (let i = 0; i < NB_WEEKDAY_LONG.length; i++) {
    if (NB_WEEKDAY_LONG[i] === t) return i
  }
  for (let i = 0; i < NB_WEEKDAY_SHORT.length; i++) {
    if (NB_WEEKDAY_SHORT[i] === t) return i
  }
  return null
}

function monthIndexFromToken(token: string | undefined): number | null {
  if (!token) return null
  const t = token.toLowerCase().replace(/\.$/, '')
  for (let i = 0; i < NB_MONTHS_LONG.length; i++) {
    if (NB_MONTHS_LONG[i] === t) return i
  }
  for (let i = 0; i < NB_MONTHS_SHORT.length; i++) {
    if (NB_MONTHS_SHORT[i] === t) return i
  }
  return null
}

function collectDayHeaderMatches(text: string): DayHeaderMatch[] {
  const out: DayHeaderMatch[] = []
  STRICT_DAY_HEADER_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = STRICT_DAY_HEADER_RE.exec(text)) !== null) {
    const leadLen = (m[1] ?? '').length
    const weekdayIndex = weekdayIndexFromToken(m[2])
    const dom = parseInt(m[3]!, 10)
    if (!Number.isFinite(dom)) continue
    let monthIndex: number | null = null
    if (m[4]) {
      monthIndex = monthIndexFromToken(m[4])
    } else if (m[5]) {
      const num = parseInt(m[5], 10)
      if (Number.isFinite(num) && num >= 1 && num <= 12) monthIndex = num - 1
    }
    out.push({
      start: m.index + leadLen,
      end: STRICT_DAY_HEADER_RE.lastIndex,
      weekdayIndex,
      dayOfMonth: dom,
      monthIndex,
    })
  }
  if (out.length > 0) return out
  DATE_ONLY_HEADER_RE.lastIndex = 0
  while ((m = DATE_ONLY_HEADER_RE.exec(text)) !== null) {
    const leadLen = (m[1] ?? '').length
    const dom = parseInt(m[2]!, 10)
    const monthIndex = monthIndexFromToken(m[3])
    if (!Number.isFinite(dom) || monthIndex === null) continue
    out.push({
      start: m.index + leadLen,
      end: DATE_ONLY_HEADER_RE.lastIndex,
      weekdayIndex: null,
      dayOfMonth: dom,
      monthIndex,
    })
  }
  return out
}

/**
 * Henter ut én dagseksjon fra full kildetekst (norske dagoverskrifter).
 *
 * Brukes som en defensiv fallback for `sourceTextForValidation` når
 * segment-level notes/sourceText mangler i live-payload eller LLM-resultatet
 * ikke har dagsspesifikke notater. Returnerer kun seksjonen for den oppgitte
 * datoen — aldri den globale teksten ukritisk, for å unngå lekkasje av
 * tider mellom dager (f.eks. fredag 18:40 inn på søndag).
 *
 * Støtter overskrifter som:
 *  - «Fredag 12. juni»
 *  - «fredag 12. juni 2026»
 *  - «Fre 13. juni»
 *  - «Lørdag 13.6.»
 *  - «12. juni» (rent dato-fallback hvis ingen weekday-headers finnes)
 *
 * Hvis ingen passende dagsoverskrift finnes, returneres tom streng (slik at
 * kalleren kan beholde sin nåværende `sourceTextForValidation` uten endring).
 */
export function extractDaySectionForScheduleValidation(
  globalText: string | undefined,
  isoDate: string | undefined
): string {
  if (typeof globalText !== 'string' || !globalText.trim()) return ''
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return ''
  const text = globalText.replace(/\r\n/g, '\n')
  const [, mStr, dStr] = isoDate.split('-')
  const monthIndex = parseInt(mStr!, 10) - 1
  const dayOfMonth = parseInt(dStr!, 10)
  const weekdayIndex = dayOfWeekFromIsoDate(isoDate)
  if (!Number.isFinite(monthIndex) || !Number.isFinite(dayOfMonth)) return ''
  const headers = collectDayHeaderMatches(text)
  if (headers.length === 0) return ''
  const matchIdx = headers.findIndex((h) => {
    if (h.dayOfMonth !== dayOfMonth) return false
    if (h.monthIndex !== null && h.monthIndex !== monthIndex) return false
    if (h.weekdayIndex !== null && weekdayIndex !== null && h.weekdayIndex !== weekdayIndex) return false
    return true
  })
  if (matchIdx < 0) return ''
  const sectionStart = headers[matchIdx]!.start
  const sectionEnd = matchIdx + 1 < headers.length ? headers[matchIdx + 1]!.start : text.length
  return text.slice(sectionStart, sectionEnd).trim()
}

/**
 * Kombinerer eksplisitt segment-text og en evt. global kildetekst til
 * et trygt `sourceTextForValidation`-input. Ekstraherer kun den aktuelle
 * dagseksjonen fra global tekst — aldri hele blob-en — for å unngå
 * lekkasje mellom dager.
 */
export function buildPerDaySourceTextForValidation(opts: {
  segmentSourceText?: string
  globalSourceText?: string
  date?: string
}): string | undefined {
  const explicit = typeof opts.segmentSourceText === 'string' ? opts.segmentSourceText.trim() : ''
  const daySection = extractDaySectionForScheduleValidation(opts.globalSourceText, opts.date)
  const merged = [explicit, daySection].filter((s) => s.length > 0).join('\n\n')
  return merged.length > 0 ? merged : undefined
}

function padHmFromMatch(h: string, m: string): string {
  const hh = String(parseInt(h, 10)).padStart(2, '0')
  return `${hh}:${m}`
}

/** Rens en setning til en kort aktivitetstittel (uten tid/«kl.»/punktum). */
function extractLabelFromSentenceWithTime(sentence: string, time: string, fallback: string): string {
  let s = stripLeadingBullet(sentence)
  const escapedTime = time.replace(/[:]/g, '\\:')
  s = s.replace(new RegExp(`\\bkl\\.?\\s*${escapedTime}\\b`, 'gi'), ' ')
  s = s.replace(new RegExp(`\\b${escapedTime}\\b`, 'g'), ' ')
  s = s.replace(/\bkl\.?\b/gi, ' ')
  s = s.replace(/^[\s,;:.!?]+|[\s,;:.!?]+$/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  if (s.length === 0) return fallback
  if (s.length > 60) return fallback
  return s
}

/**
 * Konservativ rekonstruksjon: når kildeteksten tydelig nevner en aktivitet med klokkeslett
 * («Oppmøte kl. 17:45», «Første kamp 18:40»), kan vi gjenopprette manglende highlights
 * uten å fabrikkere nye labels. Kun setninger som starter med kamp/oppmøte-nøkkelord brukes,
 * og kun klokkeslett som ikke allerede finnes i highlights.
 */
export function augmentHighlightsFromSourceText(
  highlights: TankestromScheduleHighlight[],
  sourceText: string | undefined
): TankestromScheduleHighlight[] {
  const text = (sourceText ?? '').trim()
  if (!text) return highlights
  const sentences = splitSentencesNorwegian(text.replace(/\r\n/g, '\n'))
  const existingTimes = new Set(highlights.map((h) => h.time))
  const added: TankestromScheduleHighlight[] = []
  for (const sentenceRaw of sentences) {
    const sentence = stripLeadingBullet(sentenceRaw)
    const timeRe = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g
    let m: RegExpExecArray | null
    while ((m = timeRe.exec(sentence)) !== null) {
      const time = padHmFromMatch(m[1]!, m[2]!)
      if (existingTimes.has(time)) continue
      const leading = sentenceLeadingIntent(sentence)
      if (leading === 'oppmote') {
        const label = extractLabelFromSentenceWithTime(sentence, time, 'Oppmøte')
        added.push({ time, label, type: 'meeting' })
        existingTimes.add(time)
        continue
      }
      if (leading === 'kamp') {
        const kampLabel = pickKampLabelFromSource(time, sentence) ?? 'Kamp'
        added.push({ time, label: kampLabel, type: 'match' })
        existingTimes.add(time)
      }
    }
  }
  if (added.length === 0) return highlights
  return [...highlights, ...added].sort((a, b) => a.time.localeCompare(b.time))
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
  if (!isTankestromConsoleDebugEnabled()) return
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
  /** Defensiv starttid for fallback-highlight når upstream-highlights mangler. */
  fallbackStartTime?: string
  /** Kildetekst (samme dag/segment) brukt til å validere oppmøte-/kamp-labels mot kontekst. */
  sourceTextForValidation?: string
  /** Markerer foreløpige/uavklarte segmenter (f.eks. søndag i en cup) — strengere drop-policy. */
  isConditionalSegment?: boolean
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

  let bringItems = dedupeBringItemsList([...initialBring, ...fromNotes, ...liftedFromLists])

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

  const preValidationHighlights = [...dedup.values()]
    .filter((h) => normalizeTextKey(h.label) !== 'og')
    .sort((a, b) => a.time.localeCompare(b.time))

  const sourceTextForValidation = buildSourceTextForValidation(input.sourceTextForValidation, rawNotesIn, notes)
  const validated = correctMislabeledHighlightsAgainstSourceText(preValidationHighlights, sourceTextForValidation, {
    isConditionalSegment: input.isConditionalSegment === true,
  })
  const augmented = augmentHighlightsFromSourceText(validated.highlights, sourceTextForValidation)
  const highlights = augmented

  const canAddFallback =
    highlights.length === 0 &&
    timeWindowSummaries.length === 0 &&
    isHm(input.fallbackStartTime) &&
    !notes.some((n) => /mobiltelefoner skal ligge i bagen/i.test(n))
  if (canAddFallback) {
    const oppmoteFallback = inferOppmoteFallbackFromNotes(notes)
    if (oppmoteFallback) {
      highlights.push(oppmoteFallback)
    } else {
      const activity = inferFallbackActivityLabel(notes, titleContext)
      if (activity) {
        highlights.push({
          time: input.fallbackStartTime!.slice(0, 5),
          label: activity.label,
          type: activity.type,
        })
      }
    }
  }

  const bringPartition = partitionTankestromBringItemsForPreview(bringItems)
  bringItems = dedupeBringItemsList(bringPartition.concreteBring)
  if (bringPartition.divertToNotes.length > 0) {
    const noteKeys = new Set(notes.map((n) => normalizeTextKey(n)))
    for (const d of bringPartition.divertToNotes) {
      const dk = normalizeTextKey(d)
      if (!dk || noteKeys.has(dk)) continue
      notes.push(d)
      noteKeys.add(dk)
    }
  }
  notes = dedupeNotesAgainstHighlights(notes, highlights)

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
  titleContext?: string[],
  opts?: {
    fallbackStartTime?: string
    sourceTextForValidation?: string
    isConditionalSegment?: boolean
  }
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
    fallbackStartTime: opts?.fallbackStartTime,
    sourceTextForValidation: opts?.sourceTextForValidation,
    isConditionalSegment: opts?.isConditionalSegment,
  })
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

/** Én sammenhengende notattekst for kalender-persist (inkl. ta med / tidsvinduer). */
export function buildCalendarNotesFromNormalizedScheduleDetails(
  details: NormalizedTankestromScheduleDetails
): string {
  const chunks: string[] = []
  const body = buildTankestromScheduleDescriptionFallback(details.highlights, details.notes)
  if (body) chunks.push(body)
  if (details.bringItems.length > 0) {
    if (chunks.length > 0) chunks.push('')
    chunks.push('Ta med:')
    for (const b of details.bringItems) chunks.push(`- ${b}`)
  }
  if (details.timeWindowSummaries.length > 0) {
    if (chunks.length > 0) chunks.push('')
    chunks.push('Tidsvinduer:')
    for (const t of details.timeWindowSummaries) {
      const tent = t.tentative ? ' (foreløpig)' : ''
      const lab = t.label?.trim()
      chunks.push(`- ${t.timeRange}${lab ? ` ${lab}` : ''}${tent}`)
    }
  }
  return chunks.join('\n').trim()
}
