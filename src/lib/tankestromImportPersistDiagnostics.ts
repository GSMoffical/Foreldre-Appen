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
  childId?: string
  title?: string
  date?: string
  field?: 'title' | 'date' | 'start' | 'end' | 'personId' | 'parent' | 'database' | 'unknown'
  proposalSurfaceType: 'event' | 'task'
  operation: TankestromImportPersistOperation | 'editEventPrecheck'
  kind: TankestromImportPersistErrorKind
  message: string
  /** Fylles ved task-feil for konkrete brukermeldinger og debug. */
  taskPersistContext?: TankestromImportPersistTaskPersistContext
  supabaseCode?: string
  supabaseMessage?: string
  supabaseDetails?: string
  supabaseHint?: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function asPostgrestError(err: unknown): PostgrestError | null {
  if (!isRecord(err)) return null
  if (typeof err.code === 'string' && typeof err.message === 'string') {
    return err as unknown as PostgrestError
  }
  const inner = err.error
  if (isRecord(inner) && typeof inner.code === 'string' && typeof inner.message === 'string') {
    return inner as unknown as PostgrestError
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
  supabaseDetails?: string
  supabaseHint?: string
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
    const details = typeof pg.details === 'string' && pg.details.trim() ? pg.details.trim() : undefined
    const hint = typeof pg.hint === 'string' && pg.hint.trim() ? pg.hint.trim() : undefined
    const base = {
      supabaseCode: code || undefined,
      supabaseMessage: pg.message,
      supabaseDetails: details,
      supabaseHint: hint,
    }
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

/** Stabil nøkkel for «samme rotårsak» (kind + Postgres/PostgREST-kode). */
export function taskPersistFailureCanonicalBucket(f: TankestromImportPersistFailureRecord): string {
  return `${f.kind}|${f.supabaseCode ?? '∅'}`
}

function taskPersistCorpusLower(f: TankestromImportPersistFailureRecord): string {
  return [f.supabaseMessage, f.supabaseDetails, f.supabaseHint, f.message]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .join(' | ')
    .toLowerCase()
}

/** Kort teknisk etikett til debug (ikke nødvendigvis brukt i UI). */
export function mapTaskPersistFailureRootCauseTechnical(f: TankestromImportPersistFailureRecord): string {
  const code = f.supabaseCode ?? '—'
  const tail = (f.supabaseMessage ?? f.message).trim().slice(0, 160)
  return tail ? `${code}: ${tail}` : code
}

/**
 * Presis, kort norsk forklaring basert på faktisk Supabase/Postgres-signal.
 * Brukes i import-feilbanner for oppgaver.
 */
export function describeTaskPersistRootCauseForUser(f: TankestromImportPersistFailureRecord): string {
  const code = f.supabaseCode ?? ''
  const corpus = taskPersistCorpusLower(f)

  if (f.kind === 'network') return 'nettverksfeil eller manglende svar fra server'
  if (f.kind === 'auth') return 'sesjon utløpt eller ugyldig innlogging'
  if (f.kind === 'permission') return 'tilgangsregler (RLS) blokkerte raden'

  if (code === 'PGRST204' && corpus.includes('task_intent')) {
    return 'kolonnen task_intent mangler i databasen (migrering ikke kjørt, feil miljø, eller PostgREST-cache ikke oppdatert)'
  }

  if (code === '23503' || corpus.includes('foreign key') || corpus.includes('violates foreign key constraint')) {
    if (corpus.includes('child_person') || corpus.includes('child_person_id')) {
      return '«Barn»-feltet peker på en person som ikke finnes i familien'
    }
    if (corpus.includes('assigned_to') || corpus.includes('assigned_to_person')) {
      return '«Ansvarlig»-feltet peker på en person som ikke finnes i familien'
    }
    if (corpus.includes('user_id') || corpus.includes('users')) {
      return 'koblingen til brukerkonto matcher ikke (user_id)'
    }
    return 'database avviste personkobling (fremmednøkkel)'
  }

  if (code === '23502' || (corpus.includes('null value') && corpus.includes('not-null'))) {
    return 'obligatorisk felt mangler i databasen'
  }

  if (code === '23514' || corpus.includes('violates check constraint')) {
    return 'feltverdi brøt en sjekkregel i databasen'
  }

  if (code === '23505' || corpus.includes('unique constraint') || corpus.includes('duplicate key')) {
    return 'duplikat — raden finnes allerede'
  }

  if (code === '22P02' || corpus.includes('invalid input syntax')) {
    if (corpus.includes('date') || corpus.includes('timestamp')) {
      return 'ugyldig dato eller tidsformat'
    }
    return 'ugyldig verdi sendt til databasen'
  }

  if (code === '42P01' || corpus.includes('does not exist') || corpus.includes('relation')) {
    return 'databaseobjekt mangler (tabell/kolonne)'
  }

  if (f.kind === 'validation') {
    return 'ugyldig data (format, dato eller begrensning)'
  }

  if (code.startsWith('PGRST') || code.startsWith('08')) {
    const short = (f.supabaseMessage ?? f.message).trim()
    if (short.length > 0 && short.length <= 100) return `PostgREST (${code}): ${short}`
    return `PostgREST-feil (${code || 'ukjent'})`
  }

  if (code && (f.supabaseMessage ?? '').trim()) {
    const m = (f.supabaseMessage ?? '').trim()
    return m.length <= 120 ? `${code}: ${m}` : `${code}: ${m.slice(0, 117)}…`
  }

  if ((f.message ?? '').trim()) {
    const m = f.message.trim()
    return m.length <= 120 ? m : `${m.slice(0, 117)}…`
  }

  return 'server/database avviste raden uten detaljert melding'
}

export function buildTaskPersistFailureSupabaseDebugPayload(
  f: TankestromImportPersistFailureRecord
): Record<string, unknown> {
  return {
    tankestromTaskPersistSupabaseCode: f.supabaseCode ?? null,
    tankestromTaskPersistSupabaseMessage: f.supabaseMessage ?? null,
    tankestromTaskPersistSupabaseDetails: f.supabaseDetails ?? null,
    tankestromTaskPersistSupabaseHint: f.supabaseHint ?? null,
    tankestromTaskPersistFailureRootCauseMapped: mapTaskPersistFailureRootCauseTechnical(f),
  }
}

function summarizeTaskFailuresForUser(taskFailures: TankestromImportPersistFailureRecord[]): string {
  const bucket = taskPersistFailureCanonicalBucket
  const groups = new Map<string, TankestromImportPersistFailureRecord[]>()
  for (const f of taskFailures) {
    const k = bucket(f)
    const arr = groups.get(k) ?? []
    arr.push(f)
    groups.set(k, arr)
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)

  if (sorted.length === 1) {
    const list = sorted[0]![1]
    const phrase = describeTaskPersistRootCauseForUser(list[0]!)
    const samples = titleSamplesForFailures(list, 4)
    const more = list.length > 4 ? ` (+${list.length - 4} til)` : ''
    return `Alle ${list.length} oppgavene feilet av samme grunn: ${phrase}. Eksempler: «${samples}»${more}.`
  }

  const parts: string[] = []
  const maxBuckets = 3
  let overflow = 0
  sorted.forEach(([_, list], i) => {
    if (i >= maxBuckets) {
      overflow += list.length
      return
    }
    const phrase = describeTaskPersistRootCauseForUser(list[0]!)
    const samples = titleSamplesForFailures(list, 2)
    const moreB = list.length > 2 ? ` (+${list.length - 2} til)` : ''
    parts.push(`${list.length} oppgave(r) — ${phrase}. Eksempler: «${samples}»${moreB}.`)
  })
  if (overflow > 0) {
    parts.push(`${overflow} oppgave(r) med andre årsaker — prøv igjen eller åpne hvert forslag og sjekk feltene.`)
  }
  return parts.join(' ')
}

/** Kompakt brukermelding (mobilvennlig), med konkret oppgave-kontekst når tilgjengelig. */
export function buildTankestromImportFailureUserMessage(
  failures: TankestromImportPersistFailureRecord[],
  _totalSelected: number
): string {
  if (failures.length === 0) return ''
  const n = failures.length
  const taskFailures = failures.filter((f) => f.proposalSurfaceType === 'task')
  const eventFailures = failures.filter((f) => f.proposalSurfaceType === 'event')

  let head = `${n} av ${_totalSelected} forslag kunne ikke lagres`
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
    detailParts.push(summarizeTaskFailuresForUser(taskFailures))
  }

  if (eventFailures.length > 0) {
    const specific = eventFailures
      .slice(0, 8)
      .map((f) => {
        const t = (f.title ?? '').trim() || 'Uten tittel'
        const db = f.supabaseCode ? ` (databasekode: ${f.supabaseCode})` : ''
        return `• ${t}: ${f.message}${db}`
      })
    if (specific.length > 0) {
      const kinds = new Set(eventFailures.map((f) => f.kind))
      const hints: string[] = []
      for (const k of HINT_PRIORITY) {
        if (kinds.has(k)) {
          const line = KIND_HINT_NB[k]
          if (line) hints.push(line)
          if (hints.length >= 2) break
        }
      }
      detailParts.push(`Kunne ikke lagre ${eventFailures.length} hendelse(r):\n${specific.join('\n')}`)
      if (hints.length > 0) detailParts.push(hints.join(' '))
      detailParts.push('Åpne «Rediger» på hendelsen og fyll inn manglende felt.')
      return `${head} ${detailParts.join('\n\n')}`
    }
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
