import { useState } from 'react'
import type { CalendarUpdateCandidate } from '../../lib/tankestromCalendarUpdateCandidates'

/**
 * Liten, ikke-forstyrrende seksjon i import-preview som viser at et forslag KAN være en oppdatering
 * til en eksisterende kalenderhendelse. Oppdaterer ingenting — «Importer som ny» avviser bare hintet
 * (forslaget importeres som nytt, slik det allerede gjør).
 */
export function CalendarUpdateCandidates({ candidates }: { candidates: CalendarUpdateCandidate[] }) {
  const [dismissed, setDismissed] = useState(false)
  if (candidates.length === 0 || dismissed) return null
  return (
    <div className="mt-1.5 rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2">
      <p className="text-caption font-semibold text-amber-900">Kan være oppdatering til eksisterende:</p>
      <ul className="mt-1 space-y-1.5">
        {candidates.map((c) => (
          <li key={c.id} className="text-caption text-amber-900/90">
            <span className="font-medium">{c.title}</span>
            {c.dateLabel ? <span className="text-amber-900/70"> — {c.dateLabel}</span> : null}
            <span className="block text-amber-900/60">{c.explanation}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-pill border border-amber-300 bg-white px-3 py-1 text-caption font-semibold text-amber-900 transition hover:bg-amber-100/60"
        >
          Importer som ny
        </button>
      </div>
    </div>
  )
}
