import { describe, expect, it } from 'vitest'
import {
  getSupabaseEnvForSchemaCheck,
  isSupabaseEventsSchemaCheckEnabled,
  verifySupabaseEventsSchemaForImport,
} from '../supabaseEventsSchemaCheck'

const enabled = isSupabaseEventsSchemaCheckEnabled()
const env = getSupabaseEnvForSchemaCheck()
const runIntegration = Boolean(enabled && env)

describe.skipIf(!runIntegration)(
  'Supabase events schema (integration — RUN_SUPABASE_EVENTS_SCHEMA_CHECK=1 + VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)',
  () => {
    it('events har kolonner som Tankestrom createEvent sender', async () => {
      const e = getSupabaseEnvForSchemaCheck()
      if (!e) throw new Error('Mangler VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
      const r = await verifySupabaseEventsSchemaForImport(e.url, e.anonKey)
      expect(r.ok, r.ok ? '' : `${r.detail} (mangler: ${r.missing.join(', ')})`).toBe(true)
    })
  }
)
