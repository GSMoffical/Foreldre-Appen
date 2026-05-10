import { describe, expect, it } from 'vitest'
import { formatSupabaseError } from '../supabaseErrors'

describe('formatSupabaseError', () => {
  it('forklarer PGRST204 / manglende kolonne', () => {
    const msg = formatSupabaseError({
      code: 'PGRST204',
      message: "Could not find the 'metadata' column of 'events' in the schema cache",
      details: '',
      hint: '',
    } as Parameters<typeof formatSupabaseError>[0])
    expect(msg.toLowerCase()).toMatch(/kolonne|metadata|supabase-fix/)
  })
})
