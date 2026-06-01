import {
  IconActivity,
  IconUsers,
  IconSettings,
  IconHelpCircle,
  IconChevronRight,
} from '@tabler/icons-react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { SectionDots } from './SectionDots'

interface MerScreenProps {
  onNavigateSettings: () => void
  onNavigateTankestrom?: () => void
  onNavigateFamilie?: () => void
  onNavigateHjelp?: () => void
}

const CARDS_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035 } },
}

/** Featured card lingers a touch longer (300ms) than the rest (200ms). */
const cardItem = (durationMs: number): Variants => ({
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: durationMs / 1000, ease: 'easeOut' } },
})

export function MerScreen({ onNavigateSettings, onNavigateTankestrom, onNavigateFamilie, onNavigateHjelp }: MerScreenProps) {
  const reducedMotion = useReducedMotion() ?? false
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-synkaCream">
      <div className="flex items-center gap-2 px-4 pt-6 pb-4">
        <SectionDots size="lg" />
        <h1 className="text-display font-bold text-synkaNavy">Mer</h1>
      </div>

      <motion.div
        className="flex flex-col gap-2 px-4 pb-6"
        variants={reducedMotion ? undefined : CARDS_CONTAINER}
        initial={reducedMotion ? false : 'hidden'}
        animate={reducedMotion ? undefined : 'visible'}
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Tankestrøm — featured */}
        <motion.button
          type="button"
          variants={reducedMotion ? undefined : cardItem(300)}
          onClick={onNavigateTankestrom}
          className="flex w-full items-center gap-3 rounded-md border border-synkaTeal/30 bg-synkaTeal/10 p-4 text-left cursor-pointer touch-manipulation active:bg-synkaCream/50"
        >
          <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md bg-synkaNavy">
            <IconActivity size={18} color="#7bc7c4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-body font-semibold text-synkaNavy">Tankestrøm</span>
              <span className="rounded-pill bg-synkaTeal px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                NY
              </span>
            </div>
            <p className="text-label text-synkaNavy/60">Importer hendelser fra tekst og bilder</p>
          </div>
          <IconChevronRight size={16} className="shrink-0 text-synkaNavy/40" aria-hidden />
        </motion.button>

        {/* Familie */}
        <motion.button
          type="button"
          variants={reducedMotion ? undefined : cardItem(200)}
          onClick={onNavigateFamilie}
          className="flex items-center gap-3 p-4 bg-white rounded-md touch-manipulation active:bg-synkaCream text-left w-full"
        >
          <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md bg-synkaPrimary">
            <IconUsers size={18} color="white" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-synkaNavy">Familie</p>
            <p className="text-label text-synkaNavy/60">Administrer familiemedlemmer</p>
          </div>
          <IconChevronRight size={16} className="shrink-0 text-synkaNavy/40" aria-hidden />
        </motion.button>

        {/* Innstillinger */}
        <motion.button
          type="button"
          variants={reducedMotion ? undefined : cardItem(200)}
          onClick={onNavigateSettings}
          className="flex items-center gap-3 p-4 bg-white rounded-md touch-manipulation active:bg-synkaCream text-left w-full"
        >
          <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md bg-synkaNavy">
            <IconSettings size={18} color="white" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-synkaNavy">Innstillinger</p>
            <p className="text-label text-synkaNavy/60">App-preferanser og konto</p>
          </div>
          <IconChevronRight size={16} className="shrink-0 text-synkaNavy/40" aria-hidden />
        </motion.button>

        {/* Hjelp */}
        <motion.button
          type="button"
          variants={reducedMotion ? undefined : cardItem(200)}
          onClick={onNavigateHjelp}
          className="flex items-center gap-3 p-4 bg-white rounded-md touch-manipulation active:bg-synkaCream text-left w-full"
        >
          <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md border border-synkaNavy/10 bg-synkaCream">
            <IconHelpCircle size={18} color="#f5c842" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-synkaNavy">Hjelp</p>
            <p className="text-label text-synkaNavy/60">Veiledning og støtte</p>
          </div>
          <IconChevronRight size={16} className="shrink-0 text-synkaNavy/40" aria-hidden />
        </motion.button>
      </motion.div>
    </div>
  )
}
