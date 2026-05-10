/**
 * Read-only sjekk av at public.events har kolonner appen bruker ved Tankestrom-import / createEvent.
 * Bruker PostgREST OpenAPI (ingen rad-lesing) med valgfri fallback: .select(...).limit(0).
 */

import { createClient } from '@supabase/supabase-js'

/** Kolonner createEventForDate mener ved insert + det Tankestrom typisk fyller. */
export const EVENTS_COLUMNS_REQUIRED_FOR_TANKESTROM_IMPORT = [
  'user_id',
  'person_id',
  'date',
  'title',
  'start',
  'end',
  'notes',
  'location',
  'recurrence_group_id',
  'reminder_minutes',
  'metadata',
] as const

export type EventsSchemaCheckResult =
  | { ok: true; method: 'openapi' | 'select_probe'; columnNames: string[] }
  | { ok: false; method: 'openapi' | 'select_probe'; missing: string[]; detail: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Trekk ut property-navn fra PostgREST OpenAPI (2.x definitions eller 3.x components.schemas). */
export function extractEventsPropertyKeysFromOpenApi(spec: unknown): string[] | null {
  if (!isRecord(spec)) return null

  const fromProps = (node: unknown): string[] | null => {
    if (!isRecord(node)) return null
    const props = node.properties
    if (!isRecord(props)) return null
    return Object.keys(props)
  }

  const defs = spec.definitions
  if (isRecord(defs)) {
    if (defs.events) {
      const keys = fromProps(defs.events)
      if (keys?.length) return keys
    }
    for (const k of Object.keys(defs)) {
      if (k === 'events' || k.endsWith('.events') || k === 'public.events') {
        const keys = fromProps(defs[k])
        if (keys?.length) return keys
      }
    }
  }

  const schemas = spec.components && isRecord(spec.components) ? spec.components.schemas : null
  if (isRecord(schemas)) {
    if (schemas.events) {
      const keys = fromProps(schemas.events)
      if (keys?.length) return keys
    }
    for (const k of Object.keys(schemas)) {
      if (k === 'events' || k.endsWith('.events')) {
        const keys = fromProps(schemas[k])
        if (keys?.length) return keys
      }
    }
  }

  return null
}

export function findMissingColumns(
  present: Set<string>,
  required: readonly string[]
): string[] {
  return required.filter((c) => !present.has(c))
}

export async function fetchPostgrestOpenApiJson(
  supabaseUrl: string,
  anonKey: string
): Promise<unknown> {
  const base = supabaseUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/rest/v1/`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/openapi+json, application/json',
    },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`OpenAPI ${res.status}: ${text.slice(0, 400)}`)
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`OpenAPI body is not JSON (first 120 chars): ${text.slice(0, 120)}`)
  }
}

export async function probeEventsColumnsViaSelect(
  supabaseUrl: string,
  anonKey: string,
  columns: readonly string[]
): Promise<{ error: { message: string; code?: string } | null }> {
  const sb = createClient(supabaseUrl, anonKey)
  const sel = columns.join(',')
  const { error } = await sb.from('events').select(sel).limit(0)
  return { error: error ? { message: error.message, code: error.code } : null }
}

/**
 * Verifiser at events har påkrevde kolonner. Prøver OpenAPI først (unngår RLS på data),
 * deretter select .limit(0) som sekundær sjekk når OpenAPI ikke kunne parses.
 */
export async function verifySupabaseEventsSchemaForImport(
  supabaseUrl: string,
  anonKey: string
): Promise<EventsSchemaCheckResult> {
  const required = EVENTS_COLUMNS_REQUIRED_FOR_TANKESTROM_IMPORT

  let openApiErr: string | null = null
  try {
    const spec = await fetchPostgrestOpenApiJson(supabaseUrl, anonKey)
    const openApiKeys = extractEventsPropertyKeysFromOpenApi(spec)
    if (openApiKeys?.length) {
      const missing = findMissingColumns(new Set(openApiKeys), required)
      if (missing.length === 0) {
        return { ok: true, method: 'openapi', columnNames: openApiKeys }
      }
      return {
        ok: false,
        method: 'openapi',
        missing,
        detail: `I OpenAPI for «events» mangler kolonner: ${missing.join(', ')}. Kjør supabase-fix.sql (eller tilsvarende migrasjon) mot prosjektet.`,
      }
    }
    openApiErr = 'Kunne ikke finne events.properties i OpenAPI-svaret.'
  } catch (e) {
    openApiErr = e instanceof Error ? e.message : String(e)
  }

  const { error: selErr } = await probeEventsColumnsViaSelect(supabaseUrl, anonKey, required)
  if (!selErr) {
    return { ok: true, method: 'select_probe', columnNames: [...required] }
  }

  const code = selErr.code ?? ''
  const msg = selErr.message ?? ''
  return {
    ok: false,
    method: 'select_probe',
    missing: [...required],
    detail: `OpenAPI: ${openApiErr ?? 'ikke tilgjengelig'}. select_probe (${code || '—'}): ${msg}`,
  }
}

/** Sant når integrasjonstest skal kjøre mot ekte Supabase (unngå uhell i CI uten eksplisitt valg). */
export function isSupabaseEventsSchemaCheckEnabled(): boolean {
  const v = process.env.RUN_SUPABASE_EVENTS_SCHEMA_CHECK?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function getSupabaseEnvForSchemaCheck(): { url: string; anonKey: string } | null {
  const url = process.env.VITE_SUPABASE_URL?.trim()
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}
