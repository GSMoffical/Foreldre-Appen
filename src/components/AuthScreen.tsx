import { useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { inputBase } from '../lib/ui'
import { INPUT_LIMITS } from '../lib/inputLimits'
import { getAuthErrorMessage } from '../lib/authErrors'

const MIN_PASSWORD_LENGTH = INPUT_LIMITS.PASSWORD_MIN
const INVITE_MEMBER_KIND_KEY = 'invite-member-kind'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const reducedMotion = useReducedMotion() ?? false
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
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

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
    setResetSent(false)
    setResetError(null)
  }, [])

  async function handleForgotPassword() {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setResetError('Skriv inn e-postadressen din først.')
      setResetSent(false)
      return
    }
    setResetError(null)
    setResetSent(false)
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined,
      })
      if (resetErr) throw resetErr
      setResetSent(true)
    } catch (err: unknown) {
      setResetError(
        err instanceof Error
          ? getAuthErrorMessage({ message: err.message, code: (err as { code?: string }).code })
          : 'Noe gikk galt. Prøv igjen.'
      )
    }
  }

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
      setError(err instanceof Error ? err.message : 'Noe gikk galt. Sjekk internettforbindelsen og prøv igjen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center bg-synkaCream px-6 py-12">
      {inviteParam && (
        <div className="mb-6 w-full max-w-sm rounded-md border border-synkaTeal/30 bg-synkaTeal/10 px-4 py-2.5 text-caption text-synkaNavy/80" role="status">
          Du har blitt invitert til en familie. Logg inn eller opprett konto for å akseptere invitasjonen.
        </div>
      )}

      {/* S-mark — wakes up first */}
      <motion.img
        src="/synka-mark.svg"
        alt="Synka"
        className="w-32 h-32"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
        animate={
          reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, transition: { duration: 0.6, ease: 'easeOut' } }
        }
      />

      {/* Wordmark — fades in after the mark */}
      <motion.p
        className="mt-3 text-[32px] font-bold leading-none text-synkaPrimary"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, transition: { duration: 0.4, ease: 'easeOut', delay: 0.8 } }}
      >
        synka
      </motion.p>

      {/* Tagline — last to settle */}
      <motion.p
        className="mt-2 text-body-sm text-synkaNavy/60"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, transition: { duration: 0.4, ease: 'easeOut', delay: 1.0 } }}
      >
        Mindre kaos. Mer tid{' '}
        <span className="font-medium text-synkaTeal">sammen.</span>
      </motion.p>

      <div className="mt-8 w-full max-w-sm">
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {inviteParam && (
            <fieldset className="space-y-2">
              <legend className="text-caption font-medium uppercase tracking-wide text-synkaNavy/60">
                Når du blir med i familien, er du:
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2.5 text-body-sm font-medium transition ${
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
                  Forelder
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2.5 text-body-sm font-medium transition ${
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
                <label className="mb-1.5 block text-caption font-medium uppercase tracking-wide text-synkaNavy/60" htmlFor="auth-name">
                  Ditt navn
                </label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="F.eks. Anne eller Ola"
                  className={`${inputBase} w-full`}
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearMessages() }}
                />
                <p className="text-caption text-synkaNavy/40">Hvem du er i familien – vises i appen</p>
              </div>
              {!inviteParam && (
                <div className="space-y-1.5">
                  <label className="mb-1.5 block text-caption font-medium uppercase tracking-wide text-synkaNavy/60" htmlFor="auth-family-name">
                    Familienavn
                  </label>
                  <input
                    id="auth-family-name"
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="F.eks. Olsen eller Hansen"
                    className={`${inputBase} w-full`}
                    value={familyName}
                    onChange={(e) => { setFamilyName(e.target.value); clearMessages() }}
                  />
                  <p className="text-caption text-synkaNavy/40">Navnet på familien – vises øverst i appen</p>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <label className="mb-1.5 block text-caption font-medium uppercase tracking-wide text-synkaNavy/60" htmlFor="auth-email">
              E-post
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              className={`${inputBase} w-full aria-[invalid]:border-synkaCoral`}
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearMessages() }}
              aria-invalid={!!error && (error.toLowerCase().includes('e-post') || error.toLowerCase().includes('bruker'))}
              aria-describedby={error ? 'auth-error' : undefined}
            />
          </div>

          <div className="space-y-1.5">
            <label className="mb-1.5 block text-caption font-medium uppercase tracking-wide text-synkaNavy/60" htmlFor="auth-password">
              Passord
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
                maxLength={INPUT_LIMITS.PASSWORD_MAX}
                className={`${inputBase} w-full pr-10 aria-[invalid]:border-synkaCoral`}
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearMessages() }}
                aria-invalid={!!error && error.toLowerCase().includes('passord')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Skjul passord' : 'Vis passord'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-synkaNavy/40 transition hover:text-synkaNavy/70 active:opacity-70"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
            {mode === 'signup' && (
              <p className="text-caption text-synkaNavy/40">Minst {MIN_PASSWORD_LENGTH} tegn</p>
            )}
            {mode === 'signin' && (
              <div className="flex flex-col items-end gap-1 mt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-body-sm text-synkaPrimary/70 transition hover:text-synkaPrimary active:opacity-70"
                >
                  Glemt passord?
                </button>
                {resetSent && (
                  <p className="text-caption text-synkaTeal">Vi har sendt deg en e-post med instruksjoner</p>
                )}
                {resetError && (
                  <p className="text-caption text-synkaCoral">{resetError}</p>
                )}
              </div>
            )}
          </div>

          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="mb-1.5 block text-caption font-medium uppercase tracking-wide text-synkaNavy/60" htmlFor="auth-confirm-password">
                Gjenta passord
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                className={`${inputBase} w-full aria-[invalid]:border-synkaCoral`}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearMessages() }}
                aria-invalid={!!(error && error.includes('Passordene'))}
              />
            </div>
          )}

          {error && (
            <p id="auth-error" className="text-caption text-synkaCoral" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-caption text-synkaTeal" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-12 w-full rounded-pill bg-synkaPrimary text-body font-semibold text-white transition disabled:opacity-60 active:opacity-70 focus:outline-none focus:ring-2 focus:ring-synkaPrimary/40 touch-manipulation select-none"
          >
            {loading ? 'Vennligst vent…' : mode === 'signin' ? 'Logg inn' : 'Opprett konto'}
          </button>
        </form>

        <div className="mt-5 text-center text-body-sm text-synkaNavy/50">
          {mode === 'signin' ? (
            <button
              type="button"
              className="border border-synkaPrimary text-synkaPrimary rounded-pill px-6 py-2 font-medium text-body-sm w-full transition hover:bg-synkaPrimary/5 active:opacity-70 focus:outline-none"
              onClick={() => switchMode('signup')}
            >
              Ny bruker? Opprett konto
            </button>
          ) : (
            <button
              type="button"
              className="font-semibold text-synkaPrimary transition hover:text-synkaPrimary/70 active:opacity-70 focus:outline-none"
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
