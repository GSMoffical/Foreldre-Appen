type EventLikeForTitleNormalization = {
  start?: string
  end?: string
}

const DAY_WORD =
  '(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|sondag|søndag|man|tir|ons|tor|fre|lor|lør|son|søn)'
const MONTH_WORD =
  '(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)'

// `(?!-\p{L})`: ikke fjern en dato som er limt til et ord med bindestrek (sammensatt navn),
// f.eks. «17. mai-frokost» eller «12. juni-festen» — der er datoen del av tittelen.
const DATE_PATTERNS: RegExp[] = [
  new RegExp(`\\b${DAY_WORD}\\.?\\s+\\d{1,2}\\.\\s+${MONTH_WORD}(?:\\s+\\d{4})?\\b(?!-\\p{L})`, 'giu'),
  /\b\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+\d{4})?\b(?!-\p{L})/giu,
  /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b(?!-\p{L})/gu,
]

/** Fulle ukedager (brukt for relative datofraser i enkelthendelse-titler). */
const REL_DAY = '(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|lordag|søndag|sondag)'

/**
 * Uttvetydige relative datofraser som aldri er del av et arrangementnavn:
 * «i morgen», «i kveld/dag/natt», «til helga/helgen», «(neste|forrige) <ukedag>», «på <ukedag>».
 */
const RELATIVE_DATE_PHRASE = new RegExp(
  `\\b(?:i\\s*morgen|imorgen|i\\s*kveld|ikveld|i\\s*dag|idag|i\\s*natt|til\\s+helg(?:a|en|å)|(?:neste|forrige|påfølgende)\\s+${REL_DAY}|på\\s+${REL_DAY})\\b`,
  'giu'
)

/** «kl 18», «kl. 17:30», «kl 18.30» — klokkeslett med kl-markør. */
const KL_TIME = /\bkl\.?\s*\d{1,2}(?:[:.]\d{2})?\b/giu

/** Hale av en bar ukedag på slutten av tittelen (f.eks. «… lørdag»). */
const TRAILING_DAY = new RegExp(`\\s+${REL_DAY}\\s*$`, 'iu')

/**
 * Konservativ opprydding av relative datoord og «kl <tid>» i en enkelthendelse-tittel når
 * dato/tid allerede er tolket til egne felter. Returnerer '' kun når hele tittelen var
 * dato/tid (kaller får da falle tilbake til original). Fjerner ALDRI sted eller etablerte
 * navn-deler — kun uttvetydige relative fraser, «kl <tid>», og en hale av bar ukedag.
 */
export function stripResolvedRelativeDateTimeFromTitle(title: string): string {
  let out = (title ?? '').replace(KL_TIME, ' ').replace(RELATIVE_DATE_PHRASE, ' ')
  let prev: string
  do {
    prev = out
    out = out.replace(TRAILING_DAY, ' ')
  } while (out !== prev)
  out = out
    .replace(/\s+(?:på|kl\.?|den)\s*$/iu, ' ') // hengende preposisjon/«kl» til slutt
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.;:–—-]+/u, '')
    .replace(/[\s,.;:–—-]+$/u, '')
    .trim()
  return out
}

const STATUS_WORDS = /\b(?:foreløpig|forelopig|usikker|betinget|mulig)\b/giu
const TIME_TOKEN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g

function normalizeSeparators(s: string): string {
  return s
    .replace(/\s*[·|]\s*/g, ' · ')
    // Kun bindestrek/tankestrek som ALLEREDE er en separator (mellomrom på begge sider) –
    // ikke en limt sammensetning som «17. mai-frokost» eller «Uke 42-planlegging».
    .replace(/\s+[–—-]\s+/g, ' – ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function dedupeDotSegments(s: string): string {
  const parts = s
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const key = part
      .toLocaleLowerCase('nb-NO')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\.$/g, '')
      .trim()
    if (!key || /^[()\/\s\-.\u2026]+$/u.test(key)) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(part)
  }
  return out.join(' · ')
}

function stripParensNoise(s: string): string {
  return s
    .replace(/\((?:[^)]*?(?:foreløpig|forelopig|usikker|betinget|mulig)[^)]*?)\)/giu, '')
    .replace(/\(\s*[/.\s…-]*\)/gu, '')
    .replace(/\(\s*\)/g, '')
}

function maybeNormalizeFlightRoute(title: string): string {
  const m = /^flyreise\s+(.+?)\s+til\s+(.+?)$/iu.exec(title.trim())
  if (!m) return title
  const origin = m[1]!.trim().replace(/\s+[–—-].*$/u, '')
  const destination = m[2]!.trim().replace(/\s+[–—-].*$/u, '')
  if (!origin || !destination) return title
  return `Flyreise ${origin}–${destination}`
}

function timeMatchesEventClock(time: string, event: EventLikeForTitleNormalization): boolean {
  const t = time.slice(0, 5)
  const start = typeof event.start === 'string' ? event.start.slice(0, 5) : ''
  const end = typeof event.end === 'string' ? event.end.slice(0, 5) : ''
  return t === start || t === end
}

export function normalizeCalendarEventTitle(
  title: string,
  event: EventLikeForTitleNormalization = {}
): string {
  let out = title.trim()
  if (!out) return title

  out = stripParensNoise(out)
  for (const re of DATE_PATTERNS) out = out.replace(re, '')
  out = out.replace(STATUS_WORDS, '')
  out = out.replace(/\bkl\.?\b/giu, '')
  out = out.replace(TIME_TOKEN, (m) => (timeMatchesEventClock(m, event) ? '' : m))
  out = out
    .replace(/\s*(?:\/|,)\s*(?:\/|,)\s*/g, ' ')
    .replace(/\s*·\s*(?:·\s*)+/g, ' · ')
    .replace(/\s*[–—-]\s*(?:[–—-]\s*)+/g, ' – ')
    .replace(/\s+[-–—·/]\s*$/g, '')
    .replace(/\.\s*$/g, '')
  out = normalizeSeparators(out)
  out = out.replace(/([–—-]\s*(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag))\s*·\s*\2\b/iu, '$1')
  out = dedupeDotSegments(out)
  out = maybeNormalizeFlightRoute(out)
  out = out.replace(/\s+[-–—·/]\s*$/g, '').trim()
  return out.length > 0 ? out : title.trim()
}

/**
 * Kalendertrygg tittel for ENKELTHENDELSER: fjerner relative datoord og «kl <tid>» når
 * dato/tid allerede ligger i egne felter, og kjører deretter den vanlige normaliseringen.
 * Faller tilbake til vanlig normalisering av originalen hvis oppryddingen ville tømt tittelen
 * (f.eks. «I morgen kl 18» → ikke tom). Brukes IKKE på cup/embedded-titler (der er ukedagen
 * en meningsbærende etikett).
 */
export function normalizeSingleEventCalendarTitle(
  title: string,
  event: EventLikeForTitleNormalization = {}
): string {
  const stripped = stripResolvedRelativeDateTimeFromTitle(title)
  if (stripped.trim().length < 2) {
    return normalizeCalendarEventTitle(title, event)
  }
  return normalizeCalendarEventTitle(stripped, event)
}

