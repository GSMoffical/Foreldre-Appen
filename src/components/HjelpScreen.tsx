import { useState } from 'react'
import { IconArrowLeft, IconChevronRight } from '@tabler/icons-react'

interface HjelpScreenProps {
  onBack: () => void
}

const APP_VERSION = '0.1.0-beta'

export function HjelpScreen({ onBack }: HjelpScreenProps) {
  const [toast, setToast] = useState(false)

  function showComingSoon() {
    setToast(true)
    window.setTimeout(() => setToast(false), 2000)
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 bg-synkaCream border-b border-synkaNavy/8 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex w-8 h-8 items-center justify-center rounded-full hover:bg-synkaNavy/8 transition touch-manipulation"
          aria-label="Tilbake"
        >
          <IconArrowLeft size={18} className="text-synkaNavy" aria-hidden />
        </button>
        <span className="inline-flex items-center gap-1" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-synkaTeal" />
          <span className="h-2 w-2 rounded-full bg-synkaYellow" />
        </span>
        <h2 className="text-[15px] font-semibold text-synkaNavy">Hjelp</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <div className="flex flex-col gap-3 px-4 pt-5 pb-10">
          {/* Kom i gang */}
          <div className="rounded-md border border-synkaNavy/8 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-synkaNavy/40">Kom i gang</p>
            <button
              type="button"
              onClick={showComingSoon}
              className="mt-3 flex w-full items-center justify-between rounded-md border border-synkaNavy/8 px-4 py-3 text-left touch-manipulation active:bg-synkaCream transition"
            >
              <span className="text-[14px] font-medium text-synkaNavy">Vis gjennomgang på nytt</span>
              <IconChevronRight size={16} className="shrink-0 text-synkaNavy/40" aria-hidden />
            </button>
          </div>

          {/* Kontakt oss */}
          <div className="rounded-md border border-synkaNavy/8 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-synkaNavy/40">Kontakt oss</p>
            <a
              href="mailto:hjelp@synka.no"
              className="mt-3 flex items-center justify-between rounded-md border border-synkaNavy/8 px-4 py-3 touch-manipulation active:bg-synkaCream transition"
            >
              <span className="text-[14px] font-medium text-synkaNavy">hjelp@synka.no</span>
              <IconChevronRight size={16} className="shrink-0 text-synkaNavy/40" aria-hidden />
            </a>
          </div>

          {/* Om Synka */}
          <div className="rounded-md border border-synkaNavy/8 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-synkaNavy/40">Om Synka</p>
            <div className="mt-3 flex items-center justify-between px-1">
              <span className="text-[13px] text-synkaNavy/70">Versjon</span>
              <span className="text-[13px] font-medium text-synkaNavy">{APP_VERSION}</span>
            </div>
            <p className="mt-3 px-1 text-[12px] leading-relaxed text-synkaNavy/50">
              Synka er en familiekalender for foreldre som vil ha oversikt over hverdagen – uten stress.
            </p>
          </div>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
        >
          <div className="rounded-lg bg-synkaNavy px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">
            Kommer snart
          </div>
        </div>
      )}
    </div>
  )
}
