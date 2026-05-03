/**
 * Kort «ukens særpreg» for skoleuke-/A-plan-overlay i review.
 * Mønsterbasert — ingen full analysemotor; viser ingenting når signalene er svake.
 */

const MIN_SCORE_TO_SHOW = 6
const STRONG_SPECIAL_SCORE = 8

export type SchoolWeekOverlayReviewSpecialDayInput = {
  summary?: string | null
  reason?: string | null
  sectionLines: string[]
}

export type DeriveSchoolWeekSpecialSummaryInput = {
  weeklyCondensedLines: string[]
  perDay: SchoolWeekOverlayReviewSpecialDayInput[]
}

export type SchoolWeekSpecialSummaryResult = {
  text: string | null
  /** Faktisk vist tekst */
  rendered: boolean
  /** Minst én linje traff mønster over terskel for visning */
  highlightFound: boolean
  /** Hadde tekstmateriale å vurdere, men ingen linje var sterk nok til å vises */
  suppressedAsWeak: boolean
  /** «Tydelig» hendelse (tentamen, tur, svømming, osv.) */
  specialEventMatched: boolean
  /** Høyeste råscore blant alle kandidatlinjer (uten uke-boost) */
  maxRawScore: number
}

function normLine(s: string): string {
  return s.trim().toLocaleLowerCase('nb-NO').replace(/\s+/g, ' ')
}

function looksLikeAdminOrPortalNoise(t: string): boolean {
  return /fravær|kontaktlærer|skolearena|foresatte|innlogging|itslearning|fronter|sfo\b|møteplikt/i.test(t)
}

function clipLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

/** Rå score 0 = irrelevant eller støy */
export function scoreSchoolWeekSpecialLine(text: string): number {
  const t = normLine(text)
  if (t.length < 8) return 0
  if (looksLikeAdminOrPortalNoise(t)) return 0

  let s = 0
  if (/\btentamen\b|nasjonale\s+prøver|heldagsprøve|heldags\s*prøve/i.test(t)) s = Math.max(s, 12)
  if (/\bprøve\b|kartlegging|vurderingsdag|vurdering\s+dag|heldag/i.test(t)) s = Math.max(s, 8)
  if (/\btur(?:dag)?\b|utflukt|ekskursjon|klassetur|museum|besøk\s+(?:på|til|hos)/i.test(t)) s = Math.max(s, 9)
  if (/svøm|basseng|badepass|svømme/i.test(t)) s = Math.max(s, 8)
  if (/\bbåt\b|kajakk|robåt|padle|kanot/i.test(t)) s = Math.max(s, 7)
  if (/forberedelsesdag|temadag|prosjektuke|kulturdag|idrettsdag|åpen\s+skole|temauke/i.test(t)) s = Math.max(s, 8)
  if (/\bfri\b|fridag|planleggingsdag|kompedag|veisatt|fri\s+fra\s+skolen/i.test(t)) s = Math.max(s, 7)
  if (/avvik|endret\s+(?:time|timeplan)|tidlig\s*hem|særskilt|omorganisert|endring\s+i\s+timeplan/i.test(t))
    s = Math.max(s, 6)
  if (/foreldresamtale|foreldremøte|skolekonferanse|utviklingssamtale/i.test(t)) s = Math.max(s, 7)

  return s
}

function linesDuplicate(a: string, b: string): boolean {
  const na = normLine(a)
  const nb = normLine(b)
  if (!na || !nb) return na === nb
  if (na === nb) return true
  if (na.length < 10 || nb.length < 10) return false
  return na.includes(nb) || nb.includes(na)
}

type ScoredLine = { text: string; score: number; rawScore: number }

function pickSummaryLines(scored: ScoredLine[]): string | null {
  const ok = scored.filter((x) => x.score >= MIN_SCORE_TO_SHOW).sort((a, b) => b.score - a.score || b.text.length - a.text.length)
  if (ok.length === 0) return null

  const chosen: ScoredLine[] = []
  for (const cand of ok) {
    if (chosen.some((c) => linesDuplicate(c.text, cand.text))) continue
    chosen.push(cand)
    if (chosen.length >= 2) break
  }
  if (chosen.length === 0) return null
  return chosen.map((c) => clipLine(c.text, 115)).join(' · ')
}

export function deriveSchoolWeekSpecialSummary(input: DeriveSchoolWeekSpecialSummaryInput): SchoolWeekSpecialSummaryResult {
  const scored: ScoredLine[] = []
  let maxRawScore = 0

  const pushLine = (raw: string, weeklyBoost: boolean) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    const rawScore = scoreSchoolWeekSpecialLine(trimmed)
    maxRawScore = Math.max(maxRawScore, rawScore)
    if (rawScore <= 0) return
    const score = rawScore + (weeklyBoost ? 0.75 : 0)
    scored.push({ text: trimmed, score, rawScore })
  }

  for (const line of input.weeklyCondensedLines) {
    pushLine(line, true)
  }

  let sectionBudget = 48
  for (const day of input.perDay) {
    if (day.summary?.trim()) pushLine(day.summary, false)
    if (day.reason?.trim()) pushLine(day.reason, false)
    for (const sl of day.sectionLines) {
      if (sectionBudget <= 0) break
      sectionBudget -= 1
      pushLine(sl, false)
    }
  }

  const hadMaterial =
    input.weeklyCondensedLines.some((l) => l.trim().length > 0) ||
    input.perDay.some(
      (d) =>
        Boolean(d.summary?.trim()) ||
        Boolean(d.reason?.trim()) ||
        d.sectionLines.some((l) => l.trim().length > 0)
    )

  const text = pickSummaryLines(scored)
  const rendered = Boolean(text)
  const specialEventMatched = maxRawScore >= STRONG_SPECIAL_SCORE
  const highlightFound = maxRawScore >= MIN_SCORE_TO_SHOW
  const suppressedAsWeak = hadMaterial && !rendered

  return {
    text,
    rendered,
    highlightFound,
    suppressedAsWeak,
    specialEventMatched,
    maxRawScore,
  }
}
