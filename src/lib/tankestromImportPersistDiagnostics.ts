import type { PostgrestError } from '@supabase/supabase-js'
import type { Task } from '../types'
import { formatSupabaseError } from './supabaseErrors'

export type TankestromImportPersistOperation = 'createEvent' | 'createTask' | 'editEvent'

export type TankestromImportPersistErrorKind =
  | 'network'
  | 'validation'
  | 'auth'
  | 'permission'
  | 'event_create_failed'
  | 'task_create_failed'
  | 'event_update_failed'
  | 'event_update_target_missing'
  | 'unknown'

export type TankestromImportPersistTaskPersistContext = {
  title: string
  date: string
  dueTime?: string
  taskIntent: string
  childPersonId?: string | null
  assignedToPersonId?: string | null
}

export type TankestromImportPersistFailureRecord = {
  proposalId: string
  proposalSurfaceType: 'event' | 'task'
  operation: TankestromImportPersistOperation | 'editEventPrecheck'
  kind: TankestromImportPersistErrorKind
  message: string
  /** Fylles ved task-feil for konkrete brukermeldinger og debug. */
  taskPersistContext?: TankestromImportPersistTaskPersistContext
  supabaseCode?: string
  supabaseMessage?: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function asPostgrestError(err: unknown): PostgrestError | null {
  if (!isRecord(err)) return null
  if (typeof err.code === 'string' && typeof err.message === 'string') {
    return err as unknown as PostgrestError
  }
  return null
}

function operationFallbackKind(
  operation: TankestromImportPersistOperation
): TankestromImportPersistErrorKind {
  if (operation === 'createTask') return 'task_create_failed'
  if (operation === 'editEvent') return 'event_update_failed'
  return 'event_create_failed'
}

/**
 * Klassifiser kastet feil fra createEvent / createTask / editEvent for import-review.
 */
export type TankestromPersistClassification = {
  kind: TankestromImportPersistErrorKind
  message: string
  supabaseCode?: string
  supabaseMessage?: string
}

export function classifyTankestromPersistThrownError(
  err: unknown,
  operation: TankestromImportPersistOperation
): TankestromPersistClassification {
  const pg = asPostgrestError(err)
  const msgFromErr = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const lower = (msgFromErr || '').toLowerCase()

  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('load failed') ||
    lower === 'networkerror'
  ) {
    return { kind: 'network', message: msgFromErr || 'Nettverksfeil' }
  }

  if (pg) {
    const formatted = formatSupabaseError(pg)
    const code = pg.code ?? ''
    const msg = (pg.message ?? '').toLowerCase()
    const base = { supabaseCode: code || undefined, supabaseMessage: pg.message }
    if (code === 'PGRST301' || msg.includes('jwt') || (msg.includes('expired') && msg.includes('token'))) {
      return { kind: 'auth', message: formatted, ...base }
    }
    if (code === '42501' || msg.includes('permission denied') || msg.includes('rls') || msg.includes('policy')) {
      return { kind: 'permission', message: formatted, ...base }
    }
    if (
      code === '23505' ||
      code === '23514' ||
      code === '22P02' ||
      msg.includes('constraint') ||
      msg.includes('violates') ||
      msg.includes('invalid input')
    ) {
      return { kind: 'validation', message: formatted, ...base }
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return { kind: 'network', message: formatted, ...base }
    }
    return { kind: operationFallbackKind(operation), message: formatted, ...base }
  }

  const fb = operationFallbackKind(operation)
  if (err instanceof Error && err.message) {
    return { kind: fb, message: err.message }
  }

  return { kind: fb, message: 'Ukjent feil ved lagring' }
}

/** Stabil, lesbar «fingeravtrykk»-streng for import-debug (ikke kryptografisk). */
export function buildTankestromTaskPersistPayloadFingerprint(input: Omit<Task, 'id'>): string {
  return [
    `d=${input.date}`,
    `tl=${input.title.length}`,
    `i=${input.taskIntent ?? ''}`,
    `c=${input.childPersonId ?? ''}`,
    `a=${input.assignedToPersonId ?? ''}`,
    `dt=${input.dueTime ?? ''}`,
  ].join('|')
}

const KIND_HINT_NB: Partial<Record<TankestromImportPersistErrorKind, string>> = {
  network: 'Mulig nettverks- eller tilkoblingsproblem.',
  auth: 'Sesjonen kan ha utløpt — logg inn på nytt.',
  permission: 'Manglende tilgang (sjekk innlogging).',
  event_update_target_missing: 'Ett arrangement som skulle oppdateres ble ikke funnet.',
  validation: 'Noe kan være ugyldig (dato, tid eller format).',
  task_create_failed: 'Noen oppgaver kunne ikke lagres.',
  event_update_failed: 'Noen oppdateringer av eksisterende arrangement feilet.',
  event_create_failed: 'Noen nye hendelser kunne ikke opprettes.',
  unknown: 'Ukjent årsak — prøv igjen.',
}

const HINT_PRIORITY: TankestromImportPersistErrorKind[] = [
  'network',
  'auth',
  'permission',
  'event_update_target_missing',
  'validation',
  'task_create_failed',
  'event_update_failed',
  'event_create_failed',
  'unknown',
]

