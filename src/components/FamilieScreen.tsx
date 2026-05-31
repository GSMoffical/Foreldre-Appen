import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconEye,
  IconMoodKid,
  IconPlus,
  IconUser,
} from '@tabler/icons-react'
import type {
  ChildSchoolProfile,
  MemberKind,
  ParentWorkProfile,
  Person,
  WeekdayMonFri,
} from '../types'
import { useAuth } from '../context/AuthContext'
import { useFamily } from '../context/FamilyContext'
import { usePermissions } from '../hooks/usePermissions'
import { useEffectiveUserId } from '../context/EffectiveUserIdContext'
import { buildInviteUrl, getOrCreateInviteForTarget } from '../lib/inviteApi'
import { inputBase } from '../lib/ui'
import { SchoolProfileFields } from './SchoolProfileFields'

/** 13 brand-friendly color pairs (mirrors COLOR_PRESETS in FamilyEditor.tsx). */
const COLOR_PRESETS: { tint: string; accent: string }[] = [
  { tint: '#dcfce7', accent: '#22c55e' },
  { tint: '#dbeafe', accent: '#3b82f6' },
  { tint: '#ede9fe', accent: '#8b5cf6' },
  { tint: '#ffedd5', accent: '#f97316' },
  { tint: '#fef9c3', accent: '#eab308' },
  { tint: '#fce7f3', accent: '#ec4899' },
  { tint: '#e0e7ff', accent: '#6366f1' },
  { tint: '#ccfbf1', accent: '#14b8a6' },
  { tint: '#d1fae5', accent: '#059669' },
  { tint: '#a7f3d0', accent: '#16a34a' },
  { tint: '#cffafe', accent: '#0891b2' },
  { tint: '#e0f2fe', accent: '#0284c7' },
  { tint: '#e2e8f0', accent: '#475569' },
]

const WEEKDAYS: { wd: WeekdayMonFri; short: string }[] = [
  { wd: 0, short: 'Man' },
  { wd: 1, short: 'Tir' },
  { wd: 2, short: 'Ons' },
  { wd: 3, short: 'Tor' },
  { wd: 4, short: 'Fre' },
]

const SCHOOL_DEFAULT_START = '08:15'
const SCHOOL_DEFAULT_END = '14:00'
const WORK_DEFAULT_START = '09:00'
const WORK_DEFAULT_END = '17:00'

const sectionLabel = 'text-caption uppercase tracking-wide text-synkaPrimary/60'

const emptyChildSchool = (): ChildSchoolProfile => ({ gradeBand: '1-4', weekdays: {} })

interface FamilieScreenProps {
  onBack: () => void
}

type WizardMode = 'add' | 'edit'

