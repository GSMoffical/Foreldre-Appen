interface EmptyStateProps {
  /** When provided, shows a primary CTA to add an event */
  onAddEvent?: () => void
  /** Optional context: "day" | "week" for slightly different copy */
  context?: 'day' | 'week'
  /** `filtered` = events exist but none match selected people; `no_family` = no family members */
  variant?: 'default' | 'filtered' | 'no_family'
}

export function EmptyState({ onAddEvent, context = 'day', variant = 'default' }: EmptyStateProps) {
  const isWeek = context === 'week'

  if (variant === 'no_family') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <p className="text-[15px] font-semibold text-zinc-900">Ingen familiemedlemmer</p>
        <p className="mt-1 text-[13px] text-zinc-600">
          Legg til familien under Innstillinger for å bruke kalenderen og filtrene.
        </p>
      </div>
    )
  }

  if (variant === 'filtered') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <p className="text-[15px] font-semibold text-zinc-900">
          {isWeek ? 'Ingen aktiviteter for valgte personer denne uken' : 'Ingen aktiviteter for valgte personer'}
        </p>
        <p className="mt-1 text-[13px] text-zinc-600">
          Velg «Alle» eller flere personer i filteret over, eller bytt dag.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-zinc-900">
        {isWeek ? 'Ingen aktiviteter denne uken' : 'Ingen aktiviteter denne dagen'}
      </p>
      <p className="mt-1 text-[13px] text-zinc-600">
        {onAddEvent
          ? (isWeek ? 'Legg til en aktivitet for å komme i gang.' : 'Legg noe inn i planen.')
          : 'Prøv en annen dag eller juster filtrene.'}
      </p>
      {onAddEvent && (
        <button
          type="button"
          onClick={onAddEvent}
          className="mt-5 rounded-full bg-brandTeal px-5 py-2.5 text-[14px] font-semibold text-white shadow-planner transition hover:brightness-95 active:translate-y-px active:shadow-planner-press focus:outline-none focus:ring-2 focus:ring-brandTeal focus:ring-offset-2"
        >
          Legg til aktivitet
        </button>
      )}
    </div>
  )
}
