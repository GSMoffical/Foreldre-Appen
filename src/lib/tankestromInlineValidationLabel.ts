import type { TankestromImportDraft } from '../features/tankestrom/types'
import {
  collectTankestromEventExportValidationIssues,
  type TankestromExportValidationCode,
  type TankestromExportValidationIssue,
} from '../features/tankestrom/useTankestromImport'

const EDIT_ACTION = ' — Rediger'

/** Liten forbokstav for «på søndag» i setninger. */
export function norwegianWeekdayLowercase(isoDate: string): string {
  try {
    const raw = new Date(`${isoDate}T12:00:00`).toLocaleDateString('nb-NO', { weekday: 'long' }).replace(/\.$/, '')
    const t = raw.trim()
    if (!t) return ''
    return t.charAt(0).toLocaleLowerCase('nb-NO') + t.slice(1)
  } catch {
    return ''
  }
}

function appendWeekdayIfTimeIssue(code: TankestromExportValidationCode, weekdayNb: string | undefined): string {
  if (!weekdayNb) return ''
  const timeish: TankestromExportValidationCode[] = [
    'missing_start_time',
    'invalid_start_time',
    'missing_end_time',
    'invalid_end_time',
    'end_not_after_start',
  ]
  if (!timeish.includes(code)) return ''
  return ` på ${weekdayNb}`
}

/** Kort, brukervennlig fragment uten « — Rediger». */
export function shortInlineLabelForIssue(
  issue: TankestromExportValidationIssue,
  weekdayNb?: string
): string {
  const day = appendWeekdayIfTimeIssue(issue.code, weekdayNb)
  switch (issue.code) {
    case 'missing_person':
      return `Mangler person${day}`
    case 'invalid_person':
    case 'invalid_participant':
    case 'primary_participant_order':
      return `Personfelt må rettes${day}`
    case 'missing_title':
    case 'missing_task_title':
      return `Mangler tittel${day}`
    case 'missing_date':
    case 'missing_task_date':
      return `Mangler dato${day}`
    case 'invalid_date_format':
    case 'invalid_date':
    case 'invalid_task_date_format':
    case 'invalid_task_date':
      return `Ugyldig dato${day}`
    case 'missing_start_time':
      return `Mangler starttid${day}`
    case 'invalid_start_time':
      return `Ugyldig starttid${day}`
    case 'missing_end_time':
      return `Mangler sluttid${day}`
    case 'invalid_end_time':
      return `Ugyldig sluttid${day}`
    case 'end_not_after_start':
      return `Sluttid må være etter start${day}`
    case 'invalid_task_due_time':
      return 'Ugyldig frist (klokkeslett)'
    case 'multiple_validation':
      return 'Flere felt må rettes'
    default:
      return 'Må rettes'
  }
}

function orderedUniqueShortLabels(issues: TankestromExportValidationIssue[], weekdayNb?: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const i of issues) {
    const s = shortInlineLabelForIssue(i, weekdayNb)
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

export type FormatTankestromImportCardValidationBannerOptions = {
  /** F.eks. «søndag» for enkelt programpunkt. */
  weekdayNb?: string
  /** Antall konkrete ledetekster før «(+N til)». */
  maxConcrete?: number
  /** Ved minst så mange feltfeil: «N felt må rettes». */
  manyFieldsThreshold?: number
}

/**
 * Én linje til importkort (kolonnevisning) med avsluttende « — Rediger».
 */
export function formatTankestromImportCardValidationBanner(
  issues: TankestromExportValidationIssue[],
  opts?: FormatTankestromImportCardValidationBannerOptions
): string | null {
  if (issues.length === 0) return null
  const manyAt = opts?.manyFieldsThreshold ?? 4
  if (issues.length >= manyAt) {
    return `${issues.length} felt må rettes${EDIT_ACTION}`
  }
  const maxC = opts?.maxConcrete ?? 2
  const labels = orderedUniqueShortLabels(issues, opts?.weekdayNb)
  if (labels.length === 0) return `Må rettes${EDIT_ACTION}`
  if (labels.length === 1) return `${labels[0]}${EDIT_ACTION}`
  const head = labels.slice(0, maxC)
  const rest = labels.length - head.length
  const body = head.join(' og ')
  return rest > 0 ? `${body} (+${rest} til)${EDIT_ACTION}` : `${body}${EDIT_ACTION}`
}

function aggregatePhraseForHomogeneousCode(code: TankestromExportValidationCode, n: number): string {
  const p =
    code === 'missing_person'
      ? 'Mangler person'
      : code === 'invalid_person' || code === 'invalid_participant' || code === 'primary_participant_order'
        ? 'Personfelt må rettes'
        : code === 'missing_title'
          ? 'Mangler tittel'
          : code === 'missing_date' || code === 'invalid_date_format' || code === 'invalid_date'
            ? 'Mangler eller ugyldig dato'
            : code === 'missing_start_time' || code === 'invalid_start_time'
              ? 'Mangler starttid'
              : code === 'missing_end_time' || code === 'invalid_end_time'
                ? 'Mangler sluttid'
                : code === 'end_not_after_start'
                  ? 'Sluttid må være etter start'
                  : null
  if (!p) return `${n} programpunkter må rettes`
  return `${p} på ${n} hendelser`
}

export type EmbeddedChildrenValidationSummary = {
  parentBanner: string | null
  /** Når samme feil gjelder flere valgte barn og er oppsummert på forelderkortet. */
  suppressPerChildDuplicateBanners: boolean
}

/**
 * Oppsummering på forelderkort for arrangement med delprogram (valgte barn-rader).
 */
export function summarizeEmbeddedChildrenImportValidation(
  parentProposalId: string,
  rows: Array<{ origIndex: number }>,
  selectedIds: Set<string>,
  draftByProposalId: Record<string, TankestromImportDraft | undefined>,
  validPersonIds: Set<string>,
  makeChildProposalId: (parentProposalId: string, origIndex: number) => string
): EmbeddedChildrenValidationSummary {
  type Entry = { firstCode: TankestromExportValidationCode; issues: TankestromExportValidationIssue[] }
  const entries: Entry[] = []
  for (const row of rows) {
    const childId = makeChildProposalId(parentProposalId, row.origIndex)
    if (!selectedIds.has(childId)) continue
    const draft = draftByProposalId[childId]
    if (!draft || draft.importKind !== 'event') continue
    const issues = collectTankestromEventExportValidationIssues(childId, childId, draft.event, validPersonIds)
    if (issues.length === 0) continue
    entries.push({ firstCode: issues[0]!.code, issues })
  }
  if (entries.length === 0) {
    return { parentBanner: null, suppressPerChildDuplicateBanners: false }
  }
  if (entries.length === 1) {
    return { parentBanner: null, suppressPerChildDuplicateBanners: false }
  }
  const code0 = entries[0]!.firstCode
  const homogeneous = entries.every((e) => e.firstCode === code0)
  if (homogeneous) {
    return {
      parentBanner: `${aggregatePhraseForHomogeneousCode(code0, entries.length)}${EDIT_ACTION}`,
      suppressPerChildDuplicateBanners: true,
    }
  }
  return {
    parentBanner: `${entries.length} programpunkter må rettes${EDIT_ACTION}`,
    suppressPerChildDuplicateBanners: false,
  }
}
