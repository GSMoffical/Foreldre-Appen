import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { Person } from '../types'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'
import { useEffectiveUserId } from './EffectiveUserIdContext'
import { PEOPLE as DEFAULT_PEOPLE } from '../data/mockSchedule'
import {
  updateFamilyMember,
  addFamilyMember,
  deleteFamilyMemberAndEvents,
} from '../lib/familyApi'
import { fetchProfile } from '../lib/profileApi'
import { formatFamilyLoadError, formatFamilySeedError } from '../lib/supabaseErrors'
import { useMobileRefreshTriggers, useRealtimeRefresh } from '../features/sync/useRefreshTriggers'

interface FamilyContextValue {
  people: Person[]
  loading: boolean
  error: string | null
  updatePerson: (
    id: string,
    updates: Partial<Pick<Person, 'name' | 'colorTint' | 'colorAccent' | 'memberKind' | 'school' | 'work'>>
  ) => Promise<void>
  addPerson: (
    person: Pick<Person, 'name' | 'colorTint' | 'colorAccent' | 'memberKind'> & {
      school?: Person['school']
      work?: Person['work']
    }
  ) => Promise<Person | null>
  removePerson: (id: string) => Promise<void>
}

const FamilyContext = createContext<FamilyContextValue | undefined>(undefined)

const ERR_LINKED_ADD =
  'Kun eieren av kalenderen kan legge til familiemedlemmer.'
const ERR_LINKED_REMOVE =
  'Kun eieren av kalenderen kan fjerne familiemedlemmer.'
const ERR_LINKED_EDIT_OTHERS =
  'Du kan bare endre ditt eget navn og farge. Andre medlemmer administreres av eieren av kalenderen.'
const ERR_CANNOT_REMOVE_SELF =
  'Du kan ikke fjerne deg selv fra familien.'
