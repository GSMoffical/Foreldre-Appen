/**
 * Ren, testbar kandidatmatching for Tankestrøm-import: finn eksisterende kalenderhendelser som et
 * importforslag KAN være en oppdatering til. Kun for visning — beregner ingen diff, oppdaterer
 * ingenting, og sender ingenting til Tankestrømmen. Konservativ: heller «mulig kandidat» enn å
 * auto-velge feil.
 */

export type CalendarMatchQuery = {
  title: string
  /** YYYY-MM-DD (start/anker). */
  date?: string
  /** YYYY-MM-DD (slutt på datoområde). */
  endDate?: string
  personId?: string | null
  location?: string
  /** arrangementStableKey hvis forslaget har en (tidligere import). */
  stableKey?: string
}

export type ExistingCalendarItem = {
  id: string
  title: string
  /** Kanonisk arrangementnavn (metadata.arrangementCoreTitle). Foretrekkes for VISNING. */
  coreTitle?: string
  date?: string
  endDate?: string
  personId?: string | null
  location?: string
  stableKey?: string
}

export type CalendarUpdateConfidence = 'low' | 'medium' | 'high'

export type CalendarUpdateCandidate = {
  id: string
  title: string
  date?: string
  endDate?: string
  /** Ferdig formatert norsk dato/datoområde, f.eks. «12.–13. april». */
  dateLabel?: string
  score: number
  confidence: CalendarUpdateConfidence
  /** Korte match-signaler, f.eks. ['tittel', 'dato']. */
  signals: string[]
  /** Kort forklaring, f.eks. «Matchet på tittel og dato». */
  explanation: string
}

const STOPWORDS = new Set(['og', 'i', 'på', 'for', 'med', 'til', 'den', 'det', 'en', 'et', 'av', 'hos', 'ved'])
const MONTHS_NB = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]

function normalize(s: string): string {
  // Behold norske bokstaver (æ/ø/å) som egne tegn; map vanlige aksenter; fjern øvrig tegnsetting.
  return s
    .toLowerCase()
    .replace(/[äàáâã]/g, 'a')
    .replace(/[öóòôõ]/g, 'o')
    .replace(/[éèêë]/g, 'e')
    .replace(/[üúùû]/g, 'u')
    .replace(/[íìî]/g, 'i')
    .replace(/[^a-z0-9æøå]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function significantTokens(s: string): Set<string> {
  const out = new Set<string>()
  for (const tok of normalize(s).split(' ')) {
    if (tok.length >= 2 && !STOPWORDS.has(tok)) out.add(tok)
  }
  return out
}

/** Token-Jaccard med liten boost når den minste tittelen er en delmengde av den største. */
function titleSimilarity(a: string, b: string): number {
  const ta = significantTokens(a)
  const tb = significantTokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  if (shared === 0) return 0
  const union = ta.size + tb.size - shared
  const jaccard = shared / union
  const minSize = Math.min(ta.size, tb.size)
  return shared === minSize ? Math.max(jaccard, 0.55) : jaccard
}

function dayIndex(d?: string): number | null {
  if (!d) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000
}

/** 0 ved overlapp, ellers minste avstand i dager mellom de to datoområdene. */
function rangeGapDays(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  if (aEnd < bStart) return bStart - aEnd
  if (bEnd < aStart) return aStart - bEnd
  return 0
}

function dateScoreFor(q: CalendarMatchQuery, e: ExistingCalendarItem): number {
  const aS = dayIndex(q.date)
  const bS = dayIndex(e.date)
  if (aS == null || bS == null) return 0
  const aE = dayIndex(q.endDate) ?? aS
  const bE = dayIndex(e.endDate) ?? bS
  const gap = rangeGapDays(aS, aE, bS, bE)
  if (gap === 0) return 1
  if (gap <= 1) return 0.7
  if (gap <= 3) return 0.5
  if (gap <= 7) return 0.25
  return 0
}

function locationMatches(a?: string, b?: string): boolean {
  if (!a || !b) return false
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

function parseYmd(d?: string): { y: number; m: number; d: number } | null {
  if (!d) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

function formatDateRangeNb(date?: string, endDate?: string): string | undefined {
  const s = parseYmd(date)
  if (!s) return undefined
  const e = parseYmd(endDate)
  if (!e || (e.y === s.y && e.m === s.m && e.d === s.d)) return `${s.d}. ${MONTHS_NB[s.m - 1]}`
  if (e.y === s.y && e.m === s.m) return `${s.d}.–${e.d}. ${MONTHS_NB[s.m - 1]}`
  return `${s.d}. ${MONTHS_NB[s.m - 1]} – ${e.d}. ${MONTHS_NB[e.m - 1]}`
}

function joinNb(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}`
}

function confidenceFor(score: number): CalendarUpdateConfidence {
  if (score >= 0.7) return 'high'
  if (score >= 0.5) return 'medium'
  return 'low'
}

const MAX_CANDIDATES = 3
const MIN_TITLE_SIM = 0.34
const MIN_SCORE = 0.4

/**
 * Returnerer 0–3 mulige eksisterende kalenderkandidater for et importforslag, sortert etter score.
 * Endrer ikke input. Tittel-likhet (eller felles stabil nøkkel) er en nødvendig gate, slik at vi
 * ikke foreslår tilfeldige hendelser bare fordi de er på samme dato.
 */
export function findCalendarUpdateCandidates(
  query: CalendarMatchQuery,
  existing: ExistingCalendarItem[]
): CalendarUpdateCandidate[] {
  const scored: CalendarUpdateCandidate[] = []

  for (const e of existing) {
    const titleSim = titleSimilarity(query.title, e.title)
    const strongRef = !!query.stableKey && !!e.stableKey && query.stableKey === e.stableKey
    if (!strongRef && titleSim < MIN_TITLE_SIM) continue

    const dateScore = dateScoreFor(query, e)
    const personMatch = !!query.personId && !!e.personId && query.personId === e.personId
    const locMatch = locationMatches(query.location, e.location)

    let score =
      0.55 * titleSim + 0.3 * dateScore + (personMatch ? 0.1 : 0) + (locMatch ? 0.05 : 0)
    if (strongRef) score = Math.max(score, 0.9)
    if (score < MIN_SCORE) continue

    const signals: string[] = []
    if (strongRef) signals.push('tidligere import')
    if (titleSim >= MIN_TITLE_SIM) signals.push('tittel')
    if (dateScore > 0) signals.push('dato')
    if (personMatch) signals.push('person')
    if (locMatch) signals.push('sted')

    scored.push({
      id: e.id,
      // Vis kanonisk arrangementnavn når det finnes (matching bruker fortsatt e.title).
      title: (e.coreTitle && e.coreTitle.trim()) || e.title,
      date: e.date,
      endDate: e.endDate,
      dateLabel: formatDateRangeNb(e.date, e.endDate),
      score: Math.round(score * 100) / 100,
      confidence: confidenceFor(score),
      signals,
      explanation: signals.length > 0 ? `Matchet på ${joinNb(signals)}` : 'Mulig kobling',
    })
  }

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'nb') || a.id.localeCompare(b.id))
  return scored.slice(0, MAX_CANDIDATES)
}
