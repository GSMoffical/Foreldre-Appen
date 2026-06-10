import { useState, useEffect, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  SHORT_TOUR_STEPS,
  EXTRA_TOUR_STEPS,
  loadOnboarding,
  saveOnboarding,
} from '../lib/onboarding'
import { springSnappy } from '../lib/motion'
import { useAuth } from '../context/AuthContext'

// ── Spotlight mechanics ─────────────────────────────────────────────────────────

const RING_PAD = 8
const CARD_TOP_OFFSET = 16
const CARD_BOTTOM_OFFSET = 88
const LOWER_HALF_THRESHOLD = 0.52
const CARD_ESTIMATED_HEIGHT = 272

function useRingRect(targetId: string | null) {
  const [rect, setRect] = useState<{
    top: number; left: number; width: number; height: number
  } | null>(null)

  useEffect(() => {
    if (!targetId) { setRect(null); return }
    let rafId: number
    let attempts = 0
    const MAX_ATTEMPTS = 25

    function measure() {
      const el = document.getElementById(targetId!)
      if (el) {
        const r = el.getBoundingClientRect()
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
      } else if (attempts++ < MAX_ATTEMPTS) {
        rafId = requestAnimationFrame(measure)
      } else {
        setRect(null)
      }
    }
    rafId = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(rafId)
  }, [targetId])

  return rect
}

// ── Shared mini-element colors (person palette from tailwind.config.js) ─────────

const EMMA_TINT = '#c8ecea'
const EMMA_ACCENT = '#166b4f'
const LEO_TINT = '#fef9d4'
const LEO_ACCENT = '#c9920a'
const MOM_ACCENT = '#e05a3a'
const DAD_ACCENT = '#0f4d38'

// ── Step 1: WeekStripAnim — active day cycles left to right ─────────────────────

const ANIM_DAYS = [
  { abbr: 'man', num: '10' },
  { abbr: 'tir', num: '11' },
  { abbr: 'ons', num: '12' },
  { abbr: 'tor', num: '13' },
  { abbr: 'fre', num: '14' },
]

