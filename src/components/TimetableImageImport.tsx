import { useRef, useState } from 'react'
import { IconUpload } from '@tabler/icons-react'
import type { ChildSchoolProfile } from '../types'
import { analyzeDocumentWithTankestrom } from '../lib/tankestromApi'
import type { PortalImportProposalBundle } from '../features/tankestrom/types'
import {
  buildTimetableSuggestionFromBundle,
  mergeTimetableSuggestions,
  type TimetableSuggestion,
} from '../lib/timetableImageImport'
import { UploadFileList, type UploadFileChip } from './UploadFileList'

interface TimetableImageImportProps {
  /** Kalles når brukeren bekrefter «Bruk forslag». Erstatter IKKE state automatisk. */
  onApply: (profile: ChildSchoolProfile) => void
}

// Speiler Tankestrøm-opplastingens aksepterte typer (bilde, PDF, Word/DOCX).
const TIMETABLE_FILE_ACCEPT =
  'image/*,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function isBundle(x: unknown): x is PortalImportProposalBundle {
  return !!x && typeof x === 'object' && Array.isArray((x as { items?: unknown }).items)
}

/**
 * Foreslå timeplan fra ett eller flere bilder/dokumenter via eksisterende Tankestrøm-analyse.
 * Filene legges først i en oversikt (miniatyr + navn + ×) — analysen starter IKKE automatisk, men
 * når brukeren trykker «Analyser». Resultatet er et FORSLAG som må bekreftes; ingenting lagres, og
 * manuell redigering beholdes.
 */
export function TimetableImageImport({ onApply }: TimetableImageImportProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const idCounter = useRef(0)
  const [pendingFiles, setPendingFiles] = useState<UploadFileChip[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<TimetableSuggestion | null>(null)
  const [analyzedCount, setAnalyzedCount] = useState(0)

  /** Legg valgte filer i lista — analyser IKKE (det skjer på «Analyser»-knappen). */
  function addFiles(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : []
    if (files.length === 0) return
    setError(null)
    setPendingFiles((prev) => [
      ...prev,
      ...files.map((file) => ({ id: `tt-${idCounter.current++}`, file, status: 'ready' as const })),
    ])
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeFile(id: string) {
    if (loading) return
    setPendingFiles((prev) => prev.filter((p) => p.id !== id))
    setError(null)
  }

  function patchFile(id: string, patch: Partial<Pick<UploadFileChip, 'status' | 'statusDetail'>>) {
    setPendingFiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  /** Analyser ALLE valgte filer og slå sammen til ett forslag. Tømmer ikke lista (kan re-analyseres). */
  async function analyze() {
    if (pendingFiles.length === 0 || loading) return
    setLoading(true)
    setError(null)
    setSuggestion(null)
    setPendingFiles((prev) =>
      prev.map((p) => ({ ...p, status: 'analyzing' as const, statusDetail: undefined }))
    )

    const suggestions: TimetableSuggestion[] = []
    const fileWarnings: string[] = []
    for (const pf of pendingFiles) {
      try {
        const result = await analyzeDocumentWithTankestrom(pf.file)
        const next = isBundle(result) ? buildTimetableSuggestionFromBundle(result) : null
        if (next) {
          suggestions.push(next)
          patchFile(pf.id, { status: 'done' })
        } else {
          fileWarnings.push(`Fant ingen timeplan i «${pf.file.name}».`)
          patchFile(pf.id, { status: 'error', statusDetail: 'Ingen timeplan funnet' })
        }
      } catch (e) {
        fileWarnings.push(
          `Kunne ikke lese «${pf.file.name}»${e instanceof Error ? `: ${e.message}` : ''}.`
        )
        patchFile(pf.id, { status: 'error', statusDetail: e instanceof Error ? e.message : 'Feil' })
      }
    }

    setAnalyzedCount(pendingFiles.length)
    if (suggestions.length === 0) {
      // Ingen fil ga forslag — behold manuell redigering.
      setError(fileWarnings[0] ?? 'Fant ingen timeplan i filene. Du kan fortsatt fylle ut manuelt.')
    } else {
      const merged = mergeTimetableSuggestions(suggestions)
      // Per-fil-advarsler (feilede filer) først, så merge-/forenklingsadvarsler.
      setSuggestion({ ...merged, warnings: [...fileWarnings, ...merged.warnings] })
    }
    setLoading(false)
  }

  return (
    <div className="space-y-2 rounded-md border border-synkaNavy/12 bg-white/60 p-3">
      <div>
        <p className="text-body-sm font-semibold text-synkaNavy">Les timeplan med Tankestrøm</p>
        <p className="mt-0.5 text-caption text-synkaNavy/55">
          Last opp ett eller flere bilder, PDF-er eller dokumenter av timeplanen. Du får et forslag du
          kan sjekke før det brukes.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={TIMETABLE_FILE_ACCEPT}
        multiple
        className="hidden"
        aria-label="Timeplanfiler"
        onChange={(e) => addFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-pill border border-synkaNavy/15 bg-white px-3.5 py-2 text-body-sm font-semibold text-synkaNavy transition hover:bg-synkaNavy/5 disabled:opacity-60"
      >
        <IconUpload size={14} aria-hidden />
        Velg filer
      </button>

      <UploadFileList
        files={pendingFiles}
        onRemove={removeFile}
        onAnalyze={() => void analyze()}
        analyzing={loading}
      />

      {error && (
        <p role="alert" className="text-caption text-synkaCoral">
          {error}
        </p>
      )}

      {suggestion && (
        <div className="rounded-md border border-synkaNavy/12 bg-white p-3">
          <p className="text-body-sm font-semibold text-synkaNavy">Forslag fra Tankestrøm</p>
          <p className="text-caption text-synkaNavy/55">
            Analyserte {analyzedCount} {analyzedCount === 1 ? 'fil' : 'filer'}
          </p>
          {suggestion.warnings.length > 0 && (
            <ul className="mt-1.5 list-disc pl-4 text-caption text-synkaNavy/55">
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
                  {d.lessonCount ? ` · ${d.lessonCount} fag` : ''}
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
                setPendingFiles([])
                setAnalyzedCount(0)
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
