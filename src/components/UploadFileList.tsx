import { IconFile, IconX } from '@tabler/icons-react'
import { useFilePreviews } from './useFilePreviews'

export interface UploadFileChip {
  id: string
  file: File
  status: 'ready' | 'analyzing' | 'done' | 'error'
  /** Kort feilmelding / detalj ved error (eller annen status). */
  statusDetail?: string
}

export interface UploadFileListProps {
  files: UploadFileChip[]
  onRemove: (id: string) => void
  onAnalyze: () => void
  /** Pågående analyse: disabler × og «Analyser», viser «Analyserer…». */
  analyzing: boolean
  /** Skjul den interne «Analyser»-knappen (dialogen har sin egen). Default: vis. */
  showAnalyzeButton?: boolean
  /** Valgfri ekstra blokkering av «Analyser» fra kalleren. */
  analyzeDisabled?: boolean
  className?: string
}

function statusLabel(chip: UploadFileChip): string {
  switch (chip.status) {
    case 'analyzing':
      return 'Analyserer…'
    case 'done':
      return 'Ferdig'
    case 'error':
      return chip.statusDetail || 'Feil'
    default:
      return chip.statusDetail || 'Klar'
  }
}

/**
 * Delt presentasjon av valgte filer før/under analyse: miniatyr (bilde) eller generisk ikon (PDF/dok),
 * filnavn, status og ×-knapp per fil, samt en valgfri «Analyser»-knapp. Eier ikke state eller analyse —
 * kun visning + callbacks. Brukt på hovedsiden, i import-dialogen og i timeplan-opplastingen.
 */
export function UploadFileList({
  files,
  onRemove,
  onAnalyze,
  analyzing,
  showAnalyzeButton = true,
  analyzeDisabled = false,
  className,
}: UploadFileListProps) {
  const previews = useFilePreviews(files)
  if (files.length === 0) return null

  return (
    <div className={className}>
      <ul className="space-y-2" aria-label="Valgte filer">
        {files.map((chip) => {
          const previewUrl = previews[chip.id]
          return (
            <li
              key={chip.id}
              className="flex items-center gap-2.5 rounded-lg border border-synkaNavy/10 bg-white px-2.5 py-2 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-synkaNavy/5">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <IconFile size={20} className="text-synkaNavy/40" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-body-sm font-medium text-synkaNavy"
                  title={chip.file.name}
                >
                  {chip.file.name}
                </p>
                <p className="mt-0.5 truncate text-caption text-synkaNavy/55">{statusLabel(chip)}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(chip.id)}
                disabled={analyzing}
                aria-label={`Fjern ${chip.file.name}`}
                className="shrink-0 rounded-md p-1.5 text-synkaNavy/40 transition hover:bg-synkaNavy/8 hover:text-synkaNavy/70 disabled:pointer-events-none disabled:opacity-40"
              >
                <IconX size={16} aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>

      {showAnalyzeButton ? (
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing || files.length === 0 || analyzeDisabled}
          className="mt-3 w-full rounded-pill bg-synkaPrimary py-2.5 text-body-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
        >
          {analyzing ? 'Analyserer…' : 'Analyser'}
        </button>
      ) : null}
    </div>
  )
}
