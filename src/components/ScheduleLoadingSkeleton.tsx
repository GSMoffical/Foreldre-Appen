import { motion, useReducedMotion } from 'framer-motion'

/**
 * Skeleton shown while the week's events are loading (timeline or list view).
 */
export function ScheduleLoadingSkeleton() {
  const reducedMotion = useReducedMotion() ?? false
  const widths = ['w-[72%]', 'w-[88%]', 'w-[64%]', 'w-[80%]', 'w-[70%]'] as const
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-4 pt-2" aria-busy="true" aria-label="Loading schedule">
      <div className="flex w-full max-w-md flex-col items-center space-y-3">
        {widths.map((w, i) => (
          <div key={i} className={`h-14 ${w} max-w-full animate-pulse rounded-md bg-synkaPrimary/8`} />
        ))}
      </div>
      {reducedMotion ? (
        <img src="/synka-mark.svg" alt="" className="w-24 h-24 mx-auto my-6 opacity-30" aria-hidden />
      ) : (
        <motion.img
          src="/synka-mark.svg"
          alt=""
          className="w-24 h-24 mx-auto my-6"
          aria-hidden
          initial={{ opacity: 0.2 }}
          animate={{ opacity: [0.2, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}
