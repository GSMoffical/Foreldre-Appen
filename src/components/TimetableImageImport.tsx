import { useRef, useState } from 'react'
import { IconUpload } from '@tabler/icons-react'
import type { ChildSchoolProfile } from '../types'
import { analyzeDocumentWithTankestrom } from '../lib/tankestromApi'
import type { PortalImportProposalBundle } from '../features/tankestrom/types'
import { buildTimetableSuggestionFromBundle, type TimetableSuggestion } from '../lib/timetableImageImport'

interface TimetableImageImportProps {
  /** Kalles når brukeren bekrefter «Bruk forslag». Erstatter IKKE state automatisk. */
  onApply: (profile: ChildSchoolProfile) => void
}

function isBundle(x: unknown): x is PortalImportProposalBundle {
  return !!x && typeof x === 'object' && Array.isArray((x as { items?: unknown }).items)
}

/**
 * MVP: foreslå timeplan fra et bilde via eksisterende Tankestrøm-bildeanalyse. Resultatet er et
 * FORSLAG som brukeren må bekrefte — ingenting lagres, og manuell redigering beholdes.
 */
export function TimetableImageImport({ onApply }: TimetableImageImportProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<TimetableSuggestion | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setLoading(true)
    setError(null)
    setSuggestion(null)
    try {
      const result = await analyzeDocumentWithTankestrom(file)
      const next = isBundle(result) ? buildTimetableSuggestionFromBundle(result) : null
      if (!next) {
        setError('Fant ikke nok struktur til en timeplan i bildet. Du kan fortsatt fylle ut manuelt.')
        return
      }
      setSuggestion(next)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Kunne ikke lese timeplan fra bildet. Du kan fortsatt fylle ut manuelt.'
      )
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Bilde av timeplan"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-pill border border-synkaNavy/15 bg-white px-3.5 py-2 text-body-sm font-semibold text-synkaNavy transition hover:bg-synkaNavy/5 disabled:opacity-60"
      >
        <IconUpload size={14} aria-hidden />
        {loading ? 'Leser bilde…' : 'Importer fra bilde'}
      </button>

      {error && (
        <p role="alert" className="text-caption text-synkaCoral">
          {error}
        </p>
      )}

      {suggestion && (
        <div className="rounded-md border border-synkaNavy/12 bg-white p-3">
          <p className="text-body-sm font-semibold text-synkaNavy">Forslag fra bilde</p>
          {suggestion.warnings.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-caption text-synkaNavy/55">
              {suggestion.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <ul className="mt-2 space-y-1">
            {suggestion.days.map((d) => (
              <li key={d.weekday} className="flex justify-between text-body-sm text-synkaNavy">
                <span className="font-medium">{d.label}</span>
                <span className="tabular-nums text-synkaNavy/70">
                  {d.startTime && d.endTime ? `${d.startTime}–${d.endTime}` : 'Ukjent tid'}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onApply(suggestion.profile)
                setSuggestion(null)
              }}
              className="rounded-pill bg-synkaPrimary px-4 py-2 text-body-sm font-semibold text-white transition hover:brightness-95"
            >
              Bruk forslag
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="rounded-pill border border-synkaNavy/15 bg-white px-4 py-2 text-body-sm font-semibold text-synkaNavy transition hover:bg-synkaNavy/5"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
