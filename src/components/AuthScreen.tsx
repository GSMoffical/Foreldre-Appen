import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

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
    <div className="flex min-h-full w-full flex-col items-center justify-center bg-synkaCream px-6 py-12">
      {inviteParam && (
        <div className="mb-6 w-full max-w-sm rounded-md border border-synkaTeal/30 bg-synkaTeal/10 px-4 py-2.5 text-[12px] text-synkaNavy/80" role="status">
          Du har blitt invitert til en familie. Logg inn eller opprett konto for å akseptere invitasjonen.
        </div>
      )}

      {/* S-mark */}
      <img src="/synka-mark.svg" alt="Synka" className="w-32 h-32" />

      {/* Wordmark */}
      <p className="mt-3 text-[32px] font-bold leading-none text-synkaPrimary">synka</p>

      {/* Tagline */}
      <p className="mt-2 text-[14px] text-synkaNavy/60">
        Mindre kaos. Mer tid{' '}
        <span className="font-medium text-synkaTeal">sammen.</span>
      </p>

      <div className="mt-8 w-full max-w-sm">
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {inviteParam && (
            <fieldset className="space-y-2">
              <legend className="text-[11px] font-medium uppercase tracking-wide text-synkaNavy/60">
                Når du blir med i familien, er du:
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2.5 text-[13px] font-medium transition ${
                    effectiveInviteMemberKind === 'parent'
                      ? 'border-synkaPrimary bg-synkaPrimary/10 text-synkaNavy'
                      : 'border-synkaNavy/15 bg-white/60 text-synkaNavy/70'
                  }`}
                >
                  <input
                    type="radio"
                    name="invite-member-kind"
                    value="parent"
                    checked={effectiveInviteMemberKind === 'parent'}
                    onChange={() => { setInviteMemberKind('parent'); clearMessages() }}
                    className="sr-only"
                  />
                  Voksen
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2.5 text-[13px] font-medium transition ${
                    effectiveInviteMemberKind === 'child'
                      ? 'border-synkaPrimary bg-synkaPrimary/10 text-synkaNavy'
                      : 'border-synkaNavy/15 bg-white/60 text-synkaNavy/70'
                  }`}
                >
                  <input
                    type="radio"
                    name="invite-member-kind"
                    value="child"
                    checked={effectiveInviteMemberKind === 'child'}
                    onChange={() => { setInviteMemberKind('child'); clearMessages() }}
                    className="sr-only"
                  />
                  Barn
                </label>
              </div>
            </fieldset>
          )}

          {mode === 'signup' && (
            <>
              <div className="space-y-1.5">
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-synkaNavy/60" htmlFor="auth-name">
                  Ditt navn
                </label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="F.eks. Anne eller Ola"
                  className="w-full rounded-md border border-synkaNavy/15 bg-white/70 px-4 py-3 text-[14px] text-zinc-900 outline-none focus:border-synkaPrimary focus:ring-1 focus:ring-synkaPrimary/20"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearMessages() }}
                />
                <p className="text-[11px] text-synkaNavy/40">Hvem du er i familien – vises i appen</p>
              </div>
              {!inviteParam && (
                <div className="space-y-1.5">
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-synkaNavy/60" htmlFor="auth-family-name">
                    Familienavn
                  </label>
                  <input
                    id="auth-family-name"
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="F.eks. Olsen eller Hansen"
                    className="w-full rounded-md border border-synkaNavy/15 bg-white/70 px-4 py-3 text-[14px] text-zinc-900 outline-none focus:border-synkaPrimary focus:ring-1 focus:ring-synkaPrimary/20"
                    value={familyName}
                    onChange={(e) => { setFamilyName(e.target.value); clearMessages() }}
                  />
                  <p className="text-[11px] text-synkaNavy/40">Navnet på familien – vises øverst i appen</p>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-synkaNavy/60" htmlFor="auth-email">
              E-post
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border border-synkaNavy/15 bg-white/70 px-4 py-3 text-[14px] text-zinc-900 outline-none focus:border-synkaPrimary focus:ring-1 focus:ring-synkaPrimary/20 aria-[invalid]:border-synkaCoral"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearMessages() }}
              aria-invalid={!!error}
              aria-describedby={error ? 'auth-error' : undefined}
            />
          </div>

          <div className="space-y-1.5">
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-synkaNavy/60" htmlFor="auth-password">
              Passord
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
              className="w-full rounded-md border border-synkaNavy/15 bg-white/70 px-4 py-3 text-[14px] text-zinc-900 outline-none focus:border-synkaPrimary focus:ring-1 focus:ring-synkaPrimary/20 aria-[invalid]:border-synkaCoral"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearMessages() }}
              aria-invalid={!!error}
            />
            {mode === 'signup' && (
              <p className="text-[11px] text-synkaNavy/40">Minst {MIN_PASSWORD_LENGTH} tegn</p>
            )}
          </div>

          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-synkaNavy/60" htmlFor="auth-confirm-password">
                Gjenta passord
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-md border border-synkaNavy/15 bg-white/70 px-4 py-3 text-[14px] text-zinc-900 outline-none focus:border-synkaPrimary focus:ring-1 focus:ring-synkaPrimary/20 aria-[invalid]:border-synkaCoral"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearMessages() }}
                aria-invalid={!!(error && error.includes('Passordene'))}
              />
            </div>
          )}

          {error && (
            <p id="auth-error" className="text-[12px] text-synkaCoral" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-[12px] text-synkaTeal" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-12 w-full rounded-pill bg-synkaPrimary text-[16px] font-semibold text-white transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-synkaPrimary/40 touch-manipulation select-none"
          >
            {loading ? 'Vennligst vent…' : mode === 'signin' ? 'Logg inn' : 'Opprett konto'}
          </button>
        </form>

        <div className="mt-5 text-center text-[13px] text-synkaNavy/50">
          {mode === 'signin' ? (
            <button
              type="button"
              className="font-semibold text-synkaPrimary transition hover:text-synkaPrimary/70 focus:outline-none"
              onClick={() => switchMode('signup')}
            >
              Ny bruker? Opprett konto
            </button>
          ) : (
            <button
              type="button"
              className="font-semibold text-synkaPrimary transition hover:text-synkaPrimary/70 focus:outline-none"
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
