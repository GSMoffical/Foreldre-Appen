import { useState } from 'react'
import type { CalendarUpdateCandidate } from '../../lib/tankestromCalendarUpdateCandidates'
import {
  calendarUpdateDiffIsEmpty,
  type CalendarUpdateDiff,
} from '../../lib/tankestromCalendarUpdateDiff'
import {
  friendlyDiffLines,
  groupUpdateCandidates,
  type UpdateCandidateGroup,
} from '../../lib/tankestromUpdatePreview'

/**
 * Oppdateringspreview v2 i import-flyten. Viser ÉN samlet preview per arrangement (gruppert), med
 * forståelig dagvis «Eksisterende» vs «Ny/Endret» (markert grønt + tekst-labels). Teknisk diff ligger
 * bak «Se tekniske detaljer». Komponenten endrer INGEN kalenderdata og bygger ingen patch:
 *  - «Vis eksisterende» åpner den eksisterende hendelsen (hvis `onOpenExisting` er gitt),
 *  - «Importer som ny likevel» re-inkluderer forslaget for ny-import (toggle); oppretter ikke selv.
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
  onOpenExisting?: (eventId: string) => void
  diffByCandidateId?: Record<string, CalendarUpdateDiff>
  proposalId?: string
  isUpdateMode?: boolean
  isImportingAsNew?: boolean
  onImportAsNew?: (proposalId: string) => void
}) {
  const [dismissed, setDismissed] = useState(false)
  if (candidates.length === 0 || dismissed) return null

  const groups = groupUpdateCandidates(candidates)
  const canImportAsNew = isUpdateMode && !!proposalId && !!onImportAsNew

  return (
    <div className="mt-1.5 rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2">
      {groups.map((group) => (
        <UpdateGroupBlock
          key={group.key}
          group={group}
          isUpdateMode={isUpdateMode}
          diffByCandidateId={diffByCandidateId}
          onOpenExisting={onOpenExisting}
        />
      ))}

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

function UpdateGroupBlock({
  group,
  isUpdateMode,
  diffByCandidateId,
  onOpenExisting,
}: {
  group: UpdateCandidateGroup
  isUpdateMode: boolean
  diffByCandidateId?: Record<string, CalendarUpdateDiff>
  onOpenExisting?: (eventId: string) => void
}) {
  return (
    <div className="mb-1">
      <p className="text-caption font-semibold text-amber-900">
        {isUpdateMode ? 'Dette ser ut som en oppdatering til:' : 'Kan være oppdatering til eksisterende:'}
      </p>
      <p className="text-caption font-medium text-amber-900">
        {group.title}
        {group.dateRangeLabel ? <span className="text-amber-900/70"> · {group.dateRangeLabel}</span> : null}
      </p>
      <div className="mt-1.5 space-y-2">
        {group.candidates.map((candidate) => (
          <DayRow
            key={candidate.id}
            candidate={candidate}
            diff={diffByCandidateId?.[candidate.id]}
            onOpenExisting={onOpenExisting}
          />
        ))}
      </div>
    </div>
  )
}

function DayRow({
  candidate,
  diff,
  onOpenExisting,
}: {
  candidate: CalendarUpdateCandidate
  diff?: CalendarUpdateDiff
  onOpenExisting?: (eventId: string) => void
}) {
  const [showTech, setShowTech] = useState(false)
  const friendly = diff ? friendlyDiffLines(diff) : { existing: [], changes: [], note: undefined }
  const hasTech = !!diff && !calendarUpdateDiffIsEmpty(diff)
  const nothingFriendly = friendly.existing.length === 0 && friendly.changes.length === 0 && !friendly.note

  return (
    <div className="rounded-md border border-amber-200/70 bg-white/60 px-2.5 py-2">
      {candidate.dateLabel ? (
        <p className="text-caption font-semibold text-amber-900">{candidate.dateLabel}</p>
      ) : (
        <p className="text-caption font-semibold text-amber-900">{candidate.title}</p>
      )}

      {friendly.existing.length > 0 && (
        <div className="mt-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/70">Eksisterende</p>
          <ul className="text-caption text-zinc-800">
            {friendly.existing.map((line, i) => (
              <li key={i} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {friendly.changes.length > 0 && (
        <div className="mt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Ny / endret</p>
          <ul className="space-y-0.5 text-caption text-emerald-800">
            {friendly.changes.map((c, i) => (
              <li key={i} className="break-words">
                <span className="mr-1 rounded-pill bg-emerald-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-800">
                  {c.kind}
                </span>
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {friendly.note ? <p className="mt-1 text-caption text-amber-900/70">{friendly.note}</p> : null}
      {nothingFriendly ? <p className="mt-0.5 text-caption text-amber-900/60">Ingen tydelige endringer.</p> : null}

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {onOpenExisting && (
          <button type="button" onClick={() => onOpenExisting(candidate.id)} className={SMALL_BTN}>
            Vis eksisterende
          </button>
        )}
        {hasTech && (
          <button type="button" onClick={() => setShowTech((v) => !v)} className={SMALL_BTN}>
            {showTech ? 'Skjul tekniske detaljer' : 'Se tekniske detaljer'}
          </button>
        )}
      </div>

      {hasTech && showTech ? <TechDiffView diff={diff!} /> : null}
    </div>
  )
}

function TechSection({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <div className="mt-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-caption text-zinc-700">
        {lines.map((l, i) => (
          <li key={i} className="break-words">
            {l}
          </li>
        ))}
      </ul>
    </div>
  )
}

function TechDiffView({ diff }: { diff: CalendarUpdateDiff }) {
  return (
    <div className="mt-2 rounded-md border border-zinc-200 bg-white/80 px-2.5 py-2">
      <p className="text-caption font-semibold text-zinc-600">Tekniske detaljer</p>
      <TechSection title="Endres" lines={diff.changed.map((c) => `${c.label}: ${c.oldValue} → ${c.newValue}`)} />
      <TechSection title="Legges til" lines={diff.added.map((a) => `${a.label}: ${a.value}`)} />
      <TechSection title="Beholdes" lines={diff.kept.map((k) => `${k.label}: ${k.value}`)} />
      <TechSection title="Usikkert" lines={diff.uncertain.map((u) => `${u.label}: ${u.reason}`)} />
    </div>
  )
}
