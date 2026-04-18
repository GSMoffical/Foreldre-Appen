/**
 * Migreringsfri kobling fra et event til barnets fag/time.
 * Matching er read-time: vi sammenligner `event.metadata.schoolContext` mot dagens
 * `ChildSchoolDayPlan.lessons` — ingen lagret lesson-id, ingen FK.
 *
 * v2: score-basert matcher med alias-normalisering og `subjectCandidates`-støtte.
 */
import type {
  ChildSchoolDayPlan,
  Event,
  NorwegianGradeBand,
  PersonId,
  SchoolContext,
  SchoolContextCandidate,
  SchoolDayOverride,
  SchoolDayOverrideKind,
  SchoolDayOverrideMode,
  SchoolItemType,
  SchoolLessonSlot,
} from '../types'
import { CUSTOM_SUBJECT_KEY, subjectLabelForKey } from '../data/norwegianSubjects'

/** Pakk ut `schoolContext` fra et event hvis det er et objekt. */
export function extractSchoolContext(event: Event): SchoolContext | null {
  const meta = event.metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const ctx = (meta as { schoolContext?: unknown }).schoolContext
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) return null
  const candidate = ctx as Partial<SchoolContext>
  if (typeof candidate.itemType !== 'string') return null
  return candidate as SchoolContext
}

// -------------------------------------------------------------------------------------
// Alias + normalisering
// -------------------------------------------------------------------------------------

/**
 * Maps folkenavn og fag-varianter til en katalog-`subjectKey`.
 * Alle nøkler er normaliserte (lowercase, uten diakritikk, underscore for mellomrom).
 * Språk → 'fremmedspråk': tiebreaker gjøres deretter via `customLabel`.
 */
export const SUBJECT_ALIAS: Record<string, string> = {
  // Språk → generisk fremmedspråk (matcher beholdes via customLabel "Spansk"/"Tysk"/...)
  spansk: 'fremmedspråk',
  tysk: 'fremmedspråk',
  fransk: 'fremmedspråk',
  russisk: 'fremmedspråk',
  italiensk: 'fremmedspråk',
  mandarin: 'fremmedspråk',
  kinesisk: 'fremmedspråk',
  japansk: 'fremmedspråk',
  samisk: 'fremmedspråk',
  arabisk: 'fremmedspråk',

  // Folkenavn
  matte: 'matematikk',
  matematikk: 'matematikk',
  gym: 'kroppsøving',
  kroppsoving: 'kroppsøving',
  krop: 'kroppsøving',
  mat_og_helse: 'mat_helse',
  mathelse: 'mat_helse',

  // KRLE-varianter
  kristendom: 'krle',
  religion: 'krle',
  rle: 'krle',
  krle: 'krle',

  // Kunst/håndverk-varianter
  kunst: 'kunst_håndverk',
  handverk: 'kunst_håndverk',
  kunst_og_handverk: 'kunst_håndverk',

  // VG programfag → generisk (tiebreaker via customLabel)
  fysikk: 'programfag',
  kjemi: 'programfag',
  biologi: 'programfag',
  geografi_pf: 'programfag',
  matematikk_r: 'programfag',
  matematikk_r1: 'programfag',
  matematikk_r2: 'programfag',
  matematikk_s: 'programfag',
  matematikk_s1: 'programfag',
  matematikk_s2: 'programfag',
  matematikk_p: 'programfag',
  rettslaere: 'programfag',
  rettslære: 'programfag',
  okonomi: 'programfag',
  'økonomi': 'programfag',
  samfunnsokonomi: 'programfag',
  psykologi: 'programfag',
  sosiologi: 'programfag',

  // Vanlige valgfag
  programmering: 'valgfag',
  innsats_for_andre: 'valgfag',
  produksjon_for_scene: 'valgfag',
  fysisk_aktivitet_og_helse: 'valgfag',
  fysisk_aktivitet: 'valgfag',
  friluftsliv: 'valgfag',
  trafikk: 'valgfag',
  design_og_redesign: 'valgfag',
  medier_og_informasjon: 'valgfag',
  levande_kulturarv: 'valgfag',
}

/**
 * Normaliser streng for sammenligning:
 *   - trim + lowercase
 *   - fjern fremmede diakritikk (NFKD), men bevar norske `æ/ø/å` intakte
 *   - kollaps whitespace, behold alnum + norske bokstaver
 *
 * Eksempler:
 *   'Spansk'        → 'spansk'
 *   ' SpÂnsk '      → 'spansk'
 *   'Fremmedspråk'  → 'fremmedspråk'   (å bevares)
 *   'Kroppsøving'   → 'kroppsøving'    (ø bevares)
 */
