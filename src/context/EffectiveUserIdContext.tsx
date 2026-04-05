import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getMyLink, unlink as unlinkApi } from '../lib/inviteApi'

interface EffectiveUserIdContextValue {
  /** User id to use for family and events (self or linked family owner). */
  effectiveUserId: string | null
  /** True if current user is viewing someone else's family. */
  isLinked: boolean
  /** Leave the shared family and use own data again. */
  unlink: () => Promise<void>
  /** Re-fetch link (e.g. after accepting an invite). */
  refetch: () => Promise<void>
}

const EffectiveUserIdContext = createContext<EffectiveUserIdContextValue | undefined>(undefined)

export function EffectiveUserIdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [linkedToUserId, setLinkedToUserId] = useState<string | null>(null)
  const [, setLoading] = useState(true)

  const fetchLink = useCallback(async () => {
    if (!user) {
      setLinkedToUserId(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const link = await getMyLink(user.id)
    setLinkedToUserId(link?.linkedToUserId ?? null)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    fetchLink()
  }, [fetchLink])

  const unlink = useCallback(async () => {
    if (!user) return
    const ok = await unlinkApi(user.id)
    if (ok) setLinkedToUserId(null)
  }, [user?.id])

  const effectiveUserId = user ? (linkedToUserId ?? user.id) : null
  const isLinked = !!linkedToUserId

  const value: EffectiveUserIdContextValue = {
    effectiveUserId,
    isLinked,
    unlink,
    refetch: fetchLink,
  }

  return (
    <EffectiveUserIdContext.Provider value={value}>
      {children}
    </EffectiveUserIdContext.Provider>
  )
}

export function useEffectiveUserId(): EffectiveUserIdContextValue {
  const ctx = useContext(EffectiveUserIdContext)
  if (!ctx) throw new Error('useEffectiveUserId must be used within EffectiveUserIdProvider')
  return ctx
}
