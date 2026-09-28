import { useState } from 'react'
import type { Person } from '../../types'
import type { CanonicalPlanItem } from '../../lib/canonicalSchoolImportPlan'
import type { ShadowCorrectedItemSnapshot, ShadowReviewVerdict } from '../../lib/shadowAnalysisRunTypes'
import { buildCorrectedItemSnapshot } from '../../lib/shadowReview'

/**
 * Shadow-review-kontroller (pilot-UX; funksjon > polering). Ren presentasjon: all state/persist eies
 * av useShadowReview. Prediction endres ALDRI herfra — «Rett» produserer et komplett correctedSnapshot.
 */

const VERDICT_LABEL: Record<ShadowReviewVerdict, string> = {
  approve: 'Godkjent',
  correct: 'Rettet',
  reject: 'Avvist',
}

const pill = 'rounded-pill border px-2.5 py-1 text-caption font-semibold transition touch-manipulation'

export function ShadowItemReviewControls({
  item,
  verdict,
  onApprove,
  onReject,
  onCorrect,
}: {
  item: CanonicalPlanItem
  verdict: ShadowReviewVerdict | undefined
  onApprove: () => void
  onReject: () => void
  onCorrect: (corrected: ShadowCorrectedItemSnapshot) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ShadowCorrectedItemSnapshot | null>(null)

  const startCorrect = () => {
    setDraft(buildCorrectedItemSnapshot(item)) // seed fra prediksjonen
    setEditing(true)
  }
  const saveCorrect = () => {
    if (!draft) return
    onCorrect(draft)
    setEditing(false)
  }

  if (editing && draft) {
    return (
      <div className="mt-1 rounded-md border border-indigo-200 bg-indigo-50/60 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-900">Rett</p>
        <textarea
          className="mt-1 w-full rounded border border-indigo-200 p-1.5 text-caption"
          rows={Math.max(2, draft.lines.length)}
          value={draft.lines.join('\n')}
          onChange={(e) => setDraft({ ...draft, lines: e.target.value.split('\n') })}
          aria-label="Rett innhold"
        />
        <div className="mt-1 flex gap-2">
          <label className="text-caption text-indigo-900">
            Start
            <input
              className="ml-1 w-20 rounded border border-indigo-200 px-1 text-caption"
              value={draft.start ?? ''}
              onChange={(e) => setDraft({ ...draft, start: e.target.value || null })}
              aria-label="Rett starttid"
            />
          </label>
          <label className="text-caption text-indigo-900">
            Slutt
            <input
              className="ml-1 w-20 rounded border border-indigo-200 px-1 text-caption"
              value={draft.end ?? ''}
              onChange={(e) => setDraft({ ...draft, end: e.target.value || null })}
              aria-label="Rett sluttid"
            />
          </label>
        </div>
        <div className="mt-1.5 flex gap-2">
          <button type="button" className={`${pill} border-indigo-600 bg-indigo-600 text-white`} onClick={saveCorrect}>
            Lagre retting
          </button>
          <button type="button" className={`${pill} border-zinc-300 bg-white text-zinc-700`} onClick={() => setEditing(false)}>
            Avbryt
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        aria-pressed={verdict === 'approve'}
        className={`${pill} ${verdict === 'approve' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-300 bg-white text-emerald-800'}`}
        onClick={onApprove}
      >
        Godkjenn
      </button>
      <button
        type="button"
        aria-pressed={verdict === 'correct'}
        className={`${pill} ${verdict === 'correct' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-indigo-300 bg-white text-indigo-800'}`}
        onClick={startCorrect}
      >
        Rett
      </button>
      <button
        type="button"
        aria-pressed={verdict === 'reject'}
        className={`${pill} ${verdict === 'reject' ? 'border-rose-600 bg-rose-600 text-white' : 'border-rose-300 bg-white text-rose-800'}`}
        onClick={onReject}
      >
        Avvis
      </button>
      {verdict ? <span className="text-caption text-synkaNavy/50">{VERDICT_LABEL[verdict]}</span> : null}
    </div>
  )
}

export function ShadowChildReview({
  predictedChild,
  candidates,
  childApproved,
  correctedChildId,
  onApprove,
  onCorrect,
}: {
  predictedChild: Person | undefined
  candidates: Person[]
  childApproved: boolean
  correctedChildId: string | null | undefined
  onApprove: () => void
  onCorrect: (childId: string) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const correctedName = correctedChildId ? candidates.find((c) => c.id === correctedChildId)?.name : undefined

  return (
    <div className="rounded-md border border-synkaNavy/10 bg-synkaCream/40 p-2">
      {predictedChild ? (
        <p className="text-caption text-synkaNavy/80">
          Dette gjelder: <span className="font-semibold">{predictedChild.name}</span>
        </p>
      ) : (
        <p className="text-caption font-medium text-amber-900">Uavklart barn — velg hvem dette gjelder.</p>
      )}

      {!choosing ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {predictedChild ? (
            <button
              type="button"
              aria-pressed={childApproved}
              className={`${pill} ${childApproved ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-300 bg-white text-emerald-800'}`}
              onClick={onApprove}
            >
              Bekreft barn
            </button>
          ) : null}
          <button
            type="button"
            className={`${pill} border-indigo-300 bg-white text-indigo-800`}
            onClick={() => setChoosing(true)}
          >
            {predictedChild ? 'Endre barn' : 'Velg barn'}
          </button>
          {correctedName ? <span className="text-caption text-synkaNavy/60">Valgt: {correctedName}</span> : null}
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${pill} border-indigo-300 bg-white text-indigo-800`}
              onClick={() => {
                onCorrect(c.id)
                setChoosing(false)
              }}
            >
              {c.name}
            </button>
          ))}
          <button type="button" className={`${pill} border-zinc-300 bg-white text-zinc-700`} onClick={() => setChoosing(false)}>
            Avbryt
          </button>
        </div>
      )}
    </div>
  )
}
