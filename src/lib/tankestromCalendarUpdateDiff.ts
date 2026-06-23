/**
 * Ren, testbar read-only diff mellom et Tankestrøm-importforslag og en eksisterende kalenderhendelse.
 * Kun for visning: bygger INGEN patch-data, lagrer ingenting, og sletter aldri gammel info.
 *
 * Regler (konservativt):
 *  - ny verdi som avviker fra gammel → `changed`
 *  - ny verdi der gammel mangler → `added`
 *  - gammel verdi som det nye forslaget ikke nevner → `kept` (beholdes, slettes aldri)
 *  - like verdier utelates (holder UI kompakt)
 *  - notater: ulike notater → `uncertain` (erstatter aldri automatisk)
 *  - tittel: kun `changed` når den er tydelig forskjellig (ingen felles kjerneord)
 */

export type DiffEventLike = {
  title?: string
  /** YYYY-MM-DD */
  date?: string
  /** HH:mm */
  start?: string
  /** HH:mm */
  end?: string
  location?: string
  notes?: string
}

export type CalendarUpdateDiffChange = { label: string; oldValue: string; newValue: string }
export type CalendarUpdateDiffAdd = { label: string; value: string }
export type CalendarUpdateDiffKeep = { label: string; value: string }
export type CalendarUpdateDiffUncertain = {
  label: string
  reason: string
  oldValue?: string
  newValue?: string
}

export type CalendarUpdateDiff = {
  changed: CalendarUpdateDiffChange[]
  added: CalendarUpdateDiffAdd[]
  kept: CalendarUpdateDiffKeep[]
  uncertain: CalendarUpdateDiffUncertain[]
}

const MONTHS_NB = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]
const STOPWORDS = new Set(['og', 'i', 'på', 'for', 'med', 'til', 'den', 'det', 'en', 'et', 'av'])

function trimmed(s?: string): string {
  return (s ?? '').trim()
}
function timeVal(t?: string): string {
  const s = trimmed(t)
  return s ? s.slice(0, 5) : ''
}
function looseEqual(a?: string, b?: string): boolean {
  return trimmed(a).toLowerCase() === trimmed(b).toLowerCase()
}

function formatDateNb(d?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed(d))
  if (!m) return trimmed(d)
  return `${Number(m[3])}. ${MONTHS_NB[Number(m[2]) - 1]}`
}

function tokens(s: string): Set<string> {
  const out = new Set<string>()
  for (const tok of s.toLowerCase().replace(/[^a-z0-9æøå]+/g, ' ').split(' ')) {
    if (tok.length >= 2 && !STOPWORDS.has(tok)) out.add(tok)
  }
  return out
}
function shareSignificantToken(a: string, b: string): boolean {
  const ta = tokens(a)
  for (const t of tokens(b)) if (ta.has(t)) return true
  return false
}

/** Skalarfelt: changed (ulik), added (ny mangler gammel), kept (gammel beholdes). Like utelates. */
function diffScalar(
  diff: CalendarUpdateDiff,
  label: string,
  oldRaw: string | undefined,
  newRaw: string | undefined,
  display: (v: string) => string,
  equal: (a: string, b: string) => boolean
): void {
  const oldT = trimmed(oldRaw)
  const newT = trimmed(newRaw)
  const oldHas = oldT.length > 0
  const newHas = newT.length > 0
  if (newHas && oldHas) {
    if (!equal(oldT, newT)) diff.changed.push({ label, oldValue: display(oldT), newValue: display(newT) })
  } else if (newHas && !oldHas) {
    diff.added.push({ label, value: display(newT) })
  } else if (!newHas && oldHas) {
    diff.kept.push({ label, value: display(oldT) })
  }
}

export function buildCalendarUpdateDiff(input: {
  proposalEvent: DiffEventLike
  existingEvent: DiffEventLike
}): CalendarUpdateDiff {
  const { proposalEvent: next, existingEvent: old } = input
  const diff: CalendarUpdateDiff = { changed: [], added: [], kept: [], uncertain: [] }

  diffScalar(diff, 'Dato', old.date, next.date, formatDateNb, (a, b) => a === b)
  diffScalar(diff, 'Start', old.start, next.start, timeVal, (a, b) => timeVal(a) === timeVal(b))
  diffScalar(diff, 'Slutt', old.end, next.end, timeVal, (a, b) => timeVal(a) === timeVal(b))
  diffScalar(diff, 'Sted', old.location, next.location, (v) => v, looseEqual)

  // Tittel: kun «endret» når tydelig forskjellig (ingen felles kjerneord). Ellers utelatt/beholdt.
  const oldTitle = trimmed(old.title)
  const newTitle = trimmed(next.title)
  if (oldTitle && newTitle) {
    if (!looseEqual(oldTitle, newTitle) && !shareSignificantToken(oldTitle, newTitle)) {
      diff.changed.push({ label: 'Tittel', oldValue: oldTitle, newValue: newTitle })
    }
  } else if (newTitle && !oldTitle) {
    diff.added.push({ label: 'Tittel', value: newTitle })
  } else if (!newTitle && oldTitle) {
    diff.kept.push({ label: 'Tittel', value: oldTitle })
  }

  // Notater: konservativt — erstatt aldri automatisk; ulike notater er «usikkert».
  const oldNotes = trimmed(old.notes)
  const newNotes = trimmed(next.notes)
  if (newNotes && !oldNotes) {
    diff.added.push({ label: 'Notat', value: newNotes })
  } else if (newNotes && oldNotes) {
    if (!looseEqual(oldNotes, newNotes)) {
      diff.uncertain.push({
        label: 'Notat',
        reason: 'Nytt forslag har andre notater — gammel tekst beholdes.',
        oldValue: oldNotes,
        newValue: newNotes,
      })
    }
  } else if (!newNotes && oldNotes) {
    diff.kept.push({ label: 'Notat', value: oldNotes })
  }

  return diff
}

export function calendarUpdateDiffIsEmpty(diff: CalendarUpdateDiff): boolean {
  return (
    diff.changed.length === 0 &&
    diff.added.length === 0 &&
    diff.kept.length === 0 &&
    diff.uncertain.length === 0
  )
}
