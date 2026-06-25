import type {
  ChildSchoolProfile,
  MemberKind,
  ParentWorkProfile,
  Person,
  RelevanceProfile,
} from '../types'
import { supabase } from './supabaseClient'

type ProfileRow = {
  school?: ChildSchoolProfile
  work?: ParentWorkProfile
  /** Barn: minimal relevansprofil (skole/klasse/trinn/aktiviteter) for senere Tankestrøm-kontekst. */
  relevance?: RelevanceProfile
}

/**
 * Mapper en rå `member_kind`-verdi fra `family_members` trofast til `MemberKind`.
 * Bevarer `'guest'` i stedet for å kollapse alt som ikke er `'parent'` til `'child'`, slik
 * at gjester/med-foreldre ikke feilaktig telles som barn. Ukjent/`null` (kan ikke skje pga.
 * NOT NULL + CHECK i DB) faller trygt til `'guest'` — aldri `'child'`.
 */
export function normalizeMemberKind(raw: string | null | undefined): MemberKind {
  return raw === 'parent' || raw === 'child' || raw === 'guest' ? raw : 'guest'
}

function mapRowToPerson(row: {
  id: string
  name: string
  color_tint: string
  color_accent: string
  member_kind?: string | null
  profile?: ProfileRow | null
  linked_auth_user_id?: string | null
}): Person {
  const memberKind: MemberKind = normalizeMemberKind(row.member_kind)
  const profile = (row.profile ?? {}) as ProfileRow
  return {
    id: row.id,
    name: row.name,
    colorTint: row.color_tint,
    colorAccent: row.color_accent,
    memberKind,
    school: memberKind === 'child' ? profile.school : undefined,
    work: memberKind === 'parent' ? profile.work : undefined,
    relevanceProfile: memberKind === 'child' ? profile.relevance : undefined,
    linkedAuthUserId: row.linked_auth_user_id ?? undefined,
  }
}

export async function fetchFamilyMembers(userId: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('id, name, color_tint, color_accent, member_kind, profile, linked_auth_user_id')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[familyApi] fetchFamilyMembers error', error)
    return []
  }
  return (data ?? []).map((row) => mapRowToPerson(row as Parameters<typeof mapRowToPerson>[0]))
}

export async function updateFamilyMember(
  userId: string,
  memberId: string,
  updates: {
    name?: string
    color_tint?: string
    color_accent?: string
    sort_order?: number
    member_kind?: MemberKind
    profile?: ProfileRow
  }
): Promise<boolean> {
  const payload: Record<string, unknown> = {}
  if (updates.name != null) payload.name = updates.name
  if (updates.color_tint != null) payload.color_tint = updates.color_tint
  if (updates.color_accent != null) payload.color_accent = updates.color_accent
  if (updates.sort_order != null) payload.sort_order = updates.sort_order
  if (updates.member_kind != null) payload.member_kind = updates.member_kind
  if (updates.profile != null) payload.profile = updates.profile
  if (Object.keys(payload).length === 0) return true

  const { error } = await supabase
    .from('family_members')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', memberId)

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[familyApi] updateFamilyMember error', error)
    return false
  }
  return true
}

export async function addFamilyMember(
  userId: string,
  member: {
    id: string
    name: string
    color_tint: string
    color_accent: string
    sort_order: number
    member_kind?: MemberKind
    profile?: ProfileRow
  }
): Promise<Person | null> {
  const { data, error } = await supabase
    .from('family_members')
    .insert({
      user_id: userId,
      id: member.id,
      name: member.name,
      color_tint: member.color_tint,
      color_accent: member.color_accent,
      sort_order: member.sort_order,
      member_kind: member.member_kind ?? 'child',
      profile: member.profile ?? {},
    })
    .select('id, name, color_tint, color_accent, member_kind, profile, linked_auth_user_id')
    .single()

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[familyApi] addFamilyMember error', error)
    return null
  }
  return mapRowToPerson(data as Parameters<typeof mapRowToPerson>[0])
}

export async function deleteFamilyMemberAndEvents(memberId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_family_member_and_events_keep_owner', {
    p_member_id: memberId,
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[familyApi] deleteFamilyMemberAndEvents error', error)
    return false
  }
  const result = data as { ok?: boolean } | null
  return result?.ok === true
}
