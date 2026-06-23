import { IconSparkles } from '@tabler/icons-react'

interface TankestromWeekBadgeProps {
  /** Antall endringer denne uken. ≤ 0 skjuler merket. */
  count: number
  /** Når satt rendres merket som knapp (f.eks. «bla til berørte dager»). */
  onClick?: () => void
  className?: string
}

/**
 * Lite merke som viser uke-spesifikke skoleavvik fra Tankestrøm, f.eks.
 * «Denne uken: 2 endringer». Skjules når `count` er 0.
 */
export function TankestromWeekBadge({ count, onClick, className = '' }: TankestromWeekBadgeProps) {
  if (count <= 0) return null

  const label = `Denne uken: ${count} ${count === 1 ? 'endring' : 'endringer'}`
  const base =
    'inline-flex items-center gap-1 rounded-pill bg-synkaTeal/15 px-2.5 py-1 text-caption font-semibold text-synkaPrimary'

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} transition hover:bg-synkaTeal/25 active:opacity-70 touch-manipulation ${className}`}
      >
        <IconSparkles size={12} aria-hidden />
        {label}
      </button>
    )
  }

  return (
    <span className={`${base} ${className}`}>
      <IconSparkles size={12} aria-hidden />
      {label}
    </span>
  )
}
