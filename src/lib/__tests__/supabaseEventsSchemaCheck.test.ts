import { describe, expect, it } from 'vitest'
import {
  EVENTS_COLUMNS_REQUIRED_FOR_TANKESTROM_IMPORT,
  extractEventsPropertyKeysFromOpenApi,
  findMissingColumns,
} from '../supabaseEventsSchemaCheck'

describe('supabaseEventsSchemaCheck (parser)', () => {
  it('leser events-properties fra OpenAPI 2 definitions', () => {
    const spec = {
      definitions: {
        events: {
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            person_id: { type: 'string' },
            date: { type: 'string' },
            title: { type: 'string' },
            start: { type: 'string' },
            end: { type: 'string' },
            notes: { type: 'string' },
            location: { type: 'string' },
            recurrence_group_id: { type: 'string' },
            reminder_minutes: { type: 'integer' },
            metadata: { type: 'object' },
          },
        },
      },
    }
    const keys = extractEventsPropertyKeysFromOpenApi(spec)
    expect(keys).not.toBeNull()
    const missing = findMissingColumns(new Set(keys!), EVENTS_COLUMNS_REQUIRED_FOR_TANKESTROM_IMPORT)
    expect(missing).toEqual([])
  })

  it('finner manglende kolonner', () => {
    const spec = {
      definitions: {
        events: {
          properties: {
            start: {},
            end: {},
          },
        },
      },
    }
    const keys = extractEventsPropertyKeysFromOpenApi(spec)
    expect(keys).toEqual(['start', 'end'])
    const missing = findMissingColumns(new Set(keys!), EVENTS_COLUMNS_REQUIRED_FOR_TANKESTROM_IMPORT)
    expect(missing).toContain('metadata')
    expect(missing).toContain('reminder_minutes')
  })
})
