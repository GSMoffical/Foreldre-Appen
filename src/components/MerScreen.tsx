import {
  IconSettings,
  IconHelpCircle,
  IconChevronRight,
} from '@tabler/icons-react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { SectionDots } from './SectionDots'

const CARDS_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035 } },
}

const cardItem = (durationMs: number): Variants => ({
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: durationMs / 1000, ease: 'easeOut' } },
})

export function MerScreen() {
  const reducedMotion = useReducedMotion() ?? false
  const navigate = useNavigate()
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
        {/* Innstillinger */}
        <motion.button
          type="button"
          variants={reducedMotion ? undefined : cardItem(200)}
          onClick={() => navigate('/mer/innstillinger')}
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
          onClick={() => navigate('/mer/hjelp')}
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
