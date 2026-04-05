import { supabase } from './supabaseClient'

export interface Profile {
  displayName: string
  familyName: string | null
}

/**
 * Profiles table must have primary key `id` (uuid = auth.users.id), plus display_name, family_name, updated_at.
 * If columns are missing, run supabase-profiles-fix.sql in the Supabase SQL Editor.
 */
const PROFILES_PK = 'id' as const

export async function upsertProfile(
  userId: string,
  data: { display_name: string; family_name?: string | null }
): Promise<boolean> {
  const { error } = await supabase.from('profiles').upsert(
    {
      [PROFILES_PK]: userId,
      display_name: data.display_name,
      family_name: data.family_name ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: PROFILES_PK }
  )
  if (error) {
    console.error('[profileApi] upsertProfile error', error)
    return false
  }
  return true
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, family_name')
    .eq(PROFILES_PK, userId)
    .maybeSingle()
  if (error) {
    console.error('[profileApi] fetchProfile error', error)
    return null
  }
  if (!data) return null
  return {
    displayName: (data.display_name ?? '') as string,
    familyName: (data.family_name ?? null) as string | null,
  }
}
