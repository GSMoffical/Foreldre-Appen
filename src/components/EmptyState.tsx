import { motion, useReducedMotion } from 'framer-motion'

interface EmptyStateProps {
  /** When provided, shows a primary CTA to add an event */
  onAddEvent?: () => void
  /** Optional context: "day" | "week" for slightly different copy */
  context?: 'day' | 'week'
  /** `filtered` = events exist but none match selected people; `no_family` = no family members */
  variant?: 'default' | 'filtered' | 'no_family'
}

/** Subtle breathing S-mark for the secondary (filtered / no_family) empty states. */
function BrandMark({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) {
    return <img src="/synka-mark.svg" alt="" className="w-16 h-16 opacity-25" aria-hidden />
  }
  return (
    <motion.img
      src="/synka-mark.svg"
      alt=""
      className="w-16 h-16"
      aria-hidden
      initial={{ opacity: 0.2 }}
      animate={{ opacity: [0.2, 0.35] }}
      transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
    />
  )
}

export function EmptyState({ onAddEvent, context = 'day', variant = 'default' }: EmptyStateProps) {
  const isWeek = context === 'week'
  const reducedMotion = useReducedMotion() ?? false

  if (variant === 'no_family') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <BrandMark reducedMotion={reducedMotion} />
        <p className="mt-4 text-subheading font-semibold text-zinc-900">Ingen familiemedlemmer</p>
        <p className="mt-1 text-body-sm text-zinc-600">
          Legg til familien under Innstillinger for å bruke kalenderen og filtrene.
        </p>
      </div>
    )
  }

  if (variant === 'filtered') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <BrandMark reducedMotion={reducedMotion} />
        <p className="mt-4 text-subheading font-semibold text-zinc-900">
          {isWeek ? 'Ingen hendelser for valgte personer denne uken' : 'Ingen hendelser for valgte personer'}
        </p>
        <p className="mt-1 text-body-sm text-zinc-600">
          Velg «Alle» eller flere personer i filteret over, eller bytt dag.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-14 text-center">
      {reducedMotion ? (
        <img src="/synka-mark.svg" alt="" className="w-20 h-20 opacity-40" />
      ) : (
        <motion.img
          src="/synka-mark.svg"
          alt=""
          className="w-20 h-20"
          initial={{ opacity: 0.35 }}
          animate={{ opacity: [0.35, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        />
      )}
      <p className="mt-4 text-subheading font-semibold text-synkaNavy/60">
        {isWeek ? 'Ingen hendelser denne uken' : 'Ingen hendelser denne dagen'}
      </p>
      <p className="mt-1 text-body-sm text-synkaNavy/40">
        {onAddEvent
          ? (isWeek ? 'Legg til en hendelse for å komme i gang.' : 'Legg noe inn i planen.')
          : 'Prøv en annen dag eller juster filtrene.'}
      </p>
      {onAddEvent && (
        <button
          type="button"
          onClick={onAddEvent}
          className="mt-5 rounded-pill bg-synkaPrimary px-6 py-2.5 text-body font-semibold text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-synkaPrimary/40 touch-manipulation"
        >
          Legg til hendelse
        </button>
      )}
    </div>
  )
}