const TASK_FAILURE_KIND_PHRASE_NB: Partial<Record<TankestromImportPersistErrorKind, string>> = {
  network: 'nettverks- eller tilkoblingsproblem',
  auth: 'innlogging / utløpt sesjon',
  permission: 'manglende tilgang (rettigheter)',
  validation: 'sannsynlig ugyldig dato, klokkeslett eller andre felt',
  task_create_failed: 'serveren avviste lagringen',
  unknown: 'ukjent årsak',
}

const MAX_TITLE_SNIPPET = 44

function ellipsizeForUserMessage(title: string): string {
  const s = (title || '').trim() || 'Uten tittel'
  if (s.length <= MAX_TITLE_SNIPPET) return s
  return `${s.slice(0, MAX_TITLE_SNIPPET - 1)}…`
}

function titleSamplesForFailures(records: TankestromImportPersistFailureRecord[], max: number): string {
  return records
    .map((f) => ellipsizeForUserMessage(f.taskPersistContext?.title ?? f.proposalId))
    .slice(0, max)
    .join('», «')
}

function groupFailuresByKind(
  list: TankestromImportPersistFailureRecord[]
): Map<TankestromImportPersistErrorKind, TankestromImportPersistFailureRecord[]> {
  const m = new Map<TankestromImportPersistErrorKind, TankestromImportPersistFailureRecord[]>()
  for (const f of list) {
    const arr = m.get(f.kind) ?? []
    arr.push(f)
    m.set(f.kind, arr)
  }
  return m
}

/** Kompakt brukermelding (mobilvennlig), med konkret oppgave-kontekst når tilgjengelig. */
export function buildTankestromImportFailureUserMessage(
  failures: TankestromImportPersistFailureRecord[],
  totalSelected: number
): string {
  if (failures.length === 0) return ''
  const n = failures.length
  const taskFailures = failures.filter((f) => f.proposalSurfaceType === 'task')
  const eventFailures = failures.filter((f) => f.proposalSurfaceType === 'event')

  let head = `${n} av ${totalSelected} forslag kunne ikke lagres`
  if (taskFailures.length > 0 && eventFailures.length > 0) {
    head += ` (${taskFailures.length} oppgave(r), ${eventFailures.length} hendelse(r))`
  } else if (taskFailures.length > 0) {
    head += ' (gjelder oppgaver)'
  } else if (eventFailures.length > 0) {
    head += ' (gjelder arrangementer)'
  }
  head += '.'

  const detailParts: string[] = []

  if (taskFailures.length > 0) {
    const byKind = groupFailuresByKind(taskFailures)
    for (const k of HINT_PRIORITY) {
      const list = byKind.get(k)
      if (!list?.length) continue
      const phrase = TASK_FAILURE_KIND_PHRASE_NB[k] ?? KIND_HINT_NB[k] ?? 'feil ved lagring'
      const samples = titleSamplesForFailures(list, 4)
      const more = list.length > 4 ? ` (+${list.length - 4} til)` : ''
      detailParts.push(`${list.length} oppgave(r) — ${phrase}. Eksempler: «${samples}»${more}.`)
    }
  }

  if (eventFailures.length > 0) {
    const kinds = new Set(eventFailures.map((f) => f.kind))
    const hints: string[] = []
    for (const k of HINT_PRIORITY) {
      if (kinds.has(k)) {
        const line = KIND_HINT_NB[k]
        if (line) hints.push(line)
        if (hints.length >= 3) break
      }
    }
    if (taskFailures.length > 0) {
      detailParts.push(
        eventFailures.length === 1
          ? `I tillegg feilet 1 hendelse (${hints[0] ?? 'se detaljer i logg hvis tilgjengelig'}).`
          : `I tillegg feilet ${eventFailures.length} hendelser (${hints.slice(0, 2).join(' ') || 'prøv igjen'}).`
      )
    } else {
      if (hints.length === 0) {
        return `${head} Prøv igjen om litt.`
      }
      return `${head} ${hints.join(' ')}`
    }
  }

  if (detailParts.length === 0) {
    const kinds = new Set(failures.map((f) => f.kind))
    const hints: string[] = []
    for (const k of HINT_PRIORITY) {
      if (kinds.has(k)) {
        const line = KIND_HINT_NB[k]
        if (line) hints.push(line)
        if (hints.length >= 3) break
      }
    }
    return hints.length ? `${head} ${hints.join(' ')}` : `${head} Prøv igjen om litt.`
  }

  return `${head} ${detailParts.join(' ')}`
}

export function aggregatePersistFailureKinds(
  failures: TankestromImportPersistFailureRecord[]
): Record<TankestromImportPersistErrorKind, number> {
  const keys: TankestromImportPersistErrorKind[] = [
    'network',
    'validation',
    'auth',
    'permission',
    'event_create_failed',
    'task_create_failed',
    'event_update_failed',
    'event_update_target_missing',
    'unknown',
  ]
  const out = {} as Record<TankestromImportPersistErrorKind, number>
  for (const k of keys) out[k] = 0
  for (const f of failures) {
    out[f.kind] += 1
  }
  return out
}
