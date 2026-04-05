import type { Transition, Variants } from 'framer-motion'

/** Sheet / bottom panel slide */
export const springDialog: Transition = {
  type: 'spring',
  damping: 28,
  stiffness: 320,
}

/** Small UI (week card tap, chips) */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 28,
}

export function weekStripStagger(reducedMotion: boolean): { container: Variants; item: Variants } {
  if (reducedMotion) {
    return {
      container: { hidden: {}, visible: {} },
      item: { hidden: { opacity: 1 }, visible: { opacity: 1 } },
    }
  }
  return {
    container: {
      hidden: {},
      visible: { transition: { staggerChildren: 0.045 } },
    },
    item: {
      hidden: { opacity: 0, y: 6 },
      visible: { opacity: 1, y: 0, transition: springSnappy },
    },
  }
}

export function blockEntranceDelay(index: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0
  return Math.min(index * 0.03, 0.35)
}

/** Timeline day swap: use `initial="dayEnter" animate="dayVisible"` */
export function timelineDayVariants(reducedMotion: boolean): Variants {
  if (reducedMotion) {
    return {
      dayEnter: { opacity: 1, y: 0 },
      dayVisible: { opacity: 1, y: 0 },
    }
  }
  return {
    dayEnter: { opacity: 0.72, y: 8 },
    dayVisible: { opacity: 1, y: 0, transition: springSnappy },
  }
}
