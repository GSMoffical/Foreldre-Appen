import { SynkaDecorativeShape } from './ui/SynkaDecorativeShape'
import { SynkaButton } from './ui/SynkaButton'

interface EmptyStateProps {
  /** When provided, shows a primary CTA to add an event */
  onAddEvent?: () => void
  /** Optional context: "day" | "week" for slightly different copy */
  context?: 'day' | 'week'
  /** `filtered` = events exist but none match selected people; `no_family` = no family members */
  variant?: 'default' | 'filtered' | 'no_family'
}

function EmptyIllustration({ variant = 'mint' }: { variant?: 'mint' | 'yellow' }) {
  return (
    <div className="relative mb-5 flex h-20 w-20 items-center justify-center" aria-hidden>
      <SynkaDecorativeShape
        variant={variant}
        size={80}
        opacity={0.35}
        className="absolute inset-0"
      />
      <svg className="relative z-10 h-9 w-9 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    </div>
  )
}

export function EmptyState({ onAddEvent, context = 'day', variant = 'default' }: EmptyStateProps) {
  const isWeek = context === 'week'

  if (variant === 'no_family') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <EmptyIllustration variant="mint" />
        <p className="font-display text-[18px] font-bold text-neutral-600">Ingen familiemedlemmer</p>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
          Legg til familien under <span className="font-semibold text-neutral-500">Profil</span> for å bruke kalenderen og filtrene.
        </p>
      </div>
    )
  }

  if (variant === 'filtered') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <EmptyIllustration variant="yellow" />
        <p className="font-display text-[18px] font-bold text-neutral-600">
          {isWeek ? 'Ingenting denne uken' : 'Ingen treff'}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
          Velg «Alle» eller flere avatarer i filteret over for å se alle hendelser.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-14 text-center">
      <EmptyIllustration variant="mint" />
      <p className="font-display text-[18px] font-bold text-neutral-600">
        {isWeek ? 'Rolig uke' : 'Ingenting planlagt'}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
        {onAddEvent
          ? (isWeek ? 'Start med å legge til det første.' : 'Legg noe inn i planen.')
          : 'Prøv en annen dag eller juster filtrene.'}
      </p>
      {onAddEvent && (
        <SynkaButton
          variant="primary"
          shape="pill"
          size="md"
          onClick={onAddEvent}
          className="mt-6"
        >
          + Legg til hendelse
        </SynkaButton>
      )}
    </div>
  )
}
