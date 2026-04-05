interface WeeklyCheckCardProps {
  totalActivities: number
  collisionCount: number
}

export function WeeklyCheckCard({ totalActivities, collisionCount }: WeeklyCheckCardProps) {
  const collisionLabel =
    collisionCount === 0 ? 'alt klart' : collisionCount === 1 ? '1 må avklares' : `${collisionCount} må avklares`

  return (
    <div className="mx-4 mt-2 rounded-card border border-zinc-200 bg-white px-3 py-2.5 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Ukesjekk</p>
      <p className="mt-1 text-[13px] font-medium text-zinc-800">
        {totalActivities} {totalActivities === 1 ? 'aktivitet' : 'aktiviteter'} planlagt
        {` · `}
        {collisionLabel}
      </p>
    </div>
  )
}
