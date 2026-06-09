import { useState, useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useEffectiveUserId } from '../../context/EffectiveUserIdContext'
import { addFamilyMember } from '../../lib/familyApi'
import { createInvite } from '../../lib/inviteApi'
import {
  btnPrimary,
  inputBase,
  inputLabel,
  inputError,
} from '../../lib/ui'
import { springSnappy } from '../../lib/motion'

export interface OnboardingFlowProps {
  onComplete: () => void
}

const PRESET_COLORS = [
  '#7bc7c4',
  '#f5c842',
  '#f97316',
  '#a78bfa',
  '#34d399',
  '#fb7185',
]

type Step = 1 | 2 | 3 | 4

interface ChildEntry {
  id: string
  name: string
  color: string
}

function stepVariants(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      enter: { opacity: 0 },
      center: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }
  return {
    enter: { opacity: 0, x: 48 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -48 },
  }
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const reducedMotion = useReducedMotion() ?? false
  const { user } = useAuth()
  const { effectiveUserId } = useEffectiveUserId()

  const [step, setStep] = useState<Step>(1)
  const [direction, setDirection] = useState<1 | -1>(1)

  // Step 2 state
  const [children, setChildren] = useState<ChildEntry[]>([])
  const [childName, setChildName] = useState('')
  const [childNameError, setChildNameError] = useState('')
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0])
  const [savingChildren, setSavingChildren] = useState(false)
  const [saveChildrenError, setSaveChildrenError] = useState('')

  // Step 3 state
  const [partnerEmail, setPartnerEmail] = useState('')
  const [partnerEmailError, setPartnerEmailError] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const advance = useCallback((next: Step) => {
    setDirection(1)
    setStep(next)
  }, [])

  // Step 2: add child to local list
  const handleAddChild = useCallback(() => {
    const trimmed = childName.trim()
    if (!trimmed) {
      setChildNameError('Skriv inn barnets navn.')
      return
    }
    setChildNameError('')
    setChildren((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, color: selectedColor },
    ])
    setChildName('')
    setSelectedColor(PRESET_COLORS[0])
  }, [childName, selectedColor])

  // Step 2: save all children and advance
  const handleSaveChildren = useCallback(async () => {
    if (!effectiveUserId) return
    setSavingChildren(true)
    setSaveChildrenError('')
    try {
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const result = await addFamilyMember(effectiveUserId, {
          id: child.id,
          name: child.name,
          color_tint: child.color + '33',
          color_accent: child.color,
          sort_order: i + 1,
          member_kind: 'child',
        })
        if (!result) {
          setSaveChildrenError('Noe gikk galt. Prøv igjen.')
          setSavingChildren(false)
          return
        }
      }
      advance(3)
    } catch {
      setSaveChildrenError('Noe gikk galt. Prøv igjen.')
    } finally {
      setSavingChildren(false)
    }
  }, [children, effectiveUserId, advance])

  // Step 3: send invite
  const handleSendInvite = useCallback(async () => {
    const trimmed = partnerEmail.trim()
    if (!trimmed) {
      setPartnerEmailError('Skriv inn e-postadressen til partneren din.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setPartnerEmailError('Ugyldig e-postadresse.')
      return
    }
    setPartnerEmailError('')
    if (!user?.id) return
    setSendingInvite(true)
    setInviteError('')
    try {
      const result = await createInvite(user.id, trimmed)
      if (!result) {
        setInviteError('Kunne ikke sende invitasjon. Prøv igjen eller hopp over.')
        setSendingInvite(false)
        return
      }
      setInviteSent(true)
      setTimeout(() => advance(4), 1500)
    } catch {
      setInviteError('Noe gikk galt. Prøv igjen eller hopp over.')
    } finally {
      setSendingInvite(false)
    }
  }, [partnerEmail, user, advance])

  const variants = stepVariants(reducedMotion)
  const transition = reducedMotion
    ? { duration: 0.18, ease: 'easeInOut' }
    : { ...springSnappy }

  const completeSummary = (() => {
    const childCount = children.length
    if (childCount > 0 && inviteSent) {
      return `Du har lagt til ${childCount} barn og sendt invitasjon til partneren din.`
    }
    if (childCount > 0) {
      return `Du har lagt til ${childCount} barn. Du kan invitere partneren din når som helst under Mer → Familie.`
    }
    if (inviteSent) {
      return 'Invitasjon sendt! Legg til barn når som helst under Mer → Familie.'
    }
    return 'Kalenderen er klar. Legg til familie når som helst under Mer → Familie.'
  })()

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-synkaCream"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding"
    >
      <div className="relative flex h-full w-full max-w-[428px] flex-col overflow-hidden">
        {/* Progress dots */}
        {step !== 1 && (
          <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 z-10">
            {([2, 3, 4] as const).map((s) => (
              <div
                key={s}
                className="h-1.5 rounded-pill transition-all duration-300"
                style={{
                  width: step === s ? 20 : 6,
                  background: step >= s ? '#166b4f' : '#166b4f33',
                }}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {step === 1 && (
            <motion.div
              key="step1"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="flex flex-1 flex-col items-center justify-center px-8 text-center"
            >
              <img
                src="/synka-mark.svg"
                alt="Synka"
                className="mb-6 h-24 w-24"
                draggable={false}
              />
              <h1 className="text-[28px] font-bold leading-tight text-synkaNavy">
                Velkommen til Synka
              </h1>
              <p className="mt-3 text-body text-synkaNavy/60">
                La oss sette opp familien din. Det tar under ett minutt.
              </p>
              <div className="mt-10 w-full">
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => advance(2)}
                >
                  Kom i gang →
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="flex flex-1 flex-col px-6 pt-14 pb-8 overflow-y-auto"
            >
              <h2 className="text-[22px] font-bold text-synkaNavy">
                Hvem er barna i familien?
              </h2>
              <p className="mt-2 text-body text-synkaNavy/60">
                Legg til ett eller flere barn. Du kan alltid legge til flere senere.
              </p>

              {/* Child list */}
              {children.length > 0 && (
                <ul className="mt-5 space-y-2" aria-label="Barn lagt til">
                  {children.map((child) => (
                    <li
                      key={child.id}
                      className="flex items-center gap-3 rounded-lg border border-synkaNavy/10 bg-white px-4 py-3"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: child.color }}
                        aria-hidden
                      />
                      <span className="text-body text-zinc-800">{child.name}</span>
                      <button
                        type="button"
                        aria-label={`Fjern ${child.name}`}
                        className="ml-auto text-caption text-zinc-400 hover:text-synkaCoral transition"
                        onClick={() =>
                          setChildren((prev) => prev.filter((c) => c.id !== child.id))
                        }
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add child form */}
              <div className="mt-5 rounded-lg border border-synkaNavy/10 bg-white px-4 pb-4 pt-3">
                <div className="space-y-3">
                  <div>
                    <label htmlFor="child-name" className={inputLabel}>
                      Barnets navn
                    </label>
                    <input
                      id="child-name"
                      type="text"
                      className={inputBase}
                      placeholder="F.eks. Emma eller Oliver"
                      maxLength={100}
                      value={childName}
                      onChange={(e) => {
                        setChildName(e.target.value)
                        if (childNameError) setChildNameError('')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddChild()
                        }
                      }}
                      aria-describedby={childNameError ? 'child-name-error' : undefined}
                      aria-invalid={!!childNameError}
                    />
                    {childNameError && (
                      <p id="child-name-error" className={inputError} role="alert">
                        {childNameError}
                      </p>
                    )}
                  </div>

                  {/* Color picker */}
                  <div>
                    <p className={inputLabel} id="color-picker-label">
                      Farge
                    </p>
                    <div
                      className="flex gap-2.5 pt-0.5"
                      role="radiogroup"
                      aria-labelledby="color-picker-label"
                    >
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          role="radio"
                          aria-checked={selectedColor === color}
                          aria-label={`Farge ${color}`}
                          onClick={() => setSelectedColor(color)}
                          className="h-7 w-7 shrink-0 rounded-full transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-synkaPrimary/60"
                          style={{
                            background: color,
                            boxShadow:
                              selectedColor === color
                                ? `0 0 0 2px #fff, 0 0 0 4px ${color}`
                                : undefined,
                            transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddChild}
                    className="w-full rounded-lg border border-synkaPrimary bg-transparent py-2.5 text-body font-semibold text-synkaPrimary transition hover:bg-synkaPrimary/8 active:bg-synkaPrimary/15 focus:outline-none focus:ring-2 focus:ring-synkaPrimary/40"
                  >
                    + Legg til
                  </button>
                </div>
              </div>

              {saveChildrenError && (
                <p className={inputError + ' mt-3'} role="alert">
                  {saveChildrenError}
                </p>
              )}

              <div className="mt-auto pt-6 space-y-2">
                {children.length > 0 && (
                  <button
                    type="button"
                    disabled={savingChildren}
                    className={btnPrimary}
                    onClick={() => void handleSaveChildren()}
                  >
                    {savingChildren ? 'Lagrer…' : 'Neste →'}
                  </button>
                )}
                <button
                  type="button"
                  className="w-full py-2 text-body text-synkaNavy/50 hover:text-synkaNavy/70 transition"
                  onClick={() => advance(3)}
                >
                  Hopp over
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="flex flex-1 flex-col px-6 pt-14 pb-8 overflow-y-auto"
            >
              <h2 className="text-[22px] font-bold text-synkaNavy">
                Del kalenderen med partneren din
              </h2>
              <p className="mt-2 text-body text-synkaNavy/60">
                Inviter partneren din så dere ser og redigerer den samme
                kalenderen.
              </p>

              <div className="mt-8 space-y-4">
                <div>
                  <label htmlFor="partner-email" className={inputLabel}>
                    Partners e-post
                  </label>
                  <input
                    id="partner-email"
                    type="email"
                    autoComplete="email"
                    className={inputBase}
                    placeholder="partner@example.no"
                    maxLength={254}
                    value={partnerEmail}
                    disabled={inviteSent}
                    onChange={(e) => {
                      setPartnerEmail(e.target.value)
                      if (partnerEmailError) setPartnerEmailError('')
                      if (inviteError) setInviteError('')
                    }}
                    aria-describedby={
                      partnerEmailError
                        ? 'partner-email-error'
                        : inviteError
                        ? 'invite-error'
                        : undefined
                    }
                    aria-invalid={!!(partnerEmailError || inviteError)}
                  />
                  {partnerEmailError && (
                    <p id="partner-email-error" className={inputError} role="alert">
                      {partnerEmailError}
                    </p>
                  )}
                </div>

                {inviteSent ? (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-synkaTeal/30 bg-synkaTeal/10 px-4 py-3"
                    role="status"
                  >
                    <svg
                      className="h-5 w-5 shrink-0 text-synkaPrimary"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-body-sm font-semibold text-synkaPrimary">
                      Invitasjon sendt!
                    </span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={sendingInvite}
                      className={btnPrimary}
                      onClick={() => void handleSendInvite()}
                    >
                      {sendingInvite ? 'Sender…' : 'Send invitasjon'}
                    </button>
                    {inviteError && (
                      <p id="invite-error" className={inputError} role="alert">
                        {inviteError}
                      </p>
                    )}
                  </>
                )}
              </div>

              {!inviteSent && (
                <div className="mt-auto pt-8">
                  <button
                    type="button"
                    className="w-full py-2 text-body text-synkaNavy/50 hover:text-synkaNavy/70 transition"
                    onClick={() => advance(4)}
                  >
                    Hopp over for nå
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="flex flex-1 flex-col items-center justify-center px-8 text-center"
            >
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-synkaPrimary/10">
                <svg
                  className="h-10 w-10 text-synkaPrimary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 className="text-[28px] font-bold text-synkaNavy">
                Familien er klar!
              </h2>
              <p className="mt-3 text-body text-synkaNavy/60 leading-relaxed">
                {completeSummary}
              </p>
              <div className="mt-10 w-full">
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={onComplete}
                >
                  Åpne kalenderen →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
