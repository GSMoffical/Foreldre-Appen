import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useEffectiveUserId } from './EffectiveUserIdContext'
import { fetchProfile } from '../lib/profileApi'

interface ProfileContextValue {
  /** Current user's display name (who they are in the family). */
  displayName: string | null
  /** Family name (owner's) – shown in header when in a family. */
  familyName: string | null
  loading: boolean
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { effectiveUserId } = useEffectiveUserId()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [familyName, setFamilyName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setDisplayName(null)
      setFamilyName(null)
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      fetchProfile(user.id),
      effectiveUserId ? fetchProfile(effectiveUserId) : Promise.resolve(null),
    ]).then(([myProfile, ownerProfile]) => {
      setDisplayName(myProfile?.displayName ?? null)
      setFamilyName(ownerProfile?.familyName ?? null)
      setLoading(false)
    })
  }, [user?.id, effectiveUserId])

  return (
    <ProfileContext.Provider value={{ displayName, familyName, loading }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
