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

  const dbg = import.meta.env.DEV || import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true'

  /** Tydelig felles plikt / alle må følge opp */
  const strongObligation =
    /svar i spond|svar innen|\bsenest\b|må svar|svar senest|\bfrist\b|betal|betaling|egenandel|medisin|resept|meld fra om|bekreft|registrer|påmelding|inne før|\balle\s+må\b|\bmå gjøres\b|\bmå gjøre\b|møteplikt/i.test(
      text
    )
  if (strongObligation) {
    if (dbg)
      console.debug('[task intent]', {
        taskIntentStayedMustDo: true,
        taskIntentMustDoSignalMatched: true,
        reason: 'strong_obligation',
      })
    return 'must_do'
  }

  /**
   * Meldeplikt til foresatte: fravær, helseopplysninger — ikke «kan dere hjelpe».
   * Må kjøre før brede «åpen forespørsel»-mønstre (unngå at «hvis/dersom» alene gjør Valgfritt).
   */
  const childOrAttendanceObligation =
    /\b(gi\s+beskjed|meld\s+fra|varsle)\b[\s\S]{0,140}\b(barnet|\bbarn\b)[\s\S]{0,140}(ikke\s+(kan\s+)?komm|kommer\s+ikke|utebliv|fravær|avmelde|sykdom|medisin|allergi|bruker\s+medisin)/i.test(
      text
    ) ||
    /\b(barnet|\bbarn\b)[\s\S]{0,120}(ikke\s+(kan\s+)?komm|kommer\s+ikke|utebliv)[\s\S]{0,100}\b(gi\s+beskjed|meld\s+fra|varsle)\b/i.test(
      text
    )
  if (childOrAttendanceObligation) {
    if (dbg)
      console.debug('[task intent]', {
        taskIntentStayedMustDo: true,
        taskIntentMustDoSignalMatched: true,
        reason: 'child_health_or_attendance_inform',
      })
    return 'must_do'
  }

  /** Åpen forespørsel / dugnad / behov — ikke blanket «hvis» eller «gi beskjed dersom» (treffer også plikt-meldinger). */
  const voluntaryOrOpenRequest =
    /\b(kan noen|om noen kan|vil noen|kunne noen|noen\s+som\s+kan|det trengs|(?:to\s+)?voksne\s+trengs|foreldre\s+trengs|\btrengs\s+til\b|hjelpe med|ta ansvar for|\bfrukt\b|stå i kiosk|med frukt|\bkjøre\b|kjøring|sjåfør|samlingspunkt|dugnad|\bbidra\b|foreldrehjelp|frivillig|om\s+dere\s+har\s+anledning|hvis\s+dere\s+kan\s+hjelpe|om\s+dere\s+kan\s+hjelpe|gi\s+beskjed\s+hvis\s+du\s+kan|gi\s+beskjed\s+hvis\s+dere\s+kan|gi\s+beskjed\s+hvis\s+dere\s+har\s+anledning)/i.test(
      text
    )
  if (voluntaryOrOpenRequest) {
    if (dbg)
      console.debug('[task intent]', {
        taskIntentRelaxedToOptional: true,
        taskIntentOptionalSignalMatched: true,
        reason: 'voluntary_or_open_request',
      })
    return 'can_help'
  }

  if (
    /gi beskjed om/i.test(text) &&
    !/\bhvis du kan\b|\bhvis dere kan\b|\bom du kan hjelpe\b|\bderes anledning\b/i.test(text)
  ) {
    if (dbg)
      console.debug('[task intent]', {
        taskIntentStayedMustDo: true,
        taskIntentMustDoSignalMatched: true,
        reason: 'gi_beskjed_om',
      })
    return 'must_do'
  }

  const helpSignals =
    /kan noen|noen som kan|det trengs|(?:to\s+)?voksne\s+trengs|foreldre\s+trengs|om noen kan|gi beskjed hvis du kan|gi beskjed hvis dere kan|vil noen|kunne noen|hjelpe med|ta ansvar for|\bfrukt\b|stå i kiosk|med frukt|\bkjøre\b|kjøring|sjåfør|samlingspunkt|dugnad|\bbidra\b|foreldrehjelp|om\s+dere\s+har\s+anledning/i
  if (helpSignals.test(text)) {
    if (dbg)
      console.debug('[task intent]', {
        taskIntentRelaxedToOptional: true,
        taskIntentOptionalSignalMatched: true,
        reason: 'help_signals',
      })
    return 'can_help'
  }

  if (dbg)
    console.debug('[task intent]', {
      taskIntentStayedMustDo: true,
      taskIntentMustDoSignalMatched: true,
      reason: 'default',
    })
  return 'must_do'
}
