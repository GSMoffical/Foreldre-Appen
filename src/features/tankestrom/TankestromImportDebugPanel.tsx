import { useCallback, useState, type ReactNode } from 'react'
import type { TankestromImportFullDebugSnapshot } from './tankestromImportDebug'
import { sanitizeForDebugClipboard } from './tankestromImportDebug'

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-[11px] font-bold uppercase tracking-wide text-zinc-600">
      {children}
    </h3>
  )
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-48 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 text-[10px] leading-snug text-zinc-800 whitespace-pre-wrap break-words">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function TankestromImportDebugPanel({ snapshot }: { snapshot: TankestromImportFullDebugSnapshot | null }) {
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  const onCopyJson = useCallback(async () => {
    if (!snapshot) return
    const sanitized = sanitizeForDebugClipboard(snapshot)
    const text = JSON.stringify(sanitized, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setCopyMsg('Kopiert.')
      window.setTimeout(() => setCopyMsg(null), 2000)
    } catch {
      setCopyMsg('Kunne ikke kopiere.')
      window.setTimeout(() => setCopyMsg(null), 3000)
    }
  }, [snapshot])

  if (!snapshot) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50/50 px-3 py-2 text-[11px] text-amber-950">
        Ingen import-debug ennå. Kjør analyse (eller analyser på nytt) for å fylle snapshot.
      </div>
    )
  }

  const a = snapshot.analyze

  return (
    <div className="space-y-4 rounded-xl border border-amber-200/90 bg-amber-50/40 px-3 py-3 text-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-amber-950">Tankestrøm import-debug (kun utvikling)</p>
        <button
          type="button"
          onClick={onCopyJson}
          className="rounded-lg border border-amber-400/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-950 hover:bg-amber-50"
        >
          Copy debug JSON
        </button>
      </div>
      {copyMsg ? <p className="text-[10px] text-amber-800">{copyMsg}</p> : null}
      {snapshot.analyzeWarning ? (
        <p className="rounded-md border border-amber-200 bg-white/80 px-2 py-1.5 text-[10px] whitespace-pre-wrap text-amber-950">
          {snapshot.analyzeWarning}
        </p>
      ) : null}

      <section className="space-y-1.5" aria-labelledby="ts-dbg-raw">
        <SectionTitle id="ts-dbg-raw">A. Raw response</SectionTitle>
        {a ? (
          <>
            <ul className="grid grid-cols-2 gap-1 text-[10px] sm:grid-cols-3">
              <li>itemCount: {a.raw.itemCount}</li>
              <li>eventCount: {a.raw.eventCount}</li>
              <li>taskCount: {a.raw.taskCount}</li>
              <li>parentCount: {a.raw.parentCount}</li>
              <li>childCount: {a.raw.childCount}</li>
              <li>embeddedSchedule: {a.raw.embeddedScheduleCount}</li>
              <li>fileErrors: {a.raw.fileErrorsCount}</li>
              <li className="sm:col-span-2">importRunId: {a.raw.importRunId || '—'}</li>
            </ul>
            <JsonBlock value={a.raw.items} />
          </>
        ) : (
          <p className="text-[10px] text-zinc-500">Mangler analyse-snapshot.</p>
        )}
      </section>

      <section className="space-y-1.5" aria-labelledby="ts-dbg-fold">
        <SectionTitle id="ts-dbg-fold">B. Etter legacy fold</SectionTitle>
        {a ? (
          <>
            <ul className="text-[10px]">
              <li>
                itemCount: {a.itemCountBeforeFold} → {a.afterLegacyFold.itemCount}
              </li>
              <li>
                parentCount: {a.afterLegacyFold.parentCount} · childCount: {a.afterLegacyFold.childCount}
              </li>
              <li>
                embeddedScheduleRawCount: {a.afterLegacyFold.embeddedScheduleRawCount} · deduped:{' '}
                {a.afterLegacyFold.embeddedScheduleDedupedCount}
              </li>
            </ul>
            <JsonBlock value={a.afterLegacyFold.segments} />
          </>
        ) : null}
      </section>

      <section className="space-y-1.5" aria-labelledby="ts-dbg-def">
        <SectionTitle id="ts-dbg-def">C. Etter defensive normalize</SectionTitle>
        {a ? <JsonBlock value={a.afterDefensive.segments} /> : null}
      </section>

      <section className="space-y-1.5" aria-labelledby="ts-dbg-render">
        <SectionTitle id="ts-dbg-render">D. Render-input (delprogram)</SectionTitle>
        <JsonBlock value={snapshot.renderInput} />
      </section>

      <section className="space-y-1.5" aria-labelledby="ts-dbg-persist">
        <SectionTitle id="ts-dbg-persist">E. Persist plan</SectionTitle>
        <p className="text-[10px] text-zinc-600">
          Sist bygget ved import-forsøk{snapshot.lastImportAttemptStatus ? ` (${snapshot.lastImportAttemptStatus})` : ''}.
          Tom liste før første import i denne økten.
        </p>
        <JsonBlock value={snapshot.persistPlan} />
      </section>

      <section className="space-y-1.5" aria-labelledby="ts-dbg-warn">
        <SectionTitle id="ts-dbg-warn">F. Warnings</SectionTitle>
        {snapshot.warnings.length === 0 ? (
          <p className="text-[10px] text-zinc-600">Ingen automatiske varsler.</p>
        ) : (
          <ul className="list-inside list-disc space-y-0.5 text-[10px] text-amber-950">
            {snapshot.warnings.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
