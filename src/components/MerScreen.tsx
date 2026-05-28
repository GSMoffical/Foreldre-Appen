interface MerScreenProps {
  onNavigateSettings: () => void
  onNavigateTankestrom?: () => void
  onNavigateFamilie?: () => void
}

export function MerScreen({ onNavigateSettings }: MerScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-synkaCream">
      <div className="flex items-center gap-2 px-4 pt-6 pb-4">
        <span className="inline-flex items-center gap-1" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-synkaTeal" />
          <span className="h-2.5 w-2.5 rounded-full bg-synkaYellow" />
        </span>
        <h1 className="text-[22px] font-bold text-synkaNavy">Mer</h1>
      </div>

      <div className="flex flex-col gap-2 px-4 pb-6">
        {/* Tankestrøm — featured */}
        <div className="flex items-center gap-3 p-4 rounded-md bg-synkaTeal/10 border border-synkaTeal/30">
          <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md bg-synkaTeal/20">
            <i className="ti ti-brain text-synkaTeal" aria-hidden style={{ fontSize: 18 }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-synkaNavy">Tankestrøm</span>
              <span className="rounded-pill bg-synkaTeal px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                NY
              </span>
            </div>
            <p className="text-[12px] text-synkaNavy/60">Importer hendelser fra tekst og bilder</p>
          </div>
          <i className="ti ti-chevron-right shrink-0 text-synkaNavy/40" aria-hidden style={{ fontSize: 16 }} />
        </div>

        {/* Familie */}
        <div className="flex items-center gap-3 p-4 bg-white rounded-md">
          <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md bg-synkaPrimary/10">
            <i className="ti ti-users text-synkaPrimary" aria-hidden style={{ fontSize: 18 }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-synkaNavy">Familie</p>
            <p className="text-[12px] text-synkaNavy/60">Administrer familiemedlemmer</p>
          </div>
          <i className="ti ti-chevron-right shrink-0 text-synkaNavy/40" aria-hidden style={{ fontSize: 16 }} />
        </div>

        {/* Innstillinger */}
        <button
          type="button"
          onClick={onNavigateSettings}
          className="flex items-center gap-3 p-4 bg-white rounded-md touch-manipulation active:bg-synkaCream text-left w-full"
        >
          <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md bg-synkaNavy/10">
            <i className="ti ti-settings text-synkaNavy" aria-hidden style={{ fontSize: 18 }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-synkaNavy">Innstillinger</p>
            <p className="text-[12px] text-synkaNavy/60">App-preferanser og konto</p>
          </div>
          <i className="ti ti-chevron-right shrink-0 text-synkaNavy/40" aria-hidden style={{ fontSize: 16 }} />
        </button>

        {/* Hjelp */}
        <div className="flex items-center gap-3 p-4 bg-white rounded-md">
          <div className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md bg-synkaYellow/20">
            <i className="ti ti-help text-synkaYellow" aria-hidden style={{ fontSize: 18 }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-synkaNavy">Hjelp</p>
            <p className="text-[12px] text-synkaNavy/60">Veiledning og støtte</p>
          </div>
          <i className="ti ti-chevron-right shrink-0 text-synkaNavy/40" aria-hidden style={{ fontSize: 16 }} />
        </div>
      </div>
    </div>
  )
}
