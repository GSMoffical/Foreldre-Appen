import type { EventMetadata } from '../types'
import { readTankestromScheduleDetailsFromMetadata } from './tankestromScheduleDetails'

/**
 * Server-satt skole-klassifisering per dag. Tankestrømmen setter `event.metadata.schoolDayOverride`
 * (med `overrideKind`) og `event.metadata.schoolContext` eksplisitt for at Foreldre-App skal lese dem.
 * Disse er ikke i `EventMetadata`-typen (frie ekstra-felt), så vi leser dem defensivt.
 */
const OVERRIDE_KIND_LABEL: Record<string, string> = {
  exam_day: 'Eksamen',
  trip_day: 'Tur / utflukt',
  activity_day: 'Aktivitet',
  free_day: 'Fri',
  delayed_start: 'Sen start',
  early_end: 'Tidlig slutt',
}

const HEADING_HIGHLIGHT_MAX = 32

function readOverrideKind(metadata: EventMetadata | undefined): string | undefined {
  const ov = (metadata as Record<string, unknown> | undefined)?.schoolDayOverride
  if (ov && typeof ov === 'object') {
    const kind = (ov as { overrideKind?: unknown }).overrideKind
    if (typeof kind === 'string') return kind
  }
  return undefined
}

/** True når hendelsen er en skole-dag (tankestrømmen satte `schoolContext`). */
export function isSchoolDayEvent(metadata: EventMetadata | undefined): boolean {
  return !!(metadata as Record<string, unknown> | undefined)?.schoolContext
}

/**
 * Kort, ren per-dag-overskrift for en skole-dag-hendelse, fra serverens klassifisering
 * (`schoolDayOverride.overrideKind` → norsk etikett), ellers en kort timet aktivitet
 * (highlight-label). Returnerer `undefined` når ingen ren kilde finnes — **avkapper aldri lang prosa**
 * (kaller viser da bare ukedag+dato). `reason`/prosa forblir i kortets notat-seksjon.
 */
export function deriveSchoolDayHeading(metadata: EventMetadata | undefined): string | undefined {
  const kind = readOverrideKind(metadata)
  if (kind && OVERRIDE_KIND_LABEL[kind]) return OVERRIDE_KIND_LABEL[kind]
  const firstHighlight = readTankestromScheduleDetailsFromMetadata(metadata).highlights[0]?.label?.trim()
  if (firstHighlight && firstHighlight.length <= HEADING_HIGHLIGHT_MAX) return firstHighlight
  return undefined
}