export function normalizeLabel(s: string | undefined | null): string {
  if (!s) return ''
  // Beskytt norske bokstaver før NFKD (ellers dekomponerer 'å' → 'a' + ring).
  const protectedInput = s
    .replace(/å/g, '\u0001')
    .replace(/Å/g, '\u0002')
    .replace(/ø/g, '\u0003')
    .replace(/Ø/g, '\u0004')
    .replace(/æ/g, '\u0005')
    .replace(/Æ/g, '\u0006')
  return protectedInput
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0001/g, 'å')
    .replace(/\u0002/g, 'å')
    .replace(/\u0003/g, 'ø')
    .replace(/\u0004/g, 'ø')
    .replace(/\u0005/g, 'æ')
    .replace(/\u0006/g, 'æ')
    .replace(/[^a-z0-9æøå ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normaliser for bruk som alias-nøkkel (leksikal form — underscore i stedet for mellomrom). */
function aliasKey(s: string | undefined | null): string {
  return normalizeLabel(s).replace(/ /g, '_')
}

/**
 * Finn kanonisk `subjectKey` etter alias-oppslag.
 * Returnerer null når input er tom/ukjent tekst uten alias.
 */
export function resolveSubjectKey(
  raw: string | undefined | null
): { subjectKey: string | null; aliasedFrom?: string } {
  if (!raw || !raw.trim()) return { subjectKey: null }
  const k = aliasKey(raw)
  if (!k) return { subjectKey: null }
  if (k in SUBJECT_ALIAS) {
    return { subjectKey: SUBJECT_ALIAS[k]!, aliasedFrom: k }
  }
  // Bruk normalisert form som-er — dekker 'matematikk', 'engelsk', 'norsk' osv. direkte.
  return { subjectKey: k }
}

// -------------------------------------------------------------------------------------
// Score-basert matcher
// -------------------------------------------------------------------------------------

/** Minste akseptable score. Under denne regnes det som "ingen match" (havner i "Fag for dagen"). */
export const MIN_MATCH_SCORE = 4

/**
 * Intern "effektiv kontekst" som scorer bruker.
 * Kandidater (subjectCandidates) ekspanderes til flere effective contexts under matching.
 */
interface EffectiveContext {
  subjectKey?: string
  customLabel?: string
  lessonStart?: string
  lessonEnd?: string
}

export interface LessonScore {
  lesson: SchoolLessonSlot
  score: number
  reasons: string[]
}

/**
 * Scoremodell (poengsum per kriterium):
 *   +5  Alias-normalisert subjectKey === lesson.subjectKey
 *   +4  customLabel lik (normalisert) — sterkeste tiebreaker for språk/valgfag/programfag
 *   +2  customLabel delvis match (substring)
 *   +3  lessonStart === lesson.start
 *   +1  lessonEnd === lesson.end
 *   +1  ctx har subjectKey og lesson.subjectKey === 'custom' (myk fallback)
 *   −3  samme subjectKey men ulike customLabels (hindrer Tysk → Spansk-time)
 */
export function scoreLessonAgainstContext(
  lesson: SchoolLessonSlot,
  ctx: EffectiveContext
): LessonScore {
  let score = 0
  const reasons: string[] = []

  const resolved = resolveSubjectKey(ctx.subjectKey)
  const ctxLabel = normalizeLabel(ctx.customLabel)
  const lessonLabel = normalizeLabel(lesson.customLabel)

  const subjectKeyHit = resolved.subjectKey !== null && lesson.subjectKey === resolved.subjectKey
  if (subjectKeyHit) {
    score += 5
    reasons.push('subjectKey')
  } else if (resolved.subjectKey && lesson.subjectKey === CUSTOM_SUBJECT_KEY) {
    score += 1
    reasons.push('subjectKey->custom')
  }

  if (ctxLabel && lessonLabel) {
    if (ctxLabel === lessonLabel) {
      score += 4
      reasons.push('customLabel')
    } else if (lessonLabel.includes(ctxLabel) || ctxLabel.includes(lessonLabel)) {
      score += 2
      reasons.push('customLabel-partial')
    } else if (subjectKeyHit) {
      // Samme subjectKey, men customLabels er faktisk ulike → straff.
      // Dette hindrer f.eks. "Tysk" i å matche en "Spansk"-lesson på fremmedspråk.
      score -= 3
      reasons.push('customLabel-mismatch')
    }
  }

  if (ctx.lessonStart && ctx.lessonStart === lesson.start) {
    score += 3
    reasons.push('start')
  }
  if (ctx.lessonEnd && ctx.lessonEnd === lesson.end) {
    score += 1
    reasons.push('end')
  }

  return { lesson, score, reasons }
}

/** Bygg listen av effective contexts vi vil score mot (hovedctx + kandidater). */
function buildEffectiveContexts(ctx: SchoolContext): EffectiveContext[] {
  const base = {
    lessonStart: ctx.lessonStart,
    lessonEnd: ctx.lessonEnd,
  }
  const out: EffectiveContext[] = []
  const seen = new Set<string>()

  const push = (c: SchoolContextCandidate) => {
    const key = `${normalizeLabel(c.subjectKey)}|${normalizeLabel(c.customLabel)}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ ...base, subjectKey: c.subjectKey, customLabel: c.customLabel })
  }

  if (ctx.subjectKey || ctx.customLabel) {
    push({ subjectKey: ctx.subjectKey, customLabel: ctx.customLabel })
  }
  if (Array.isArray(ctx.subjectCandidates)) {
    for (const cand of ctx.subjectCandidates) {
      if (!cand) continue
      if (!cand.subjectKey && !cand.customLabel) continue
      push(cand)
    }
  }
  // Fallback: hvis kun tid er gitt, vi må fortsatt kunne matche på tid alene.
  if (out.length === 0 && (base.lessonStart || base.lessonEnd)) {
    out.push({ ...base })
  }
  return out
}

/** Velg beste lesson for én effective context. Returnerer null hvis uavgjort eller alle < MIN. */
function pickBestLessonForEffective(
  lessons: SchoolLessonSlot[],
  eff: EffectiveContext
): LessonScore | null {
  if (lessons.length === 0) return null
  const scored = lessons.map((l) => scoreLessonAgainstContext(l, eff))
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]!
  if (best.score < MIN_MATCH_SCORE) return null
  const second = scored[1]
  if (second && second.score === best.score) return null // uavgjort → avvis
  return best
}

/**
 * Finn beste `SchoolLessonSlot` for en `SchoolContext` i dagens plan.
 *
 * Regler:
 *  1. Alle `subjectCandidates` pluss hovedctx prøves.
 *  2. Beste lesson-score over `MIN_MATCH_SCORE` vinner.
 *  3. Uavgjort på tvers av kandidater eller lessons → null (bedre å la brukeren avklare).
 */
export function matchLessonForSchoolContext(
  plan: ChildSchoolDayPlan | undefined,
  ctx: SchoolContext | undefined | null
): SchoolLessonSlot | null {
  if (!plan?.lessons?.length || !ctx) return null
  const lessons = plan.lessons
  const effectives = buildEffectiveContexts(ctx)
  if (effectives.length === 0) return null

  let globalBest: LessonScore | null = null
  let tiedAtBest = false

  for (const eff of effectives) {
    const best = pickBestLessonForEffective(lessons, eff)
    if (!best) continue

    if (!globalBest || best.score > globalBest.score) {
      globalBest = best
      tiedAtBest = false
      continue
    }
    if (best.score === globalBest.score && best.lesson !== globalBest.lesson) {
      tiedAtBest = true
    }
  }

  if (!globalBest) return null
  if (tiedAtBest) return null
  return globalBest.lesson
}

// -------------------------------------------------------------------------------------
// UI helpers
// -------------------------------------------------------------------------------------

/** Norsk label for `itemType` brukt i chips og summary. */
export function schoolItemTypeLabel(t: SchoolItemType): string {
  switch (t) {
    case 'homework':
      return 'Lekse'
    case 'test':
      return 'Prøve'
    case 'note':
      return 'Notat'
    case 'equipment':
      return 'Husk'
    case 'trip':
      return 'Tur'
    default:
      return 'Annet'
  }
}

/** Tailwind-klasse for chip per `itemType` (rolig, aksentfarger matcher app-palett). */
export function schoolItemTypeChipClass(t: SchoolItemType): string {
  switch (t) {
    case 'homework':
      return 'border-amber-200 bg-amber-50 text-amber-800'
    case 'test':
      return 'border-rose-200 bg-rose-50 text-rose-800'
    case 'note':
      return 'border-zinc-200 bg-zinc-50 text-zinc-700'
    case 'equipment':
      return 'border-sky-200 bg-sky-50 text-sky-800'
    case 'trip':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-600'
  }
}

// -------------------------------------------------------------------------------------
// Day override — spesialdager / avviksdager
// -------------------------------------------------------------------------------------

const OVERRIDE_MODES: ReadonlySet<SchoolDayOverrideMode> = new Set([
  'replace_day',
  'hide_day',
  'adjust_day',
])

const OVERRIDE_KINDS: ReadonlySet<SchoolDayOverrideKind> = new Set([
  'exam_day',
  'trip_day',
  'activity_day',
  'free_day',
  'delayed_start',
  'early_end',
  'other',
])

/** Presedens: replace > hide > adjust. Høyere tall vinner ved konflikt på samme dato/barn. */
const OVERRIDE_MODE_PRIORITY: Record<SchoolDayOverrideMode, number> = {
  replace_day: 3,
  hide_day: 2,
  adjust_day: 1,
}

/** HH:mm-validering; vi er strenge for å unngå at feilformaterte strings slipper gjennom til UI. */
function isValidHHmm(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
}

/**
 * Pakk ut `schoolDayOverride` fra et event hvis det er gyldig. Ukjente `mode`/`kind` → null.
 * Returnerer ferdig validert `SchoolDayOverride` (kun kjente strings slipper gjennom).
 */
export function extractSchoolDayOverride(event: Event): SchoolDayOverride | null {
  const meta = event.metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const raw = (meta as { schoolDayOverride?: unknown }).schoolDayOverride
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const c = raw as Partial<SchoolDayOverride>
  if (typeof c.mode !== 'string' || !OVERRIDE_MODES.has(c.mode as SchoolDayOverrideMode)) return null
  if (typeof c.kind !== 'string' || !OVERRIDE_KINDS.has(c.kind as SchoolDayOverrideKind)) return null
  const out: SchoolDayOverride = {
    mode: c.mode as SchoolDayOverrideMode,
    kind: c.kind as SchoolDayOverrideKind,
  }
  if (typeof c.label === 'string' && c.label.trim()) out.label = c.label.trim()
  if (isValidHHmm(c.schoolStart)) out.schoolStart = c.schoolStart
  if (isValidHHmm(c.schoolEnd)) out.schoolEnd = c.schoolEnd
  if (typeof c.confidence === 'number' && Number.isFinite(c.confidence)) out.confidence = c.confidence
  return out
}

/**
 * Plukk det sterkeste override-et blant dagens events for ett barn.
 * Regler:
 *  1. Ignorer events som tilhører andre personer eller mangler gyldig override.
 *  2. Ignorer bakgrunns-events (`calendarLayer === 'background'`) — de er syntetiske og kan ikke trumfe seg selv.
 *  3. Velg høyest presedens; ved lik presedens, behold første forekomst (stabil rekkefølge).
 */
export function pickSchoolDayOverrideForChild(
  dayEvents: readonly Event[] | undefined,
  childPersonId: PersonId
): { event: Event; override: SchoolDayOverride } | null {
  if (!dayEvents || dayEvents.length === 0) return null
  let best: { event: Event; override: SchoolDayOverride } | null = null
  for (const ev of dayEvents) {
    if (ev.personId !== childPersonId) continue
    if (ev.metadata?.calendarLayer === 'background') continue
    const override = extractSchoolDayOverride(ev)
    if (!override) continue
    if (!best) {
      best = { event: ev, override }
      continue
    }
    const newPriority = OVERRIDE_MODE_PRIORITY[override.mode]
    const bestPriority = OVERRIDE_MODE_PRIORITY[best.override.mode]
    if (newPriority > bestPriority) best = { event: ev, override }
  }
  return best
}

/** Norsk label for override-kind, brukt i chips/tooltips. */
export function schoolDayOverrideKindLabel(kind: SchoolDayOverrideKind): string {
  switch (kind) {
    case 'exam_day':
      return 'Prøvedag'
    case 'trip_day':
      return 'Tur'
    case 'activity_day':
      return 'Aktivitetsdag'
    case 'free_day':
      return 'Fri'
    case 'delayed_start':
      return 'Senere oppmøte'
    case 'early_end':
      return 'Tidligere slutt'
    default:
      return 'Spesialdag'
  }
}

/** Pen label for `schoolContext` ("Matematikk", "Kroppsøving", osv.) inkl. `customLabel`. */
export function schoolContextSubjectLabel(
  band: NorwegianGradeBand | undefined,
  ctx: SchoolContext
): string | null {
  if (ctx.subjectKey) {
    return subjectLabelForKey(band ?? '1-4', ctx.subjectKey, ctx.customLabel)
  }
  if (ctx.customLabel?.trim()) return ctx.customLabel.trim()
  return null
}