export function FamilieScreen({ onBack }: FamilieScreenProps) {
  const reducedMotion = useReducedMotion() ?? false
  const { people, addPerson, updatePerson, removePerson } = useFamily()
  const { effectiveUserId } = useEffectiveUserId()
  const { user } = useAuth()
  const {
    canManageFamilyMembers,
    canEditFamilyMember,
    selfFamilyMemberId,
  } = usePermissions()

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMode, setWizardMode] = useState<WizardMode>('add')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [startStep, setStartStep] = useState<1 | 2 | 3>(1)
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  function openAdd() {
    setWizardMode('add')
    setEditingId(null)
    setStartStep(1)
    setWizardOpen(true)
  }

  function openEdit(person: Person, step: 1 | 2 | 3 = 1) {
    setWizardMode('edit')
    setEditingId(person.id)
    setStartStep(step)
    setWizardOpen(true)
  }

  function handleComplete(personId: string | null) {
    setWizardOpen(false)
    if (personId) {
      setRecentlyAddedId(personId)
      window.setTimeout(() => setRecentlyAddedId((cur) => (cur === personId ? null : cur)), 1400)
    }
  }

  const editingPerson = editingId ? people.find((p) => p.id === editingId) ?? null : null

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-synkaCream">
      {/* MODE 1 — Family overview */}
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-synkaNavy/8 bg-synkaCream px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-synkaNavy/8 touch-manipulation"
            aria-label="Tilbake"
          >
            <IconArrowLeft size={18} className="text-synkaNavy" aria-hidden />
          </button>
          <span className="inline-flex items-center gap-1" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-synkaTeal" />
            <span className="h-2.5 w-2.5 rounded-full bg-synkaYellow" />
          </span>
          <h1 className="text-[17px] font-bold text-synkaNavy">Familie</h1>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pt-3 [-webkit-overflow-scrolling:touch]">
          {people.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
              <span
                className="select-none text-[72px] font-black leading-none text-synkaPrimary/10"
                aria-hidden
              >
                S
              </span>
              <p className="mt-4 text-[15px] font-semibold text-synkaNavy">
                Ingen familiemedlemmer ennå
              </p>
              <p className="mt-1 text-[13px] text-synkaNavy/55">
                Legg til foreldre og barn for å bygge familiekalenderen.
              </p>
              {canManageFamilyMembers && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="mt-6 inline-flex items-center gap-2 rounded-pill bg-synkaPrimary px-5 py-2.5 text-[14px] font-semibold text-white shadow-planner-sm transition hover:brightness-95 active:shadow-planner-press"
                >
                  <IconPlus size={16} aria-hidden /> Legg til person
                </button>
              )}
            </div>
          ) : (
            <>
              <ul className="pb-2">
                {people.map((p) => {
                  const isParent = p.memberKind === 'parent'
                  const isSelf = selfFamilyMemberId != null && p.id === selfFamilyMemberId
                  const canInvite =
                    canManageFamilyMembers && isParent && !p.linkedAuthUserId && !isSelf
                  const isCurrentUserRow = user != null && (
                    p.id === `self-${user.id}` ||
                    (p.linkedAuthUserId != null && p.linkedAuthUserId === user.id)
                  )
                  return (
                    <li key={p.id}>
                      <motion.div
                        initial={
                          recentlyAddedId === p.id ? { scale: 0.92, opacity: 0 } : false
                        }
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                        className="mx-4 mb-3 rounded-md bg-white p-4 shadow-soft"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
                            style={{
                              backgroundColor: p.colorTint,
                              border: `2px solid ${p.colorAccent}`,
                              color: p.colorAccent,
                            }}
                            aria-hidden
                          >
                            {p.name.trim().slice(0, 1).toUpperCase() || '?'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold text-synkaNavy">
                              {p.name}
                            </p>
                            <span
                              className={`mt-0.5 inline-block rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                p.memberKind === 'parent'
                                  ? 'bg-synkaTeal/15 text-synkaPrimary'
                                  : p.memberKind === 'guest'
                                    ? 'bg-zinc-100 text-zinc-500'
                                    : 'bg-synkaYellow/25 text-synkaNavy/70'
                              }`}
                            >
                              {p.memberKind === 'parent' ? 'Forelder' : p.memberKind === 'guest' ? 'Gjest' : 'Barn'}
                            </span>
                          </div>
                          {canEditFamilyMember(p.id) && (
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-medium text-synkaPrimary transition hover:bg-synkaPrimary/8"
                            >
                              Rediger
                            </button>
                          )}
                        </div>

                        {canInvite && (
                          <button
                            type="button"
                            onClick={() => openEdit(p, 3)}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-synkaTeal/15 px-3 py-1.5 text-[12px] font-semibold text-synkaPrimary transition hover:bg-synkaTeal/25"
                          >
                            <IconUser size={13} aria-hidden /> Inviter til appen
                          </button>
                        )}
                        {canManageFamilyMembers && !isCurrentUserRow && (
                          confirmRemoveId === p.id ? (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                              <p className="flex-1 text-[12px] font-medium text-red-700">Er du sikker?</p>
                              <button
                                type="button"
                                onClick={() => { void removePerson(p.id).catch(() => {}); setConfirmRemoveId(null) }}
                                className="rounded-pill bg-red-600 px-3 py-1 text-caption font-semibold text-white touch-manipulation"
                              >
                                Fjern
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveId(null)}
                                className="rounded-pill border border-red-200 bg-white px-3 py-1 text-caption font-semibold text-red-600 touch-manipulation"
                              >
                                Avbryt
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(p.id)}
                              className="mt-3 inline-flex items-center gap-1.5 rounded-pill border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-100 touch-manipulation"
                            >
                              Fjern
                            </button>
                          )
                        )}
                      </motion.div>
                    </li>
                  )
                })}
              </ul>

              {canManageFamilyMembers && (
                <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-1">
                  <button
                    type="button"
                    onClick={openAdd}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-synkaPrimary py-3 text-[14px] font-semibold text-white shadow-planner-sm transition hover:brightness-95 active:shadow-planner-press"
                  >
                    <IconPlus size={16} aria-hidden /> Legg til person
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODE 2 — Add/Edit wizard */}
      <AnimatePresence>
        {wizardOpen && (
          <motion.div
            key="wizard"
            initial={reducedMotion ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reducedMotion ? { x: 0 } : { x: '100%' }}
            transition={reducedMotion ? { duration: 0 } : { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.32 }}
            className="absolute inset-0 z-20 flex flex-col bg-synkaCream"
          >
            <PersonWizard
              mode={wizardMode}
              initial={editingPerson ?? undefined}
              startStep={startStep}
              effectiveUserId={effectiveUserId}
              onAddPerson={addPerson}
              onUpdatePerson={updatePerson}
              onClose={() => setWizardOpen(false)}
              onComplete={handleComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Wizard ──────────────────────────────────────────────────────────────────

interface PersonWizardProps {
  mode: WizardMode
  initial?: Person
  startStep: 1 | 2 | 3
  effectiveUserId: string | null
  onAddPerson: ReturnType<typeof useFamily>['addPerson']
  onUpdatePerson: ReturnType<typeof useFamily>['updatePerson']
  onClose: () => void
  onComplete: (personId: string | null) => void
}

function PersonWizard({
  mode,
  initial,
  startStep,
  effectiveUserId,
  onAddPerson,
  onUpdatePerson,
  onClose,
  onComplete,
}: PersonWizardProps) {
  const reducedMotion = useReducedMotion() ?? false
  const [name, setName] = useState(initial?.name ?? '')
  const [colorTint, setColorTint] = useState(initial?.colorTint ?? COLOR_PRESETS[0].tint)
  const [colorAccent, setColorAccent] = useState(initial?.colorAccent ?? COLOR_PRESETS[0].accent)
  const [memberKind, setMemberKind] = useState<MemberKind>(initial?.memberKind ?? 'parent')
  const [school, setSchool] = useState<ChildSchoolProfile>(initial?.school ?? emptyChildSchool())
  const [work, setWork] = useState<ParentWorkProfile | undefined>(initial?.work)

  const [step, setStep] = useState<1 | 2 | 3>(startStep)
  const [direction, setDirection] = useState(1)
  const [nameError, setNameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAdvancedSchool, setShowAdvancedSchool] = useState(false)

  // Persisted id (so a parent's invite can target a real family_members row mid-wizard).
  const [savedPersonId, setSavedPersonId] = useState<string | null>(
    mode === 'edit' ? initial?.id ?? null : null
  )
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const totalSteps = memberKind === 'parent' ? 3 : memberKind === 'guest' ? 1 : 2
  const isLastStep = step >= totalSteps
  const heading =
    mode === 'edit' ? `Rediger ${initial?.name || 'medlem'}` : 'Legg til person'

  function collectPayload() {
    return {
      name: name.trim(),
      colorTint,
      colorAccent,
      memberKind,
      school: memberKind === 'child' ? school : undefined,
      work: memberKind === 'parent' ? work : undefined,
    }
  }

  /** Persist (create or update) and return the resolved person id. */
  async function persistPerson(): Promise<string | null> {
    const payload = collectPayload()
    if (mode === 'edit' && initial) {
      await onUpdatePerson(initial.id, {
        name: payload.name,
        colorTint: payload.colorTint,
        colorAccent: payload.colorAccent,
        school: payload.school,
        work: payload.work,
      })
      return initial.id
    }
    if (savedPersonId) {
      await onUpdatePerson(savedPersonId, {
        name: payload.name,
        colorTint: payload.colorTint,
        colorAccent: payload.colorAccent,
        school: payload.school,
        work: payload.work,
      })
      return savedPersonId
    }
    const created = await onAddPerson(payload)
    if (created) setSavedPersonId(created.id)
    return created?.id ?? null
  }

  function validateName(): boolean {
    if (!name.trim()) {
      setNameError('Skriv inn et navn.')
      return false
    }
    setNameError(null)
    return true
  }

  function goTo(next: 1 | 2 | 3) {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  async function handleNext() {
    if (step === 1 && !validateName()) return
    setSaving(true)
    try {
      if (step === 1) {
        goTo(2)
      } else if (step === 2) {
        if (memberKind === 'parent') {
          // Persist now so step 3's invite can target the real row.
          await persistPerson()
          goTo(3)
        } else {
          await finalize()
        }
      }
    } catch {
      // Persist errors surface on finalize; keep the wizard usable.
    } finally {
      setSaving(false)
    }
  }

  async function finalize() {
    if (!validateName()) {
      goTo(1)
      return
    }
    setSaving(true)
    try {
      const id = await persistPerson()
      onComplete(id)
    } catch {
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateInvite() {
    if (!effectiveUserId) return
    setInviteLoading(true)
    try {
      const targetId = savedPersonId ?? (await persistPerson())
      if (!targetId) return
      const inv = await getOrCreateInviteForTarget(effectiveUserId, targetId)
      if (inv) setInviteUrl(buildInviteUrl(inv.token))
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleCopyInvite() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  function applyStandardSchoolWeek() {
    const next: ChildSchoolProfile['weekdays'] = {}
    for (const { wd } of WEEKDAYS) {
      next[wd] = {
        useSimpleDay: true,
        schoolStart: SCHOOL_DEFAULT_START,
        schoolEnd: SCHOOL_DEFAULT_END,
      }
    }
    setSchool((prev) => ({ ...prev, weekdays: next }))
  }

  function toggleSchoolDay(wd: WeekdayMonFri) {
    setSchool((prev) => {
      const weekdays = { ...prev.weekdays }
      if (weekdays[wd]) {
        delete weekdays[wd]
      } else {
        weekdays[wd] = {
          useSimpleDay: true,
          schoolStart: SCHOOL_DEFAULT_START,
          schoolEnd: SCHOOL_DEFAULT_END,
        }
      }
      return { ...prev, weekdays }
    })
  }

  function setSchoolDayTime(wd: WeekdayMonFri, part: 'start' | 'end', val: string) {
    setSchool((prev) => {
      const cur = prev.weekdays[wd]
      return {
        ...prev,
        weekdays: {
          ...prev.weekdays,
          [wd]: {
            useSimpleDay: true,
            lessons: undefined,
            schoolStart: part === 'start' ? val : cur?.schoolStart ?? SCHOOL_DEFAULT_START,
            schoolEnd: part === 'end' ? val : cur?.schoolEnd ?? SCHOOL_DEFAULT_END,
          },
        },
      }
    })
  }

  function applyStandardWorkWeek() {
    const next: ParentWorkProfile['weekdays'] = {}
    for (const { wd } of WEEKDAYS) {
      next[wd] = { start: WORK_DEFAULT_START, end: WORK_DEFAULT_END }
    }
    setWork({ weekdays: next })
  }

  function toggleWorkDay(wd: WeekdayMonFri) {
    setWork((prev) => {
      const weekdays = { ...(prev?.weekdays ?? {}) }
      if (weekdays[wd]) {
        delete weekdays[wd]
      } else {
        weekdays[wd] = { start: WORK_DEFAULT_START, end: WORK_DEFAULT_END }
      }
      return { weekdays }
    })
  }

  function setWorkDayTime(wd: WeekdayMonFri, part: 'start' | 'end', val: string) {
    setWork((prev) => {
      const weekdays = { ...(prev?.weekdays ?? {}) }
      const cur = weekdays[wd]
      weekdays[wd] = {
        start: part === 'start' ? val : cur?.start ?? WORK_DEFAULT_START,
        end: part === 'end' ? val : cur?.end ?? WORK_DEFAULT_END,
      }
      return { weekdays }
    })
  }

  // Outgoing step slides left, incoming enters from the right (reversed on back).
  const slideVariants = reducedMotion
    ? {
        enter: { x: 0, opacity: 1 },
        center: { x: 0, opacity: 1 },
        exit: { x: 0, opacity: 1 },
      }
    : {
        enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
      }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-synkaNavy/8 bg-synkaCream px-4 py-3">
        <button
          type="button"
          onClick={() => (step === startStep ? onClose() : goTo((step - 1) as 1 | 2 | 3))}
          className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-synkaNavy/8 touch-manipulation"
          aria-label="Tilbake"
        >
          <IconArrowLeft size={18} className="text-synkaNavy" aria-hidden />
        </button>
        <h1 className="truncate text-[17px] font-bold text-synkaNavy">{heading}</h1>
      </header>

      {/* Dot progress indicator */}
      <div className="flex shrink-0 items-center justify-center gap-2 py-4">
        {Array.from({ length: totalSteps }, (_, i) => {
          const idx = (i + 1) as 1 | 2 | 3
          const state = idx < step ? 'done' : idx === step ? 'current' : 'upcoming'
          return (
            <motion.span
              key={idx}
              animate={{
                width: state === 'current' ? 28 : 8,
                backgroundColor:
                  state === 'done' ? '#7bc7c4' : state === 'current' ? '#f5c842' : '#d8d4cd',
              }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="h-2 rounded-pill"
            />
          )
        })}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 [-webkit-overflow-scrolling:touch]">
        <AnimatePresence custom={direction} mode="wait" initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.22 }}
            className="flex flex-1 flex-col pb-6"
          >
            {step === 1 && (
              <StepBasics
                memberKind={memberKind}
                onMemberKind={(k) => setMemberKind(k)}
                allowKindChange={mode === 'add'}
                name={name}
                onName={(v) => {
                  setName(v)
                  if (nameError) setNameError(null)
                }}
                nameError={nameError}
                colorAccent={colorAccent}
                onPickColor={(tint, accent) => {
                  setColorTint(tint)
                  setColorAccent(accent)
                }}
              />
            )}

            {step === 2 && memberKind === 'child' && (
              <StepSchool
                school={school}
                onSchoolChange={setSchool}
                onStandardWeek={applyStandardSchoolWeek}
                onToggleDay={toggleSchoolDay}
                onSetDayTime={setSchoolDayTime}
                showAdvanced={showAdvancedSchool}
                onToggleAdvanced={() => setShowAdvancedSchool((v) => !v)}
              />
            )}

            {step === 2 && memberKind === 'parent' && (
              <StepWork
                work={work}
                onStandardWeek={applyStandardWorkWeek}
                onToggleDay={toggleWorkDay}
                onSetDayTime={setWorkDayTime}
              />
            )}

            {step === 3 && (
              <StepInvite
                name={name.trim() || initial?.name || 'forelder'}
                inviteUrl={inviteUrl}
                inviteLoading={inviteLoading}
                copied={copied}
                onGenerate={handleGenerateInvite}
                onCopy={handleCopyInvite}
                canInvite={!!effectiveUserId}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-synkaNavy/8 bg-synkaCream px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={isLastStep ? () => void finalize() : () => void handleNext()}
              className="text-[13px] font-medium text-synkaNavy/55 underline underline-offset-2"
              disabled={saving}
            >
              Hopp over
            </button>
          )}
          <button
            type="button"
            onClick={isLastStep ? () => void finalize() : () => void handleNext()}
            disabled={saving}
            className="ml-auto inline-flex items-center justify-center gap-1.5 rounded-pill bg-synkaPrimary px-6 py-3 text-[14px] font-semibold text-white shadow-planner-sm transition hover:brightness-95 active:shadow-planner-press disabled:opacity-60"
          >
            {saving ? 'Lagrer…' : isLastStep ? 'Fullfør' : 'Neste'}
            {!saving && !isLastStep && <IconChevronRight size={16} aria-hidden />}
            {!saving && isLastStep && <IconCheck size={16} aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Grunninfo ─────────────────────────────────────────────────────────

interface StepBasicsProps {
  memberKind: MemberKind
  onMemberKind: (kind: MemberKind) => void
  allowKindChange: boolean
  name: string
  onName: (v: string) => void
  nameError: string | null
  colorAccent: string
  onPickColor: (tint: string, accent: string) => void
}

function StepBasics({
  memberKind,
  onMemberKind,
  allowKindChange,
  name,
  onName,
  nameError,
  colorAccent,
  onPickColor,
}: StepBasicsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-[20px] font-bold text-synkaNavy">Hvem legger du til?</h2>

      <div className="grid grid-cols-3 gap-3">
        <KindTile
          active={memberKind === 'parent'}
          disabled={!allowKindChange}
          onClick={() => allowKindChange && onMemberKind('parent')}
          icon={<IconUser size={22} aria-hidden />}
          label="Forelder"
          sub="Arbeidstid og invitasjon"
        />
        <KindTile
          active={memberKind === 'child'}
          disabled={!allowKindChange}
          onClick={() => allowKindChange && onMemberKind('child')}
          icon={<IconMoodKid size={22} aria-hidden />}
          label="Barn"
          sub="Skolerute i kalenderen"
        />
        <KindTile
          active={memberKind === 'guest'}
          disabled={!allowKindChange}
          onClick={() => allowKindChange && onMemberKind('guest')}
          icon={<IconEye size={22} aria-hidden />}
          label="Gjest"
          sub="Kan se kalenderen, men ikke endre den"
        />
      </div>

      <div>
        <label htmlFor="person-name" className={sectionLabel}>
          Navn
        </label>
        <input
          id="person-name"
          type="text"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={memberKind === 'child' ? 'f.eks. Emma' : 'f.eks. Anne'}
          className={`mt-1.5 ${inputBase}`}
          autoFocus
        />
        {nameError && <p className="mt-1 text-caption text-synkaCoral">{nameError}</p>}
      </div>

      <div>
        <p className={sectionLabel}>Farge</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {COLOR_PRESETS.map(({ tint, accent }) => {
            const selected = colorAccent === accent
            return (
              <button
                key={accent}
                type="button"
                onClick={() => onPickColor(tint, accent)}
                aria-pressed={selected}
                aria-label={`Farge ${accent}`}
                className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${
                  selected ? 'ring-2 ring-synkaPrimary ring-offset-2' : ''
                }`}
                style={{ backgroundColor: tint, border: `2px solid ${accent}` }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface KindTileProps {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  sub: string
}

function KindTile({ active, disabled, onClick, icon, label, sub }: KindTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-2 rounded-md border-2 p-4 text-left transition ${
        active
          ? 'border-synkaPrimary bg-synkaPrimary/5'
          : 'border-synkaNavy/12 bg-white'
      } ${disabled && !active ? 'opacity-40' : ''}`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          active ? 'bg-synkaPrimary text-white' : 'bg-synkaCream text-synkaNavy/60'
        }`}
      >
        {icon}
      </span>
      <span className="text-[15px] font-semibold text-synkaNavy">{label}</span>
      <span className="text-[12px] leading-tight text-synkaNavy/55">{sub}</span>
    </button>
  )
}

// ── Step 2a: School (child) ───────────────────────────────────────────────────

interface StepSchoolProps {
  school: ChildSchoolProfile
  onSchoolChange: (next: ChildSchoolProfile) => void
  onStandardWeek: () => void
  onToggleDay: (wd: WeekdayMonFri) => void
  onSetDayTime: (wd: WeekdayMonFri, part: 'start' | 'end', val: string) => void
  showAdvanced: boolean
  onToggleAdvanced: () => void
}

const GRADE_BANDS: { value: ChildSchoolProfile['gradeBand']; label: string }[] = [
  { value: '1-4', label: '1.–4.' },
  { value: '5-7', label: '5.–7.' },
  { value: '8-10', label: '8.–10.' },
  { value: 'vg1', label: 'VG1' },
  { value: 'vg2', label: 'VG2' },
  { value: 'vg3', label: 'VG3' },
]

function StepSchool({
  school,
  onSchoolChange,
  onStandardWeek,
  onToggleDay,
  onSetDayTime,
  showAdvanced,
  onToggleAdvanced,
}: StepSchoolProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-synkaNavy">Timeplan</h2>
        <p className="mt-1 text-[13px] text-synkaNavy/55">
          Skoleruten vises svakt i kalenderen. Avtaler legges oppå.
        </p>
      </div>

      <div>
        <p className={sectionLabel}>Trinn / nivå</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {GRADE_BANDS.map((g) => {
            const active = school.gradeBand === g.value
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => onSchoolChange({ ...school, gradeBand: g.value })}
                className={`rounded-pill px-3.5 py-2 text-[13px] font-semibold transition ${
                  active
                    ? 'bg-synkaPrimary text-white'
                    : 'border border-synkaNavy/15 bg-white text-synkaNavy/70'
                }`}
              >
                {g.label}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onStandardWeek}
        className="inline-flex items-center gap-2 rounded-pill bg-synkaYellow/25 px-3.5 py-2 text-[13px] font-semibold text-synkaNavy transition hover:bg-synkaYellow/40"
      >
        <IconCheck size={14} aria-hidden /> Standard skoleuke 08:15–14:00
      </button>

      {!showAdvanced && (
        <div>
          <p className={sectionLabel}>Uke (man–fre)</p>
          <div className="mt-2 space-y-2">
            {WEEKDAYS.map(({ wd, short }) => {
              const plan = school.weekdays[wd]
              const on = !!plan
              const hasLessons = !!plan && plan.useSimpleDay === false && !!plan.lessons?.length
              return (
                <div
                  key={wd}
                  className="flex items-center gap-3 rounded-md border border-synkaNavy/10 bg-white px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => onToggleDay(wd)}
                    role="switch"
                    aria-checked={on}
                    aria-label={`${short} skoledag`}
                    className={`relative h-6 w-11 shrink-0 rounded-pill transition ${
                      on ? 'bg-synkaPrimary' : 'bg-synkaNavy/15'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        on ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className="w-8 shrink-0 text-[13px] font-semibold text-synkaNavy">
                    {short}
                  </span>
                  {on ? (
                    hasLessons ? (
                      <span className="text-[12px] text-synkaNavy/50">
                        Detaljert timeplan (se «Avansert»)
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={plan?.schoolStart ?? SCHOOL_DEFAULT_START}
                          onChange={(e) => onSetDayTime(wd, 'start', e.target.value)}
                          className="rounded-md border border-synkaNavy/15 bg-white px-2 py-1.5 text-[13px] tabular-nums text-synkaNavy"
                        />
                        <span className="text-synkaNavy/40">–</span>
                        <input
                          type="time"
                          value={plan?.schoolEnd ?? SCHOOL_DEFAULT_END}
                          onChange={(e) => onSetDayTime(wd, 'end', e.target.value)}
                          className="rounded-md border border-synkaNavy/15 bg-white px-2 py-1.5 text-[13px] tabular-nums text-synkaNavy"
                        />
                      </div>
                    )
                  ) : (
                    <span className="text-[12px] text-synkaNavy/40">Fri</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onToggleAdvanced}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-synkaPrimary transition hover:text-synkaPrimary/70"
      >
        <IconChevronRight
          size={14}
          aria-hidden
          className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
        />
        {showAdvanced ? 'Skjul avansert timeplan' : 'Avansert timeplan'}
      </button>

      {showAdvanced && <SchoolProfileFields value={school} onChange={onSchoolChange} />}
    </div>
  )
}

// ── Step 2b: Work (parent) ────────────────────────────────────────────────────

interface StepWorkProps {
  work: ParentWorkProfile | undefined
  onStandardWeek: () => void
  onToggleDay: (wd: WeekdayMonFri) => void
  onSetDayTime: (wd: WeekdayMonFri, part: 'start' | 'end', val: string) => void
}

function StepWork({ work, onStandardWeek, onToggleDay, onSetDayTime }: StepWorkProps) {
  const weekdays = work?.weekdays ?? {}
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-synkaNavy">Timeplan</h2>
        <p className="mt-1 text-[13px] text-synkaNavy/55">
          Arbeidstid vises svakt bak avtaler i ukesvisningen.
        </p>
      </div>

      <button
        type="button"
        onClick={onStandardWeek}
        className="inline-flex items-center gap-2 rounded-pill bg-synkaYellow/25 px-3.5 py-2 text-[13px] font-semibold text-synkaNavy transition hover:bg-synkaYellow/40"
      >
        <IconCheck size={14} aria-hidden /> Standard arbeidsuke 09:00–17:00
      </button>

      <div>
        <p className={sectionLabel}>Uke (man–fre)</p>
        <div className="mt-2 space-y-2">
          {WEEKDAYS.map(({ wd, short }) => {
            const row = weekdays[wd]
            const on = !!row
            return (
              <div
                key={wd}
                className="flex items-center gap-3 rounded-md border border-synkaNavy/10 bg-white px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => onToggleDay(wd)}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${short} arbeidsdag`}
                  className={`relative h-6 w-11 shrink-0 rounded-pill transition ${
                    on ? 'bg-synkaPrimary' : 'bg-synkaNavy/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      on ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className="w-8 shrink-0 text-[13px] font-semibold text-synkaNavy">
                  {short}
                </span>
                {on ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={row?.start ?? WORK_DEFAULT_START}
                      onChange={(e) => onSetDayTime(wd, 'start', e.target.value)}
                      className="rounded-md border border-synkaNavy/15 bg-white px-2 py-1.5 text-[13px] tabular-nums text-synkaNavy"
                    />
                    <span className="text-synkaNavy/40">–</span>
                    <input
                      type="time"
                      value={row?.end ?? WORK_DEFAULT_END}
                      onChange={(e) => onSetDayTime(wd, 'end', e.target.value)}
                      className="rounded-md border border-synkaNavy/15 bg-white px-2 py-1.5 text-[13px] tabular-nums text-synkaNavy"
                    />
                  </div>
                ) : (
                  <span className="text-[12px] text-synkaNavy/40">Fri</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Invite (parent) ───────────────────────────────────────────────────

interface StepInviteProps {
  name: string
  inviteUrl: string | null
  inviteLoading: boolean
  copied: boolean
  onGenerate: () => void
  onCopy: () => void
  canInvite: boolean
}

function StepInvite({
  name,
  inviteUrl,
  inviteLoading,
  copied,
  onGenerate,
  onCopy,
  canInvite,
}: StepInviteProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-synkaNavy">Send invitasjon til {name}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-synkaNavy/60">
          Del denne lenken så {name} får tilgang til familiekalenderen. Du kan også hoppe over og
          invitere senere.
        </p>
      </div>

      {!canInvite ? (
        <p className="rounded-md bg-white px-3.5 py-3 text-[13px] text-synkaNavy/60">
          Du må være innlogget som eier av kalenderen for å lage invitasjonslenker.
        </p>
      ) : inviteUrl ? (
        <div className="space-y-3">
          <div>
            <p className={sectionLabel}>Invitasjonslenke</p>
            <input
              readOnly
              value={inviteUrl}
              aria-label="Invitasjonslenke"
              onFocus={(e) => e.currentTarget.select()}
              className={`mt-1.5 ${inputBase} break-all`}
            />
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-2 rounded-pill bg-synkaTeal/15 px-4 py-2 text-[13px] font-semibold text-synkaPrimary transition hover:bg-synkaTeal/25"
          >
            {copied ? <IconCheck size={15} aria-hidden /> : <IconCopy size={15} aria-hidden />}
            {copied ? 'Kopiert!' : 'Kopier lenke'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          disabled={inviteLoading}
          className="inline-flex items-center gap-2 rounded-pill border-2 border-synkaPrimary px-5 py-2.5 text-[14px] font-semibold text-synkaPrimary transition hover:bg-synkaPrimary/8 disabled:opacity-60"
        >
          {inviteLoading ? 'Genererer…' : 'Generer lenke'}
        </button>
      )}
    </div>
  )
}
