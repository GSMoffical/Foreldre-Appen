import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { SynkaLogoIcon, SynkaWordmark } from './ui/SynkaLogo'
import { Input } from './ui'
import { SynkaButton } from './ui/SynkaButton'
import { SynkaDecorativeShape } from './ui/SynkaDecorativeShape'

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

      {/* ── Green hero section ─────────────────────────────────────────── */}
      <div
        className="relative flex flex-col items-center overflow-hidden px-6 pb-10 pt-12"
        style={{ background: 'linear-gradient(160deg, #14472f 0%, #1d5a3f 60%, #245a43 100%)' }}
      >
        {/* Decorative shapes from brand assets */}
        <SynkaDecorativeShape
          variant="mint"
          size={160}
          opacity={0.28}
          className="absolute -right-10 -top-10 pointer-events-none"
        />
        <SynkaDecorativeShape
          variant="yellow"
          size={100}
          opacity={0.22}
          className="absolute -bottom-6 -left-8 pointer-events-none"
        />

        <SynkaLogoIcon size="2xl" className="relative z-10 drop-shadow-lg" />
        <SynkaWordmark variant="beige" width={130} className="relative z-10 mt-4" />
        <p className="relative z-10 mt-2 text-center text-[13px] font-medium leading-snug text-white/60">
          {mode === 'signin'
            ? 'Familiekalender for deg og partneren din.'
            : 'Start din felles familiekalender i dag.'}
        </p>

        {inviteParam && (
          <div className="relative z-10 mt-4 w-full max-w-xs rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-center text-[12px] text-white/80" role="status">
            Du er invitert til en familie. Logg inn eller opprett konto for å akseptere.
          </div>
        )}
      </div>

      {/* ── Form card ───────────────────────────────────────────────────── */}
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden px-4 pb-6 pt-5">
        <div className="w-full rounded-2xl bg-white px-5 pb-5 pt-5 shadow-card">
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {inviteParam && (
              <fieldset className="space-y-2">
                <legend className="text-[12px] font-medium text-neutral-500">Når du blir med i familien, er du:</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex cursor-pointer items-center justify-center rounded-full border px-3 py-2 text-[13px] font-medium transition ${
                      effectiveInviteMemberKind === 'parent'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-neutral-200 text-neutral-600'
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
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-neutral-200 text-neutral-600'
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
                <p className="text-[11px] text-neutral-400">
                  Dette styrer hvilken type profil som opprettes i den delte familien.
                </p>
              </fieldset>
            )}
            {mode === 'signup' && (
              <>
                <Input
                  id="auth-name"
                  label="Ditt navn"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="F.eks. Anne eller Ola"
                  hint="Hvem du er i familien – vises i appen"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearMessages() }}
                />
                {!inviteParam && (
                  <Input
                    id="auth-family-name"
                    label="Familienavn"
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="F.eks. Olsen eller Hansen"
                    hint="Navnet på familien – vises øverst i appen"
                    value={familyName}
                    onChange={(e) => { setFamilyName(e.target.value); clearMessages() }}
                  />
                )}
              </>
            )}
            <Input
              id="auth-email"
              label="E-post"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearMessages() }}
              aria-invalid={!!error}
            />
            <Input
              id="auth-password"
              label="Passord"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
              hint={mode === 'signup' ? `Minst ${MIN_PASSWORD_LENGTH} tegn` : undefined}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearMessages() }}
              aria-invalid={!!error}
            />
            {mode === 'signup' && (
              <Input
                id="auth-confirm-password"
                label="Gjenta passord"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearMessages() }}
              />
            )}

            {error && (
              <p id="auth-error" className="rounded-lg bg-semantic-red-50 px-3.5 py-2.5 text-[13px] text-semantic-red-700" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-lg bg-primary-50 px-3.5 py-2.5 text-[13px] text-primary-700" role="status">
                {success}
              </p>
            )}

            <SynkaButton
              type="submit"
              variant="primary"
              shape="pill"
              size="lg"
              loading={loading}
              className="mt-1 w-full"
            >
              {mode === 'signin' ? 'Logg inn' : 'Opprett konto'}
            </SynkaButton>
          </form>

        </div>

        <div className="mt-4 text-center">
          {mode === 'signin' ? (
            <button
              type="button"
              className="text-[13px] font-medium text-neutral-500 hover:text-primary-600 transition focus:outline-none"
              onClick={() => switchMode('signup')}
            >
              Ny bruker? <span className="font-semibold text-primary-600">Opprett konto →</span>
            </button>
          ) : (
            <button
              type="button"
              className="text-[13px] font-medium text-neutral-500 hover:text-primary-600 transition focus:outline-none"
              onClick={() => switchMode('signin')}
            >
              Har konto? <span className="font-semibold text-primary-600">Logg inn →</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
