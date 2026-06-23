/**
 * Ren, testbar tilrettelegging for «oppdateringspreview v2»: grupperer kandidater til ÉN samlet
 * preview per arrangement, og oversetter teknisk diff til forståelige «Eksisterende»/«Ny»/«Endret»-
 * linjer. Endrer ingenting — kun presentasjon. Bygger ingen patch og lagrer ikke.
 */

import {
  formatDateRangeNb,
  type CalendarUpdateCandidate,
} from './tankestromCalendarUpdateCandidates'
import type { CalendarUpdateDiff } from './tankestromCalendarUpdateDiff'

export type UpdateCandidateGroup = {
  /** Stabil grupperingsnøkkel (arrangementStableKey → coreTitle → tittel). */
  key: string
  /** Arrangementnavn for visning (kanonisk når tilgjengelig). */
  title: string
  /** Samlet datointervall, f.eks. «12.–14. juni». */
  dateRangeLabel?: string
  /** Kandidatene i gruppen (én per eksisterende dag/hendelse), sortert på dato. */
  candidates: CalendarUpdateCandidate[]
}

function groupKeyOf(c: CalendarUpdateCandidate): string {
  if (c.stableKey && c.stableKey.trim()) return `key:${c.stableKey.trim()}`
  if (c.coreTitle && c.coreTitle.trim()) return `core:${c.coreTitle.trim().toLowerCase()}`
  return `title:${c.title.trim().toLowerCase()}`
}

/**
 * Grupperer kandidater som hører til samme arrangement (stableKey → coreTitle → tittel), slik at vi
 * viser ÉN samlet oppdateringspreview i stedet for flere like bokser. Bevarer rekkefølgen på første
 * forekomst; kandidatene i hver gruppe sorteres på dato.
 */
export function groupUpdateCandidates(candidates: CalendarUpdateCandidate[]): UpdateCandidateGroup[] {
  const order: string[] = []
  const byKey = new Map<string, CalendarUpdateCandidate[]>()
  for (const c of candidates) {
    const key = groupKeyOf(c)
    if (!byKey.has(key)) {
      byKey.set(key, [])
      order.push(key)
    }
    byKey.get(key)!.push(c)
  }
  return order.map((key) => {
    const items = byKey.get(key)!
    const sorted = [...items].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    const minDate = sorted.map((c) => c.date).filter(Boolean).sort()[0]
    const maxEnd = sorted
      .map((c) => c.endDate ?? c.date)
      .filter(Boolean)
      .sort()
      .slice(-1)[0]
    const dateRangeLabel = formatDateRangeNb(minDate, maxEnd)
    return {
      key,
      title: sorted[0]!.title,
      dateRangeLabel,
      candidates: sorted,
    }
  })
}

export type FriendlyDiffEntry = { kind: 'Ny' | 'Endret'; text: string }
export type FriendlyDiff = {
  /** Eksisterende info (svart tekst): gamle verdier + info som beholdes. */
  existing: string[]
  /** Ny/endret info (markeres tydelig): «Ny» = lagt til, «Endret» = ny verdi. */
  changes: FriendlyDiffEntry[]
  /** Valgfri usikkerhetsnote (f.eks. ulike notater). */
  note?: string
}

const FRIENDLY_LABEL: Record<string, string> = {
  Start: 'Starttid',
  Slutt: 'Sluttid',
  Sted: 'Sted',
  Notat: 'Notat',
  Tittel: 'Tittel',
}
function friendlyLabel(label: string): string {
  return FRIENDLY_LABEL[label] ?? label
}

/**
 * Oversetter en teknisk diff til forståelige linjer. «Dato»-endringer utelates bevisst fra
 * endringene — dagsgrupperingen formidler datoen, og en cross-day-match (f.eks. lørdag mot fredag)
 * skal ikke fremstå som en datoendring på samme element.
 */
export function friendlyDiffLines(diff: CalendarUpdateDiff): FriendlyDiff {
  const existing: string[] = []
  const changes: FriendlyDiffEntry[] = []
  for (const c of diff.changed) {
    if (c.label === 'Dato') continue
    existing.push(`${friendlyLabel(c.label)}: ${c.oldValue}`)
    changes.push({ kind: 'Endret', text: `${friendlyLabel(c.label)}: ${c.newValue}` })
  }
  for (const k of diff.kept) {
    existing.push(`${friendlyLabel(k.label)}: ${k.value}`)
  }
  for (const a of diff.added) {
    changes.push({ kind: 'Ny', text: `${friendlyLabel(a.label)}: ${a.value}` })
  }
  const note = diff.uncertain.length > 0 ? diff.uncertain[0]!.reason : undefined
  return { existing, changes, note }
}

export function friendlyDiffIsEmpty(fd: FriendlyDiff): boolean {
  return fd.existing.length === 0 && fd.changes.length === 0 && !fd.note
}
