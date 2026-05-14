/**
 * Semantic note deduplication for Tankestrøm import.
 *
 * Notes arrive from multiple sources (parent notes, segment notes, evidence
 * questions, child presentation) and often repeat the same information
 * with slightly different wording, punctuation, or casing.
 */

const HM24_RE = /\b([01]\d|2[0-3]):[0-5]\d\b/g
const DATE_LIKE_RE = /\b\d{1,2}\.\s*(?:jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)\w*\b/gi

/**
 * Normalize a note line for dedup comparison.
 * Strips punctuation, whitespace, casing, and Norwegian diacritics,
 * but preserves concrete times and date fragments so they remain distinct.
 */
function normalizeNoteKey(s: string): string {
  return s
    .toLocaleLowerCase('nb-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/å/g, 'a')
    .replace(/[.,:;!?…–—"«»()\[\]{}'`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract concrete time tokens (HH:MM) for "same meaning but different times"
 * protection: two lines with different concrete times should never be deduped.
 */
function extractTimes(s: string): string[] {
  return [...s.matchAll(HM24_RE)].map((m) => m[0])
}

function extractDates(s: string): string[] {
  return [...s.matchAll(DATE_LIKE_RE)].map((m) => m[0].toLowerCase().replace(/\s+/g, ''))
}

/**
 * Jaccard word-level similarity.
 * Returns 0..1 where 1 = identical word sets.
 */
function wordJaccard(a: string, b: string): number {
  const wa = new Set(a.split(' ').filter((w) => w.length > 2))
  const wb = new Set(b.split(' ').filter((w) => w.length > 2))
  if (wa.size === 0 && wb.size === 0) return 1
  if (wa.size === 0 || wb.size === 0) return 0
  let inter = 0
  for (const w of wa) if (wb.has(w)) inter++
  const union = wa.size + wb.size - inter
  if (union < 3 && inter < 2) return 0
  return inter / union
}

/**
 * Check if one normalized key is a significant substring of the other.
 * Catches cases like "Sluttspillkamp søndag" vs "Eventuell sluttspillkamp søndag formiddag".
 */
function isSignificantSubstring(shorter: string, longer: string): boolean {
  if (shorter.length < 8) return false
  return longer.includes(shorter)
}

/**
 * Test whether two notes are semantically near-duplicate.
 * Conservative: preserves lines with different concrete times or dates.
 */
function areSemanticallyNearDuplicate(normA: string, normB: string, rawA: string, rawB: string): boolean {
  if (normA === normB) return true

  const timesA = extractTimes(rawA)
  const timesB = extractTimes(rawB)
  if (timesA.length > 0 && timesB.length > 0) {
    const setA = new Set(timesA)
    const setB = new Set(timesB)
    const allShared = [...setA].every((t) => setB.has(t)) || [...setB].every((t) => setA.has(t))
    if (!allShared) return false
  }

  const datesA = extractDates(rawA)
  const datesB = extractDates(rawB)
  if (datesA.length > 0 && datesB.length > 0) {
    const shared = datesA.some((d) => datesB.includes(d))
    if (!shared && datesA.join() !== datesB.join()) return false
  }

  if (isSignificantSubstring(normA, normB) || isSignificantSubstring(normB, normA)) return true

  const jaccard = wordJaccard(normA, normB)
  return jaccard >= 0.7
}

/**
 * Deduplicate an array of note lines, preserving order (first occurrence wins).
 *
 * Handles:
 * - Exact duplicates (after normalization)
 * - Same sentence with/without trailing punctuation
 * - Near-duplicate sentences about tentative/sluttspill info
 * - Does NOT merge lines with different concrete times
 * - Does NOT merge lines with different concrete dates
 */
export function dedupeTankestromNotes(lines: readonly string[]): string[] {
  const accepted: Array<{ raw: string; norm: string }> = []

  for (const raw of lines) {
    const trimmed = raw.replace(/\r\n/g, '\n').trim()
    if (trimmed.length < 2) continue
    const norm = normalizeNoteKey(trimmed)
    if (!norm) continue

    const isDuplicate = accepted.some((prev) =>
      areSemanticallyNearDuplicate(prev.norm, norm, prev.raw, trimmed)
    )
    if (isDuplicate) continue

    accepted.push({ raw: trimmed, norm })
  }

  return accepted.map((a) => a.raw)
}
