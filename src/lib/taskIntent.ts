import type { TaskIntent } from '../types'

export const TASK_INTENT_VALUES: readonly TaskIntent[] = ['must_do', 'can_help'] as const

export function isTaskIntent(v: unknown): v is TaskIntent {
  return v === 'must_do' || v === 'can_help'
}

export function normalizeTaskIntent(v: unknown): TaskIntent | undefined {
  if (isTaskIntent(v)) return v
  return undefined
}

/** Visningsetiketter (review, lister). Intern verdi `can_help` vises som «Valgfritt». */
export function taskIntentLabelNb(intent: TaskIntent): string {
  return intent === 'must_do' ? 'Må gjøre' : 'Valgfritt'
}

export function taskIntentBadgeClassName(intent: TaskIntent): string {
  return intent === 'must_do'
    ? 'border-zinc-200 bg-zinc-100/90 text-zinc-700'
    : 'border-teal-200/90 bg-teal-50/95 text-teal-900'
}

/**
 * Enkel heuristikk for Tankestrom (API kan overstyre med task.taskIntent).
 * Sterke «plikt»-signal vinner over «frivillig».
 */
export function suggestTaskIntentFromTitleAndNotes(title: string, notes?: string): TaskIntent {
  const raw = `${title}\n${notes ?? ''}`
  let text = raw.toLocaleLowerCase('nb-NO')
  text = text.replace(/^fra:\s*[^\n]*(\n\n|\n)?/i, '')

  if (
    /svar i spond|må svar|svar senest|\bfrist\b|betal|betaling|egenandel|medisin|resept|meld fra om|bekreft|registrer|påmelding|kommer ikke|inne før/i.test(
      text
    )
  ) {
    return 'must_do'
  }
  if (/gi beskjed om/i.test(text) && !/\bhvis du kan\b|\bom du kan hjelpe\b/i.test(text)) {
    return 'must_do'
  }

  const helpSignals =
    /kan noen|noen som kan|trengs\s+(to\s+)?voksne|det trengs|om noen kan|gi beskjed hvis du kan|vil noen|kunne noen|hjelpe med|stå i kiosk|med frukt|\bkjøre\b|sjåfør|samlingspunkt|dugnad|\bbidra\b|foreldrehjelp/i
  if (helpSignals.test(text)) return 'can_help'

  return 'must_do'
}
