export function SectionDots({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2'
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className={`${s} rounded-full bg-synkaTeal inline-block`} />
      <span className={`${s} rounded-full bg-synkaYellow inline-block`} />
    </span>
  )
}
