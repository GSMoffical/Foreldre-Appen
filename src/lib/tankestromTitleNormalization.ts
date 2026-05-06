type EventLikeForTitleNormalization = {
  start?: string
  end?: string
}

const DAY_WORD =
  '(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|sondag|søndag|man|tir|ons|tor|fre|lor|lør|son|søn)'
const MONTH_WORD =
  '(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)'

const DATE_PATTERNS: RegExp[] = [
  new RegExp(`\\b${DAY_WORD}\\.?\\s+\\d{1,2}\\.\\s+${MONTH_WORD}(?:\\s+\\d{4})?\\b`, 'giu'),
  /\b\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+\d{4})?\b/giu,
  /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/gu,
]

const STATUS_WORDS = /\b(?:foreløpig|forelopig|usikker|betinget|mulig)\b/giu
const TIME_TOKEN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g

function normalizeSeparators(s: string): string {
  return s
    .replace(/\s*[·|]\s*/g, ' · ')
    .replace(/\s*[–—-]\s*/g, ' – ')
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

