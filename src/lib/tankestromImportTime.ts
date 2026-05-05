/**
 * Normaliserer klokkeslett fra Tankestrøm (HH:mm eller ISO datetime).
 * Returnerer null ved manglende/ukjent verdi — ingen automatisk sluttid.
 */
export function normalizeImportTime(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const s = String(value).trim()
  if (!s) return null

  if (/^\d{2}:\d{2}$/.test(s)) {
    return s
  }

  const isoMatch = s.match(/T(\d{2}:\d{2})/)
  if (isoMatch) {
    return isoMatch[1]!
  }

  return null
}

/** Rå felt fra JSON (null/undefined/tom streng → undefined). */
export function rawEventTimeInput(x: unknown): string | undefined {
  if (x === undefined || x === null) return undefined
  if (typeof x !== 'string') return undefined
  const t = x.trim()
  return t.length > 0 ? t : undefined
}