function WeekStripAnim({ reduced }: { reduced: boolean }) {
  const [active, setActive] = useState(reduced ? 2 : 0)

  useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => setActive((a) => (a + 1) % ANIM_DAYS.length), 900)
    return () => window.clearInterval(id)
  }, [reduced])

  return (
    <div className="flex gap-1" style={{ transform: 'scale(0.92)' }}>
      {ANIM_DAYS.map((d, i) => {
        const isSelected = i === active
        return (
          <div
            key={d.abbr}
            className="relative flex min-w-0 flex-col items-center justify-center rounded-xl px-2.5 py-2"
          >
            <span className="text-caption font-medium uppercase tracking-wide text-synkaNavy/60">
              {d.abbr}
            </span>
            <motion.span
              animate={isSelected && !reduced ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut', times: [0, 0.5, 1] }}
              className={
                isSelected
                  ? 'font-sans mt-0.5 text-display font-bold text-synkaPrimary leading-none'
                  : 'font-sans mt-0.5 text-body-sm text-synkaNavy/50 font-normal'
              }
            >
              {d.num}
            </motion.span>
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full ${
                i === 2 ? 'bg-synkaYellow' : i === 4 ? 'bg-synkaTeal' : 'invisible'
              }`}
              aria-hidden
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Mini event block (shared by steps 2 and 5) ──────────────────────────────────

function MiniEventBlock({
  withTransport,
  children,
}: {
  withTransport?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className="relative flex w-44 min-w-0 overflow-hidden rounded-md text-left shadow-planner-sm px-3 py-2"
      style={{ background: `linear-gradient(135deg, ${EMMA_TINT}, ${EMMA_TINT}cc)` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-synkaCream/30" aria-hidden />
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-[6px]"
        style={{ backgroundColor: EMMA_ACCENT }}
        aria-hidden
      />
      {withTransport && (
        <>
          <div
            className="pointer-events-none absolute left-[6px] right-0 top-0 h-[4px]"
            style={{ backgroundColor: MOM_ACCENT, opacity: 0.72 }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 left-[6px] right-0 h-[4px]"
            style={{ backgroundColor: DAD_ACCENT, opacity: 0.72 }}
            aria-hidden
          />
        </>
      )}
      <span className="flex min-h-0 min-w-0 flex-1 flex-col items-start justify-start gap-0 overflow-hidden pl-1">
        <span className="shrink-0 text-caption font-semibold uppercase tracking-wide text-synkaNavy/50">
          Emma
        </span>
        <span className="mt-0.5 min-w-0 max-w-full truncate text-body-sm font-semibold leading-tight text-synkaNavy">
          Fotballtrening
        </span>
        <span className="mt-0.5 min-w-0 max-w-full truncate whitespace-nowrap text-caption tabular-nums text-synkaNavy/50 uppercase tracking-wide">
          17:00–18:00
        </span>
      </span>
      {children}
    </div>
  )
}

// ── Step 2: EventBlockAnim — fades in, pulses once, repeats ─────────────────────

function EventBlockAnim({ reduced }: { reduced: boolean }) {
  if (reduced) {
    return <MiniEventBlock />
  }
  return (
    <motion.div
      animate={{ opacity: [0, 1, 1, 1], scale: [0.96, 1, 1.04, 1] }}
      transition={{
        duration: 2,
        times: [0, 0.25, 0.55, 0.8],
        ease: 'easeOut',
        repeat: Infinity,
        repeatDelay: 0.8,
      }}
    >
      <MiniEventBlock />
    </motion.div>
  )
}

// ── Step 3: DragEventAnim — block lifts as if dragged, handle pulses ────────────

function DragHandleBadge({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      animate={reduced ? { scale: 1 } : { scale: [1, 1.2, 1] }}
      transition={reduced ? undefined : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-5 w-5
        items-center justify-center rounded-full border border-white/50
        bg-white/70 shadow-sm text-[10px] text-synkaNavy/50"
      aria-hidden
    >
      ≡
    </motion.span>
  )
}

function DragEventAnim({ reduced }: { reduced: boolean }) {
  if (reduced) {
    return (
      <MiniEventBlock>
        <DragHandleBadge reduced />
      </MiniEventBlock>
    )
  }
  return (
    <motion.div
      animate={{ y: [0, -16, 0, 0] }}
      transition={{
        duration: 2.5,
        times: [0, 0.24, 0.48, 1],
        ease: 'easeInOut',
        repeat: Infinity,
      }}
    >
      <MiniEventBlock>
        <DragHandleBadge reduced={false} />
      </MiniEventBlock>
    </motion.div>
  )
}

// ── Step 4: TaskCheckAnim — checkbox animates to checked, repeats ───────────────

function TaskCheckAnim({ reduced }: { reduced: boolean }) {
  const [done, setDone] = useState(reduced)

  useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => setDone((d) => !d), 1400)
    return () => window.clearInterval(id)
  }, [reduced])

  return (
    <div className="flex w-56 items-start gap-3 rounded-md border border-synkaNavy/8 bg-white/60 px-3.5 py-3 shadow-soft">
      <span className="mt-0.5 shrink-0">
        {done ? (
          <motion.div
            initial={reduced ? false : { scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={springSnappy}
            className="flex h-5 w-5 items-center justify-center rounded-pill bg-synkaPrimary"
          >
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </motion.div>
        ) : (
          <div className="h-5 w-5 rounded-pill border-2 border-zinc-300" />
        )}
      </span>
      <p
        className={`min-w-0 flex-1 text-body-sm font-medium leading-snug ${
          done ? 'text-zinc-500 line-through decoration-zinc-300' : 'text-zinc-900'
        }`}
      >
        Kjøpe melk
      </p>
    </div>
  )
}

// ── Step 4: TankestromAnim — scan line sweeps, event pills appear ───────────────

function TankestromAnim({ reduced }: { reduced: boolean }) {
  const CYCLE = 2.8
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md border border-synkaNavy/10 bg-white shadow-soft">
        <div className="space-y-1.5 p-2">
          <div className="h-1 w-7 rounded-full bg-zinc-200" />
          <div className="h-1 w-8 rounded-full bg-zinc-200" />
          <div className="h-1 w-5 rounded-full bg-zinc-200" />
          <div className="h-1 w-8 rounded-full bg-zinc-200" />
          <div className="h-1 w-6 rounded-full bg-zinc-200" />
        </div>
        {!reduced && (
          <motion.div
            className="absolute inset-x-0 h-[3px] bg-synkaTeal"
            animate={{ top: ['0%', '95%'] }}
            transition={{ duration: CYCLE * 0.45, repeat: Infinity, repeatDelay: CYCLE * 0.55, ease: 'easeInOut' }}
            aria-hidden
          />
        )}
      </div>
      <span className="shrink-0 text-[16px] text-synkaNavy/40" aria-hidden>→</span>
      <div className="flex flex-col gap-1.5">
        <motion.span
          animate={reduced ? { opacity: 1 } : { opacity: [0, 0, 1, 1] }}
          transition={reduced ? undefined : { duration: CYCLE, times: [0, 0.45, 0.6, 1], repeat: Infinity }}
          className="rounded-pill border px-2.5 py-1 text-caption font-medium text-synkaNavy/70"
          style={{ backgroundColor: EMMA_TINT, borderColor: EMMA_ACCENT }}
        >
          Fotballcup lør. 09:00
        </motion.span>
        <motion.span
          animate={reduced ? { opacity: 1 } : { opacity: [0, 0, 1, 1] }}
          transition={reduced ? undefined : { duration: CYCLE, times: [0, 0.6, 0.75, 1], repeat: Infinity }}
          className="rounded-pill border px-2.5 py-1 text-caption font-medium text-synkaNavy/70"
          style={{ backgroundColor: LEO_TINT, borderColor: LEO_ACCENT }}
        >
          Send påmelding
        </motion.span>
      </div>
    </div>
  )
}

// ── Step 5: TransportAnim — stripes + alternating labels ────────────────────────

function TransportAnim({ reduced }: { reduced: boolean }) {
  const CYCLE = 2.8
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.span
        animate={reduced ? { opacity: 1 } : { opacity: [1, 1, 0.25, 0.25, 1] }}
        transition={reduced ? undefined : { duration: CYCLE, times: [0, 0.4, 0.5, 0.9, 1], repeat: Infinity }}
        className="text-caption font-semibold"
        style={{ color: MOM_ACCENT }}
      >
        ↑ Levering
      </motion.span>
      <MiniEventBlock withTransport />
      <motion.span
        animate={reduced ? { opacity: 1 } : { opacity: [0.25, 0.25, 1, 1, 0.25] }}
        transition={reduced ? undefined : { duration: CYCLE, times: [0, 0.4, 0.5, 0.9, 1], repeat: Infinity }}
        className="text-caption font-semibold"
        style={{ color: DAD_ACCENT }}
      >
        ↓ Henting
      </motion.span>
    </div>
  )
}

// ── Step 6: PartnerAnim — two phones with a sync arrow ──────────────────────────

function MiniPhone() {
  return (
    <div className="flex h-20 w-11 flex-col gap-1 rounded-lg border-2 border-synkaNavy/25 bg-white p-1.5">
      <div className="h-1 w-5 rounded-full bg-zinc-200" />
      <div
        className="h-2.5 w-full rounded-sm"
        style={{ backgroundColor: EMMA_TINT, borderLeft: `2px solid ${EMMA_ACCENT}` }}
      />
      <div
        className="h-2.5 w-full rounded-sm"
        style={{ backgroundColor: LEO_TINT, borderLeft: `2px solid ${LEO_ACCENT}` }}
      />
      <div className="h-1 w-6 rounded-full bg-zinc-200" />
    </div>
  )
}

function PartnerAnim({ reduced }: { reduced: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <MiniPhone />
      <motion.svg
        animate={reduced ? { opacity: 1 } : { opacity: [0.4, 1, 0.4], scale: [0.92, 1.08, 0.92] }}
        transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="h-6 w-6 shrink-0 text-synkaPrimary"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </motion.svg>
      <MiniPhone />
    </div>
  )
}

// ── Animation dispatch ──────────────────────────────────────────────────────────

function StepAnimation({ stepId, reduced }: { stepId: string; reduced: boolean }) {
  switch (stepId) {
    case 'week-strip': return <WeekStripAnim reduced={reduced} />
    case 'add-event': return <EventBlockAnim reduced={reduced} />
    case 'drag-event': return <DragEventAnim reduced={reduced} />
    case 'tasks-tab': return <TaskCheckAnim reduced={reduced} />
    case 'tankestrom': return <TankestromAnim reduced={reduced} />
    case 'transport': return <TransportAnim reduced={reduced} />
    case 'partner': return <PartnerAnim reduced={reduced} />
    default: return null
  }
}

// ── Main component ──────────────────────────────────────────────────────────────

export interface OnboardingTourProps {
  onComplete: () => void
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const { user } = useAuth()
  const userId = user?.id ?? 'anon'
  const reducedMotion = useReducedMotion() ?? false
  const [extraExpanded, setExtraExpanded] = useState(false)
  const [stepIndex, setStepIndex] = useState(() => {
    const saved = loadOnboarding(userId)
    if (saved.tourCompleted) return -1
    return Math.min(saved.tourStep, SHORT_TOUR_STEPS.length - 1)
  })

  useEffect(() => {
    if (stepIndex === -1) onComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const steps = extraExpanded ? [...SHORT_TOUR_STEPS, ...EXTRA_TOUR_STEPS] : SHORT_TOUR_STEPS
  const step = steps[Math.max(stepIndex, 0)]
  const rect = useRingRect(stepIndex >= 0 ? step.targetId : null)

  if (stepIndex < 0) return null

  const isLast = stepIndex === steps.length - 1
  const isCenterCard = step.cardPlacement === 'center'

  const finish = () => {
    const prev = loadOnboarding(userId)
    saveOnboarding({ ...prev, tourCompleted: true, tourStep: 0 }, userId)
    onComplete()
  }

  const advance = () => {
    if (isLast) { finish(); return }
    const next = stepIndex + 1
    const prev = loadOnboarding(userId)
    saveOnboarding({ ...prev, tourCompleted: false, tourStep: next }, userId)
    setStepIndex(next)
  }

  const cardStyle: CSSProperties = (() => {
    // Center-placed steps (no spotlight target)
    if (isCenterCard) {
      return { top: Math.max(CARD_TOP_OFFSET, Math.round((window.innerHeight - CARD_ESTIMATED_HEIGHT) / 2)) }
    }
    // Explicit placement always wins over heuristic
    if (step.cardPlacement === 'top') {
      return { top: CARD_TOP_OFFSET }
    }
    if (step.cardPlacement === 'bottom') {
      return { bottom: CARD_BOTTOM_OFFSET }
    }
    // Fallback heuristic only when no explicit placement
    if (!rect) return { bottom: CARD_BOTTOM_OFFSET }
    const centerRatio = (rect.top + rect.height / 2) / window.innerHeight
    return centerRatio > LOWER_HALF_THRESHOLD
      ? { top: CARD_TOP_OFFSET }
      : { bottom: CARD_BOTTOM_OFFSET }
  })()

  return (
    <>
      {/* z-[90] — click blocker */}
      <div className="fixed inset-0 z-[90] pointer-events-auto" aria-hidden />

      {/* z-[91] — spotlight ring (or plain dim when no target) */}
      {rect ? (
        <motion.div
          className="pointer-events-none fixed z-[91] rounded-xl"
          initial={false}
          animate={{
            top: rect.top - RING_PAD,
            left: rect.left - RING_PAD,
            width: rect.width + RING_PAD * 2,
            height: rect.height + RING_PAD * 2,
          }}
          transition={reducedMotion ? { duration: 0 } : springSnappy}
          style={{
            boxShadow:
              '0 0 0 9999px rgba(0,0,0,0.45), 0 0 0 3px rgba(123,199,196,1), 0 0 0 7px rgba(123,199,196,0.35)',
          }}
          aria-hidden
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 z-[91] bg-black/45" aria-hidden />
      )}

      {/* z-[93] — tour card */}
      <motion.div
        key={step.id}
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="pointer-events-auto fixed inset-x-4 z-[93] rounded-xl bg-white p-5 shadow-2xl"
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
      >
        {/* Top row: counter + skip */}
        <div className="flex items-center justify-between">
          <span className="text-caption font-semibold text-synkaPrimary">
            Steg {stepIndex + 1} av {steps.length}
          </span>
          {!isLast && (
            <button
              type="button"
              onClick={finish}
              className="text-caption font-medium text-zinc-400 transition hover:text-zinc-600 touch-manipulation"
            >
              Hopp over
            </button>
          )}
        </div>

        <h2 className="mt-2 text-body font-semibold text-zinc-900">{step.title}</h2>
        <p className="mt-1.5 text-body-sm text-zinc-600 leading-relaxed">{step.body}</p>

        {/* Animation zone — taller for center-placed extra cards */}
        <div
          className={`mt-3 ${
            isCenterCard ? 'h-[136px]' : 'h-[88px]'
          } rounded-lg bg-zinc-50 border border-zinc-100 overflow-hidden flex items-center justify-center`}
        >
          <StepAnimation stepId={step.id} reduced={reducedMotion} />
        </div>

        {!extraExpanded && stepIndex === SHORT_TOUR_STEPS.length - 1 && (
          <button
            type="button"
            onClick={() => setExtraExpanded(true)}
            className="mt-3 w-full rounded-lg border border-zinc-200 py-2 text-body-sm text-zinc-600 transition hover:bg-zinc-50 touch-manipulation"
          >
            Lær mer (ekstra tips)
          </button>
        )}

        <button
          type="button"
          onClick={advance}
          className="mt-3 w-full rounded-lg bg-synkaPrimary py-2.5 text-body-sm font-semibold text-white transition hover:brightness-95 touch-manipulation"
        >
          {isLast ? 'Kom i gang! 🎉' : 'Neste →'}
        </button>

        {/* Progress dots */}
        <div className="mt-3 flex justify-center gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={
                i === stepIndex
                  ? 'w-5 h-1.5 rounded-full bg-synkaPrimary'
                  : 'w-1.5 h-1.5 rounded-full bg-zinc-200'
              }
              aria-hidden
            />
          ))}
        </div>
      </motion.div>
    </>
  )
}
