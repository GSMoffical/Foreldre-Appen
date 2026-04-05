import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PersonId } from '../types'
import { useAuth } from './AuthContext'

interface UserPreferencesValue {
  currentPersonId: PersonId | null
  setCurrentPersonId: (id: PersonId | null) => void
  /** Lett vibrasjon ved lagring (kun touch-enheter; brukeren må skru på). */
  hapticsEnabled: boolean
  setHapticsEnabled: (value: boolean) => void
}

const UserPreferencesContext = createContext<UserPreferencesValue | undefined>(undefined)

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [currentPersonId, setCurrentPersonId] = useState<PersonId | null>(null)
  const [hapticsEnabled, setHapticsEnabled] = useState(false)

  // Load from localStorage per user
  useEffect(() => {
    const key = user ? `pc_prefs_${user.id}` : null
    if (!key) {
      setCurrentPersonId(null)
      setHapticsEnabled(false)
      return
    }
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw) as { currentPersonId?: PersonId | null; hapticsEnabled?: boolean }
      if (parsed.currentPersonId) {
        setCurrentPersonId(parsed.currentPersonId)
      }
      if (typeof parsed.hapticsEnabled === 'boolean') {
        setHapticsEnabled(parsed.hapticsEnabled)
      }
    } catch {
      // Ignore parse errors and fall back to default
    }
  }, [user])

  // Persist when changed
  useEffect(() => {
    const key = user ? `pc_prefs_${user.id}` : null
    if (!key) return
    try {
      const payload = JSON.stringify({ currentPersonId, hapticsEnabled })
      window.localStorage.setItem(key, payload)
    } catch {
      // Ignore storage errors
    }
  }, [user, currentPersonId, hapticsEnabled])

  return (
    <UserPreferencesContext.Provider
      value={{ currentPersonId, setCurrentPersonId, hapticsEnabled, setHapticsEnabled }}
    >
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences(): UserPreferencesValue {
  const ctx = useContext(UserPreferencesContext)
  if (!ctx) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider')
  }
  return ctx
}

