import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.svg'

const MIN_PASSWORD_LENGTH = 6
const INVITE_MEMBER_KIND_KEY = 'invite-member-kind'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteMemberKind, setInviteMemberKind] = useState<'parent' | 'child'>('parent')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const clearMessages = useCallback(() => {
    setError(null)
    setSuccess(null)
  }, [])

  const inviteParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('invite') : null
  const inviteKindFromStorage =
    typeof window !== 'undefined'
      ? (window.localStorage.getItem(INVITE_MEMBER_KIND_KEY) as 'parent' | 'child' | null)
      : null
  const effectiveInviteMemberKind = inviteKindFromStorage === 'child' ? 'child' : inviteMemberKind
  const switchMode = useCallback((newMode: 'signin' | 'signup') => {
    setMode(newMode)
    setError(null)
    setSuccess(null)
    setConfirmPassword('')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Skriv inn e-postadressen din.')
      return
    }
    if (!password) {
      setError(mode === 'signin' ? 'Skriv inn passord.' : 'Velg et passord.')
      return
    }
    if (mode === 'signup') {
      const trimmedName = name.trim()
      if (!trimmedName) {
        setError('Skriv inn ditt navn (hvem du er i familien).')
        return
      }
      if (!inviteParam) {
        const trimmedFamily = familyName.trim()
        if (!trimmedFamily) {
          setError('Gi familien et navn (f.eks. Olsen eller Hansen).')
          return
        }
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Passordet må være minst ${MIN_PASSWORD_LENGTH} tegn.`)
        return
      }
      if (password !== confirmPassword) {
        setError('Passordene stemmer ikke overens.')
        return
      }
    }

    setLoading(true)
    try {
      if (inviteParam && typeof window !== 'undefined') {
        window.localStorage.setItem(INVITE_MEMBER_KIND_KEY, effectiveInviteMemberKind)
      }
      if (mode === 'signin') {
        await signIn(trimmedEmail, password)
      } else {
        await signUp(trimmedEmail, password, {
          displayName: name.trim(),
          familyName: inviteParam ? null : familyName.trim() || null,
        })
        setSuccess('Konto opprettet. Sjekk e-posten din for bekreftelseslenke – deretter kan du logge inn her.')
        setPassword('')
        setConfirmPassword('')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt. Prøv igjen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden">
      {inviteParam && (
        <div className="mx-3 mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-[12px] text-zinc-800" role="status">
          Du har blitt invitert til en familie. Logg inn eller opprett konto for å akseptere invitasjonen.
        </div>
      )}
      <header className="flex flex-col px-4 pt-3 pb-4 bg-white rounded-b-[32px] border-b border-zinc-200">
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>9:41</span>
          <div className="flex items-center gap-1" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-zinc-400" />
            <span className="h-2 w-4 rounded bg-zinc-400" />
            <span className="h-2 w-5 rounded bg-zinc-400" />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[22px] font-bold text-brandNavy drop-shadow-[0_3px_0_rgba(255,255,255,0.9)]">
              ForeldrePortalen
            </h1>
            <p className="mt-1 text-[12px] text-zinc-700">
              {mode === 'signin'
                ? 'Logg inn for å se familiens ukeplan.'
                : 'Opprett konto for å dele kalender med andre foreldre.'}
            </p>
          </div>
          <div className="relative h-14 w-14 overflow-hidden rounded-[24px] bg-white border border-zinc-200 shadow-card">
            <img
              src={logo}
              alt="ForeldrePortalen logo"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </header>

      <div className="mt-3 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden px-3 pb-4">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden rounded-[32px] border-2 border-brandNavy/15 bg-white px-6 pb-4 pt-6 shadow-planner">
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {inviteParam && (
              <fieldset className="space-y-2">
                <legend className="text-[12px] font-medium text-zinc-700">Når du blir med i familien, er du:</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex cursor-pointer items-center justify-center rounded-full border px-3 py-2 text-[13px] font-medium transition ${
                      effectiveInviteMemberKind === 'parent'
                        ? 'border-brandTeal bg-brandTeal/10 text-brandNavy'
                        : 'border-zinc-200 text-zinc-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="invite-member-kind"
                      value="parent"
                      checked={effectiveInviteMemberKind === 'parent'}
                      onChange={() => {
                        setInviteMemberKind('parent')
                        clearMessages()
                      }}
                      className="sr-only"
                    />
                    Voksen
                  </label>
                  <label
                    className={`flex cursor-pointer items-center justify-center rounded-full border px-3 py-2 text-[13px] font-medium transition ${
                      effectiveInviteMemberKind === 'child'
                        ? 'border-brandTeal bg-brandTeal/10 text-brandNavy'
                        : 'border-zinc-200 text-zinc-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="invite-member-kind"
                      value="child"
                      checked={effectiveInviteMemberKind === 'child'}
                      onChange={() => {
                        setInviteMemberKind('child')
                        clearMessages()
                      }}
                      className="sr-only"
                    />
                    Barn
                  </label>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Dette styrer hvilken type profil som opprettes i den delte familien.
                </p>
              </fieldset>
            )}
            {mode === 'signup' && (
              <>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-zinc-700" htmlFor="auth-name">
                    Ditt navn
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="F.eks. Anne eller Ola"
                    className="w-full rounded-full border border-zinc-200 px-3 py-2.5 text-[14px] text-zinc-900 outline-none focus:border-zinc-800 focus:ring-2 focus:ring-zinc-500/60"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      clearMessages()
                    }}
                  />
                  <p className="text-[11px] text-zinc-500">
                    Hvem du er i familien – vises i appen
                  </p>
                </div>
                {!inviteParam && (
                  <div className="space-y-1">
                    <label className="text-[12px] font-medium text-zinc-700" htmlFor="auth-family-name">
                      Familienavn
                    </label>
                    <input
                      id="auth-family-name"
                      type="text"
                      autoComplete="off"
                      required
                      placeholder="F.eks. Olsen eller Hansen"
                      className="w-full rounded-full border border-zinc-200 px-3 py-2.5 text-[14px] text-zinc-900 outline-none focus:border-zinc-800 focus:ring-2 focus:ring-zinc-500/60"
                      value={familyName}
                      onChange={(e) => {
                        setFamilyName(e.target.value)
                        clearMessages()
                      }}
                    />
                    <p className="text-[11px] text-zinc-500">
                      Navnet på familien – vises øverst i appen
                    </p>
                  </div>
                )}
              </>
            )}
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-zinc-700" htmlFor="auth-email">
                E-post
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-full border border-zinc-200 px-3 py-2.5 text-[14px] text-zinc-900 outline-none focus:border-zinc-800 focus:ring-2 focus:ring-zinc-500/60 aria-[invalid]:border-red-400"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearMessages()
                }}
                aria-invalid={!!error}
                aria-describedby={error ? 'auth-error' : undefined}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-zinc-700" htmlFor="auth-password">
                Passord
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
                className="w-full rounded-full border border-zinc-200 px-3 py-2.5 text-[14px] text-zinc-900 outline-none focus:border-zinc-800 focus:ring-2 focus:ring-zinc-500/60 aria-[invalid]:border-red-400"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearMessages()
                }}
                aria-invalid={!!error}
              />
              {mode === 'signup' && (
                <p className="text-[11px] text-zinc-500">
                  Minst {MIN_PASSWORD_LENGTH} tegn
                </p>
              )}
            </div>
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-zinc-700" htmlFor="auth-confirm-password">
                  Gjenta passord
                </label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-full border border-zinc-200 px-3 py-2.5 text-[14px] text-zinc-900 outline-none focus:border-zinc-800 focus:ring-2 focus:ring-zinc-500/60 aria-[invalid]:border-red-400"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    clearMessages()
                  }}
                  aria-invalid={!!(error && error.includes('Passordene'))}
                />
              </div>
            )}

            {error && (
              <p id="auth-error" className="text-[12px] text-red-600" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-[12px] text-zinc-700" role="status">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-full bg-brandTeal py-2.5 text-[15px] font-semibold text-white shadow-planner transition hover:brightness-95 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-brandTeal focus:ring-offset-2 active:translate-y-px active:shadow-planner-press"
            >
              {loading ? 'Vennligst vent…' : mode === 'signin' ? 'Logg inn' : 'Opprett konto'}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-zinc-400">
            Supabase: Aktiver e-post under Authentication → Providers → Email hvis innlogging feiler.
          </p>
        </div>

        <div className="mt-4 border border-zinc-200 bg-zinc-50 rounded-[24px] px-4 py-3 text-center text-[12px] text-zinc-800">
          {mode === 'signin' ? (
            <button
              type="button"
              className="font-semibold underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-zinc-300 rounded"
              onClick={() => switchMode('signup')}
            >
              Ny bruker? Opprett konto
            </button>
          ) : (
            <button
              type="button"
              className="font-semibold underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-zinc-300 rounded"
              onClick={() => switchMode('signin')}
            >
              Har du allerede en konto? Logg inn
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
