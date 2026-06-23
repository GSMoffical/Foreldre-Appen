import { useState } from 'react'
import type { CalendarUpdateCandidate } from '../../lib/tankestromCalendarUpdateCandidates'
import {
  calendarUpdateDiffIsEmpty,
  type CalendarUpdateDiff,
} from '../../lib/tankestromCalendarUpdateDiff'

/**
 * Liten seksjon i import-preview som viser at et forslag KAN være en oppdatering til en eksisterende
 * kalenderhendelse.
 *  - «Vis eksisterende» åpner den eksisterende hendelsen (hvis `onOpenExisting` er gitt).
 *  - «Se mulige endringer» viser en read-only diff (beregner ingen patch, lagrer ingenting).
 *  - Når forslaget er i UPDATE-modus (sterk/middels kandidat), er det ekskludert fra standard
 *    «Legg til»-importen som standard. «Importer som ny likevel» re-inkluderer det eksplisitt
 *    (gjør det eligible for ny-import) — den OPPRETTER ikke noe selv. Ingen kalenderdata endres her.
 */
export function CalendarUpdateCandidates({
  candidates,
  onOpenExisting,
  diffByCandidateId,
  proposalId,
  isUpdateMode = false,
  isImportingAsNew = false,
  onImportAsNew,
}: {
  candidates: CalendarUpdateCandidate[]
  /** Åpner den eksisterende kalenderhendelsen. Utelates hvis appen ikke kan åpne den trygt. */
  onOpenExisting?: (eventId: string) => void
  /** Read-only diff per kandidat (kandidatens id → diff). Tomme/manglende differ skjules. */
  diffByCandidateId?: Record<string, CalendarUpdateDiff>
  /** Importforslagets id (for «Importer som ny likevel»). */
  proposalId?: string
  /** True når forslaget behandles som mulig oppdatering (ekskludert fra standardimport). */
  isUpdateMode?: boolean
  /** True når forslaget nå er eksplisitt valgt for ny-import (eligible / telt). */
  isImportingAsNew?: boolean
  /** Re-inkluderer/ekskluderer forslaget for ny-import (toggle). Endrer ingen kalenderdata. */
  onImportAsNew?: (proposalId: string) => void
}) {
  const [dismissed, setDismissed] = useState(false)
  if (candidates.length === 0 || dismissed) return null

  const canImportAsNew = isUpdateMode && !!proposalId && !!onImportAsNew

  return (
    <div className="mt-1.5 rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2">
      <p className="text-caption font-semibold text-amber-900">
        {isUpdateMode ? 'Dette ser ut som en oppdatering til:' : 'Kan være oppdatering til eksisterende:'}
      </p>
      <ul className="mt-1 space-y-1.5">
        {candidates.map((c) => (
          <CandidateRow
            key={c.id}
            candidate={c}
            diff={diffByCandidateId?.[c.id]}
            onOpenExisting={onOpenExisting}
          />
        ))}
      </ul>

      <div className="mt-2">
        {canImportAsNew ? (
          isImportingAsNew ? (
            <div className="space-y-1">
              <p className="text-caption text-amber-900/70">
                Importeres som ny hendelse (i tillegg til den eksisterende).
              </p>
              <button type="button" onClick={() => onImportAsNew!(proposalId!)} className={SMALL_BTN}>
                Angre – ikke importer som ny
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => onImportAsNew!(proposalId!)} className={SMALL_BTN}>
              Importer som ny likevel
            </button>
          )
        ) : (
          <button type="button" onClick={() => setDismissed(true)} className={SMALL_BTN}>
            Skjul hint
          </button>
        )}
      </div>
    </div>
  )
}

const SMALL_BTN =
  'rounded-pill border border-amber-300 bg-white px-3 py-1 text-caption font-semibold text-amber-900 transition hover:bg-amber-100/60'

function CandidateRow({
  candidate,
  diff,
  onOpenExisting,
}: {
  candidate: CalendarUpdateCandidate
  diff?: CalendarUpdateDiff
  onOpenExisting?: (eventId: string) => void
}) {
  const [showDiff, setShowDiff] = useState(false)
  const hasDiff = !!diff && !calendarUpdateDiffIsEmpty(diff)
  return (
    <li className="text-caption text-amber-900/90">
      <span className="font-medium">{candidate.title}</span>
      {candidate.dateLabel ? <span className="text-amber-900/70"> — {candidate.dateLabel}</span> : null}
      <span className="block text-amber-900/60">{candidate.explanation}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {onOpenExisting && (
          <button type="button" onClick={() => onOpenExisting(candidate.id)} className={SMALL_BTN}>
            Vis eksisterende
          </button>
        )}
        {hasDiff && (
          <button type="button" onClick={() => setShowDiff((v) => !v)} className={SMALL_BTN}>
            {showDiff ? 'Skjul endringer' : 'Se mulige endringer'}
          </button>
        )}
      </div>
      {hasDiff && showDiff ? <DiffView diff={diff!} /> : null}
    </li>
  )
}

function DiffSection({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <div className="mt-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80">{title}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-caption text-amber-900/90">
        {lines.map((l, i) => (
          <li key={i} className="break-words">
            {l}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DiffView({ diff }: { diff: CalendarUpdateDiff }) {
  return (
    <div className="mt-2 rounded-md border border-amber-200/80 bg-white/70 px-2.5 py-2">
      <p className="text-caption font-semibold text-amber-900">Mulige endringer</p>
      <DiffSection title="Endres" lines={diff.changed.map((c) => `${c.label}: ${c.oldValue} → ${c.newValue}`)} />
      <DiffSection title="Legges til" lines={diff.added.map((a) => `${a.label}: ${a.value}`)} />
      <DiffSection title="Beholdes" lines={diff.kept.map((k) => `${k.label}: ${k.value}`)} />
      <DiffSection title="Usikkert" lines={diff.uncertain.map((u) => `${u.label}: ${u.reason}`)} />
    </div>
  )
}
