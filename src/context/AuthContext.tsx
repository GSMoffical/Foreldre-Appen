import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { getAuthErrorMessage } from '../lib/authErrors'
import { upsertProfile } from '../lib/profileApi'
import { addFamilyMember } from '../lib/familyApi'

export interface SignUpOptions {
  displayName: string
  familyName?: string | null
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, options: SignUpOptions) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      setLoading(false)
      return
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setUser(data.session?.user ?? null)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))

    return () => subscription.unsubscribe()
  }, [])

  function ensureSupabaseConfigured() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Innlogging er ikke konfigurert i denne builden (mangler VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY).'
      )
    }
  }

  function mapAuthNetworkError(err: unknown): Error {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase()
      if (
        msg.includes('failed to fetch') ||
        msg.includes('fetch failed') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed')
      ) {
        return new Error(
          'Kunne ikke kontakte innloggingstjenesten. Sjekk nettverk, HTTPS og Supabase URL/keys i produksjonsbuild.'
        )
      }
      return err
    }
    return new Error('Kunne ikke kontakte innloggingstjenesten.')
  }

  async function signIn(email: string, password: string) {
    ensureSupabaseConfigured()
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw new Error(getAuthErrorMessage(error))
    } catch (err: unknown) {
      throw mapAuthNetworkError(err)
    }
  }

  async function signUp(email: string, password: string, options: SignUpOptions) {
    ensureSupabaseConfigured()
    const { displayName, familyName } = options
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined,
          data: { display_name: displayName },
        },
      })
      if (error) throw new Error(getAuthErrorMessage(error))
      if (data?.user) {
        await upsertProfile(data.user.id, {
          display_name: displayName.trim(),
          family_name: familyName?.trim() || null,
        })
        // Ensure the newly created user is also added as a family member
        const trimmedName = displayName.trim()
        if (trimmedName) {
          const memberId = `self-${data.user.id}`
          const tint = '#fef9c3'   // soft warm tint
          const accent = '#f59e0b' // warm accent
          try {
            await addFamilyMember(data.user.id, {
              id: memberId,
              name: trimmedName,
              color_tint: tint,
              color_accent: accent,
              sort_order: 0,
              member_kind: 'parent',
            })
          } catch {
            // If this fails, we still allow signup to succeed
            // eslint-disable-next-line no-console
            console.error('[auth] failed to create initial family member for user')
          }
        }
      }
    } catch (err: unknown) {
      throw mapAuthNetworkError(err)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