const INVITE_MEMBER_KIND_KEY = 'invite-member-kind'

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { effectiveUserId, isLinked } = useEffectiveUserId()
  const [people, setPeople] = useState<Person[]>(DEFAULT_PEOPLE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const didInitialLoadRef = useRef(false)
  const refreshDebounceRef = useRef<number | null>(null)
  const loadInFlightRef = useRef(false)
  const loadRequestIdRef = useRef(0)

  const queueRefresh = useCallback(() => {
    if (refreshDebounceRef.current != null) return
    refreshDebounceRef.current = window.setTimeout(() => {
      refreshDebounceRef.current = null
      setRefreshKey((k) => k + 1)
    }, 350)
  }, [])

  // Mobile/PWA fallback: visibility/focus/pageshow + visible polling.
  useMobileRefreshTriggers({
    enabled: Boolean(user && effectiveUserId),
    onRefresh: queueRefresh,
    includeVisibilityChange: true,
  })

  // Live updates: refresh family_members immediately when the family changes.
  useRealtimeRefresh({
    enabled: Boolean(user && effectiveUserId),
    channelName: `realtime-family-members-${effectiveUserId ?? 'none'}`,
    table: 'family_members',
    filter: `user_id=eq.${effectiveUserId ?? ''}`,
    onRefresh: queueRefresh,
  })

  useEffect(() => {
    async function loadFamily() {
      if (!user || !effectiveUserId) {
        setPeople(DEFAULT_PEOPLE)
        setError(null)
        return
      }
      const shouldShowLoading = !didInitialLoadRef.current
      if (shouldShowLoading) setLoading(true)
      setError(null)
      if (loadInFlightRef.current) return
      loadInFlightRef.current = true
      const requestId = ++loadRequestIdRef.current
      const { data, error: loadErr } = await supabase
        .from('family_members')
        .select('id, name, color_tint, color_accent, member_kind, profile, linked_auth_user_id')
        .eq('user_id', effectiveUserId)
        .order('sort_order', { ascending: true })
      if (requestId !== loadRequestIdRef.current) {
        loadInFlightRef.current = false
        return
      }

      if (loadErr) {
        // eslint-disable-next-line no-console
        console.error('[family] load error', loadErr)
        setPeople(DEFAULT_PEOPLE)
        setError(formatFamilyLoadError(loadErr))
        if (shouldShowLoading) setLoading(false)
        loadInFlightRef.current = false
        return
      }

      if (!data || data.length === 0) {
        // Seed default people for this user
        const payload = DEFAULT_PEOPLE.map((p, index) => ({
          user_id: effectiveUserId,
          id: p.id,
          name: p.name,
          color_tint: p.colorTint,
          color_accent: p.colorAccent,
          sort_order: index,
          member_kind: p.memberKind,
          profile:
            p.memberKind === 'child' && p.school
              ? { school: p.school }
              : p.memberKind === 'parent' && p.work
                ? { work: p.work }
                : {},
        }))
        const { error: insertError } = await supabase.from('family_members').insert(payload)
        if (insertError) {
          // eslint-disable-next-line no-console
          console.error('[family] seed error', insertError)
          setPeople(DEFAULT_PEOPLE)
          setError(formatFamilySeedError(insertError))
          if (shouldShowLoading) setLoading(false)
          loadInFlightRef.current = false
          return
        }
        setPeople(DEFAULT_PEOPLE)
        if (shouldShowLoading) setLoading(false)
        didInitialLoadRef.current = true
        loadInFlightRef.current = false
        return
      }

      const mapped: Person[] = data.map(
        (row: {
          id: string
          name: string
          color_tint: string
          color_accent: string
          member_kind?: string | null
          profile?: { school?: Person['school']; work?: Person['work'] } | null
          linked_auth_user_id?: string | null
        }) => {
          const memberKind = row.member_kind === 'parent' ? 'parent' : 'child'
          const pr = row.profile ?? {}
          return {
            id: row.id,
            name: row.name,
            colorTint: row.color_tint,
            colorAccent: row.color_accent,
            memberKind,
            school: memberKind === 'child' ? pr.school : undefined,
            work: memberKind === 'parent' ? pr.work : undefined,
            linkedAuthUserId: row.linked_auth_user_id ?? undefined,
          }
        }
      )

      // If we're a linked user viewing the owner's family, ensure we're in their family list
      // so the owner sees us and we see the full family — unless we already claimed a parent row
      // (linked_auth_user_id) via invite.
      const isLinked = user && effectiveUserId && effectiveUserId !== user.id
      const claimedParentRow = user && mapped.some((p) => p.linkedAuthUserId === user.id)
      const selfId = user ? `self-${user.id}` : ''
      const alreadyInFamily = selfId && mapped.some((p) => p.id === selfId)
      if (isLinked && selfId && !alreadyInFamily && !claimedParentRow) {
        const profile = await fetchProfile(user.id)
        const preferredInviteKind =
          typeof window !== 'undefined'
            ? (window.localStorage.getItem(INVITE_MEMBER_KIND_KEY) as 'parent' | 'child' | null)
            : null
        const memberKind: 'parent' | 'child' = preferredInviteKind === 'child' ? 'child' : 'parent'
        const fallbackName = memberKind === 'child' ? 'Barn' : 'Voksen'
        const name = (profile?.displayName ?? '').trim() || fallbackName
        const added = await addFamilyMember(effectiveUserId, {
          id: selfId,
          name,
          color_tint: '#fef9c3',
          color_accent: '#f59e0b',
          sort_order: mapped.length,
          member_kind: memberKind,
          profile: {},
        })
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(INVITE_MEMBER_KIND_KEY)
        }
        if (added) {
          setPeople([...mapped, added])
        } else {
          setPeople(mapped)
        }
      } else {
        setPeople(mapped)
      }
      setError(null)
      if (shouldShowLoading) setLoading(false)
      didInitialLoadRef.current = true
      loadInFlightRef.current = false
    }

    loadFamily()
  }, [user, effectiveUserId, refreshKey])

  useEffect(
    () => () => {
      if (refreshDebounceRef.current != null) {
        window.clearTimeout(refreshDebounceRef.current)
      }
    },
    []
  )

  const updatePerson = useCallback(
    async (
      id: string,
      updates: Partial<Pick<Person, 'name' | 'colorTint' | 'colorAccent' | 'memberKind' | 'school' | 'work'>>
    ) => {
      if (!effectiveUserId) throw new Error('Must be signed in to edit family')
      if (isLinked) {
        if (!user) throw new Error(ERR_LINKED_EDIT_OTHERS)
        const selfId = `self-${user.id}`
        const claimedId = people.find((p) => p.linkedAuthUserId === user.id)?.id
        if (id !== selfId && id !== claimedId) throw new Error(ERR_LINKED_EDIT_OTHERS)
      }
      const next = people.find((p) => p.id === id)
      const merged: Person | undefined = next
        ? {
            ...next,
            ...updates,
            school: updates.school !== undefined ? updates.school : next.school,
            work: updates.work !== undefined ? updates.work : next.work,
          }
        : undefined
      const profilePayload =
        merged &&
        (merged.memberKind === 'child'
          ? { school: merged.school }
          : { work: merged.work })

      const ok = await updateFamilyMember(effectiveUserId, id, {
        name: updates.name,
        color_tint: updates.colorTint,
        color_accent: updates.colorAccent,
        member_kind: updates.memberKind,
        profile: profilePayload ?? undefined,
      })
      if (!ok) throw new Error('Could not update family member')
      setPeople((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                ...updates,
                school: updates.school !== undefined ? updates.school : p.school,
                work: updates.work !== undefined ? updates.work : p.work,
              }
            : p
        )
      )
    },
    [effectiveUserId, isLinked, user, people]
  )

  const addPerson = useCallback(
    async (
      person: Pick<Person, 'name' | 'colorTint' | 'colorAccent' | 'memberKind'> & {
        school?: Person['school']
        work?: Person['work']
      }
    ): Promise<Person | null> => {
      if (!effectiveUserId) throw new Error('Must be signed in to add family member')
      if (isLinked) throw new Error(ERR_LINKED_ADD)
      const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const sortOrder = people.length
      const profile =
        person.memberKind === 'child' && person.school
          ? { school: person.school }
          : person.memberKind === 'parent' && person.work
            ? { work: person.work }
            : {}
      const created = await addFamilyMember(effectiveUserId, {
        id,
        name: person.name,
        color_tint: person.colorTint,
        color_accent: person.colorAccent,
        sort_order: sortOrder,
        member_kind: person.memberKind,
        profile,
      })
      if (!created) throw new Error('Could not add family member')
      setPeople((prev) => [...prev, created])
      return created
    },
    [effectiveUserId, people.length, isLinked]
  )

  const removePerson = useCallback(
    async (id: string) => {
      if (!effectiveUserId) throw new Error('Must be signed in to remove family member')
      if (isLinked) throw new Error(ERR_LINKED_REMOVE)
      if (user) {
        const selfId = `self-${user.id}`
        const claimedId = people.find((p) => p.linkedAuthUserId === user.id)?.id
        if (id === selfId || id === claimedId) {
          throw new Error(ERR_CANNOT_REMOVE_SELF)
        }
      }
      const ok = await deleteFamilyMemberAndEvents(id)
      if (!ok) throw new Error('Could not remove family member')
      setPeople((prev) => prev.filter((p) => p.id !== id))
    },
    [effectiveUserId, isLinked, user, people]
  )

  return (
    <FamilyContext.Provider value={{ people, loading, error, updatePerson, addPerson, removePerson }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily(): FamilyContextValue {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamily must be used within FamilyProvider')
  return ctx
}

